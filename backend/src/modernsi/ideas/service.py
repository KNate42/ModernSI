"""
Idea logic: creating, listing, reading and editing. Votes, review and teams come in the next tasks.
This work made by Anfinogentov Nikita
"""
from datetime import timedelta

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError

from modernsi.auth.models import User
from modernsi.auth.service import author_out
from modernsi.core.db import utcnow
from modernsi.core.errors import api_error
from modernsi.core.markdown import render_markdown
from modernsi.feed.outbox import emit
from modernsi.ideas.models import Idea, IdeaReport, IdeaTeamMember, IdeaVote
from modernsi.mail import templates
from modernsi.mail.queue import enqueue

editable = ("open", "needs_changes")


def idea_card(idea, settings):
    return {
        "id": idea.id, "title": idea.title, "summary": idea.summary, "category": idea.category, "scope": idea.scope,
        "campus_label": idea.campus_label, "status": idea.status, "vote_count": idea.vote_count,
        "vote_threshold": settings.vote_threshold, "team_size": idea.team_size, "team_min": settings.team_min,
        "author": author_out(idea.author), "created_at": idea.created_at, "expires_at": idea.expires_at,
    }


def can_see_hidden(idea, viewer):
    return viewer is not None and (viewer.id == idea.author_id or viewer.role == "admin")


def not_found():
    return api_error(404, "idea_not_found", "There is no such idea")


async def load_idea(db, idea_id, viewer=None):
    idea = (await db.execute(select(Idea).where(Idea.id == idea_id))).scalar_one_or_none()
    if idea is None or (idea.is_hidden and not can_see_hidden(idea, viewer)):
        raise not_found()
    return idea


async def lock_idea(db, idea_id):
    # FOR UPDATE OF ideas: the joined author rows are not locked, only the idea itself
    idea = (await db.execute(select(Idea).where(Idea.id == idea_id).with_for_update(of=Idea))).scalar_one_or_none()
    if idea is None or idea.is_hidden:
        raise not_found()
    return idea


async def team_of(db, idea_id):
    return (await db.execute(
        select(User).join(IdeaTeamMember, IdeaTeamMember.user_id == User.id)
        .where(IdeaTeamMember.idea_id == idea_id).order_by(IdeaTeamMember.joined_at)
    )).scalars().all()


async def get_detail(db, settings, idea_id, viewer):
    idea = await load_idea(db, idea_id, viewer)
    team = await team_of(db, idea.id)
    my_vote = viewer is not None and await db.get(IdeaVote, (idea.id, viewer.id)) is not None
    is_author = viewer is not None and viewer.id == idea.author_id
    return {
        **idea_card(idea, settings),
        "body_md": idea.body_md, "body_html": render_markdown(idea.body_md), "review_note": idea.review_note,
        "is_hidden": idea.is_hidden, "my_vote": my_vote,
        "in_team": viewer is not None and any(member.id == viewer.id for member in team),
        "is_author": is_author, "can_edit": is_author and idea.status in editable,
        "team": [author_out(member) for member in team],
    }


def parse_offset(cursor):
    if not cursor:
        return 0
    if not cursor.isdigit():
        raise api_error(422, "bad_cursor", "This page link is broken, start from the top")
    return int(cursor)


async def list_ideas(db, settings, viewer, status=None, categories=None, scope=None, mine=None, sort="new", cursor=None, limit=20):
    statement = select(Idea).where(Idea.is_hidden.is_(False))
    if status:
        statement = statement.where(Idea.status.in_(status))
    if categories:
        statement = statement.where(Idea.category.in_(categories))
    if scope:
        statement = statement.where(Idea.scope == scope)
    if mine:
        if viewer is None:
            raise api_error(401, "not_authenticated", "Please log in first")
        if mine == "authored":
            statement = statement.where(Idea.author_id == viewer.id)
        elif mine == "voted":
            statement = statement.where(Idea.id.in_(select(IdeaVote.idea_id).where(IdeaVote.user_id == viewer.id)))
        elif mine == "team":
            statement = statement.where(Idea.id.in_(select(IdeaTeamMember.idea_id).where(IdeaTeamMember.user_id == viewer.id)))
    if sort == "closest":
        # every idea has the same threshold, so "closest to it" is simply "most votes"
        statement = statement.where(Idea.status == "open").order_by(Idea.vote_count.desc(), Idea.created_at.asc())
    elif sort == "trending":
        recent = (
            select(IdeaVote.idea_id, func.count().label("recent"))
            .where(IdeaVote.created_at > utcnow() - timedelta(days=7))
            .group_by(IdeaVote.idea_id).subquery()
        )
        statement = statement.outerjoin(recent, recent.c.idea_id == Idea.id).order_by(
            func.coalesce(recent.c.recent, 0).desc(), Idea.vote_count.desc(), Idea.created_at.desc()
        )
    else:
        statement = statement.order_by(Idea.created_at.desc(), Idea.id.desc())
    offset = parse_offset(cursor)
    rows = (await db.execute(statement.offset(offset).limit(limit + 1))).scalars().all()
    return {
        "items": [idea_card(idea, settings) for idea in rows[:limit]],
        "next_cursor": str(offset + limit) if len(rows) > limit else None,
    }


