"""
Idea logic: creating, listing, reading and editing. Votes, review and teams come in the next tasks.
This work made by Anfinogentov Nikita
"""
from datetime import timedelta

from sqlalchemy import func, select

from modernsi.auth.models import User
from modernsi.auth.service import author_out
from modernsi.core.db import utcnow
from modernsi.core.errors import api_error
from modernsi.core.markdown import render_markdown
from modernsi.feed.outbox import emit
from modernsi.ideas.models import Idea, IdeaTeamMember, IdeaVote

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