async def create_idea(db, settings, user, data):
    idea = Idea(
        author_id=user.id, title=data.title, summary=data.summary, body_md=data.body_md, category=data.category,
        scope=data.scope, campus_label=user.campus_label, expires_at=utcnow() + timedelta(days=settings.idea_ttl_days),
    )
    db.add(idea)
    await db.flush()
    emit(db, "idea_created", actor_id=user.id, idea_id=idea.id, campus_label=user.campus_label,
         data={"actor_name": user.display_name, "idea_title": idea.title, "category": idea.category})
    await db.commit()
    return await get_detail(db, settings, idea.id, user)


async def update_idea(db, settings, user, idea_id, data):
    idea = await lock_idea(db, idea_id)
    if idea.author_id != user.id:
        raise api_error(403, "not_author", "Only the author can edit this idea")
    if idea.status not in editable:
        raise api_error(409, "idea_locked", "This idea can no longer be edited")
    changes = data.model_dump(exclude_unset=True, exclude_none=True)
    if idea.status == "open" and changes.get("category", idea.category) != idea.category:
        raise api_error(409, "category_locked", "The category cannot change while people are voting")
    for field, value in changes.items():
        setattr(idea, field, value)
    idea.updated_at = utcnow()
    await db.commit()
    return await get_detail(db, settings, idea.id, user)


def idea_url(settings, idea):
    return f"{settings.site_url}/ideas/{idea.id}"


async def vote(db, settings, user, idea_id):
    idea = await lock_idea(db, idea_id)
    if idea.status != "open":
        raise api_error(409, "voting_closed", "This idea is not collecting votes now")
    if idea.author_id == user.id:
        raise api_error(409, "own_idea", "You cannot vote for your own idea")
    if await db.get(IdeaVote, (idea.id, user.id)) is None:
        db.add(IdeaVote(idea_id=idea.id, user_id=user.id))
        idea.vote_count += 1
        if idea.vote_count >= settings.vote_threshold:
            # the row lock above makes this branch run exactly once, whatever the concurrency
            idea.status = "in_review"
            idea.review_started_at = utcnow()
            emit(db, "idea_reached_review", idea_id=idea.id, campus_label=idea.campus_label, data={"idea_title": idea.title})
            enqueue(db, idea.author.email, *templates.idea_in_review(idea.title, idea_url(settings, idea)))
    await db.commit()
    return {"vote_count": idea.vote_count, "status": idea.status, "my_vote": True}


async def unvote(db, user, idea_id):
    idea = await lock_idea(db, idea_id)
    if idea.status != "open":
        raise api_error(409, "voting_closed", "This idea is not collecting votes now")
    existing = await db.get(IdeaVote, (idea.id, user.id))
    if existing is not None:
        await db.delete(existing)
        idea.vote_count -= 1
    await db.commit()
    return {"vote_count": idea.vote_count, "status": idea.status, "my_vote": False}


async def after_team_change(db, settings, idea):
    # the "team is ready" moment fires once, even if people leave and join again later
    if idea.team_size >= settings.team_min and idea.team_formed_at is None:
        idea.team_formed_at = utcnow()
        emit(db, "team_formed", idea_id=idea.id, campus_label=idea.campus_label, data={"idea_title": idea.title})
        enqueue(db, idea.author.email, *templates.team_formed(idea.title, idea_url(settings, idea)))


async def decide(db, settings, reviewer, idea_id, decision, note):
    idea = await lock_idea(db, idea_id)
    if idea.status != "in_review":
        raise api_error(409, "not_in_review", "This idea is not waiting for review")
    note = (note or "").strip() or None
    if decision in ("reject", "needs_changes") and note is None:
        raise api_error(422, "note_required", "Explain the decision in a short note")
    idea.decided_at = utcnow()
    idea.review_note = note
    if decision == "approve":
        idea.status = "forming_team"
        db.add(IdeaTeamMember(idea_id=idea.id, user_id=idea.author_id))
        idea.team_size = 1
        await after_team_change(db, settings, idea)
    else:
        idea.status = "rejected" if decision == "reject" else "needs_changes"
    emit(db, "idea_decided", actor_id=reviewer.id, idea_id=idea.id, campus_label=idea.campus_label,
         data={"idea_title": idea.title, "decision": decision})
    enqueue(db, idea.author.email, *templates.idea_decided(idea.title, decision, note, idea_url(settings, idea)))
    await db.commit()
    return await get_detail(db, settings, idea.id, reviewer)


async def resubmit(db, settings, user, idea_id):
    idea = await lock_idea(db, idea_id)
    if idea.author_id != user.id:
        raise api_error(403, "not_author", "Only the author can send this idea back")
    if idea.status != "needs_changes":
        raise api_error(409, "not_needs_changes", "This idea is not waiting for changes")
    # the threshold was already reached once, so it goes straight back to review
    idea.status = "in_review"
    idea.review_started_at = utcnow()
    idea.review_note = None
    await db.commit()
    return await get_detail(db, settings, idea.id, user)


async def join_team(db, settings, user, idea_id):
    idea = await lock_idea(db, idea_id)
    if idea.status != "forming_team":
        raise api_error(409, "team_closed", "This idea is not gathering a team now")
    if await db.get(IdeaTeamMember, (idea.id, user.id)) is None:
        db.add(IdeaTeamMember(idea_id=idea.id, user_id=user.id))
        idea.team_size += 1
        await after_team_change(db, settings, idea)
    await db.commit()
    return {"team_size": idea.team_size, "in_team": True, "status": idea.status}


async def leave_team(db, user, idea_id):
    idea = await lock_idea(db, idea_id)
    if idea.status != "forming_team":
        raise api_error(409, "team_closed", "This idea is not gathering a team now")
    if idea.author_id == user.id:
        raise api_error(409, "author_cannot_leave", "The author stays in the team")
    member = await db.get(IdeaTeamMember, (idea.id, user.id))
    if member is not None:
        await db.delete(member)
        idea.team_size -= 1
    await db.commit()
    return {"team_size": idea.team_size, "in_team": False, "status": idea.status}


async def report_idea(db, user, idea_id, reason):
    idea = await load_idea(db, idea_id, user)
    db.add(IdeaReport(idea_id=idea.id, reporter_id=user.id, reason=reason))
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise api_error(409, "already_reported", "You have already reported this idea")


async def set_hidden(db, idea_id, hidden):
    idea = await db.get(Idea, idea_id)
    if idea is None:
        raise not_found()
    idea.is_hidden = hidden
    await db.commit()
    return {"id": idea.id, "is_hidden": idea.is_hidden}


async def list_reports(db):
    rows = await db.execute(
        select(IdeaReport, Idea.title).join(Idea, Idea.id == IdeaReport.idea_id)
        .where(IdeaReport.resolved_at.is_(None)).order_by(IdeaReport.created_at)
    )
    return [
        {"id": report.id, "idea_id": report.idea_id, "idea_title": title, "reason": report.reason, "created_at": report.created_at}
        for report, title in rows.all()
    ]


async def resolve_report(db, report_id):
    report = await db.get(IdeaReport, report_id)
    if report is None:
        raise api_error(404, "report_not_found", "There is no such report")
    report.resolved_at = utcnow()
    await db.commit()
    return {"id": report.id}


async def hidden_idea_ids(db, idea_ids):
    if not idea_ids:
        return set()
    rows = await db.execute(select(Idea.id).where(Idea.id.in_(idea_ids), Idea.is_hidden.is_(True)))
    return set(rows.scalars().all())


async def expire_ideas(db):
    result = await db.execute(update(Idea).where(Idea.status == "open", Idea.expires_at < utcnow()).values(status="expired"))
    await db.commit()
    return result.rowcount


async def mark_done(db, idea_ids):
    if not idea_ids:
        return 0
    result = await db.execute(update(Idea).where(Idea.id.in_(idea_ids), Idea.status == "live").values(status="done"))
    await db.commit()
    return result.rowcount
