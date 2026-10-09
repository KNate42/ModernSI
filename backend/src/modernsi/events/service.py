"""
Event logic: publishing (from a ready idea or by a curator), listing, RSVPs, closing finished ideas.
This work made by Anfinogentov Nikita
"""
from sqlalchemy import or_, select

from modernsi.auth.service import author_out
from modernsi.core.db import utcnow
from modernsi.core.errors import api_error
from modernsi.core.markdown import render_markdown
from modernsi.events.models import Event, EventRsvp
from modernsi.feed.outbox import emit
from modernsi.ideas.models import Idea
from modernsi.ideas.service import can_see_hidden, lock_idea, mark_done, parse_offset, team_of
from modernsi.mail import templates
from modernsi.mail.queue import enqueue

curators = ("curator", "admin")


def event_out(event, going=False):
    return {
        "id": event.id, "title": event.title, "description_md": event.description_md,
        "description_html": render_markdown(event.description_md), "starts_at": event.starts_at, "ends_at": event.ends_at,
        "location_text": event.location_text, "online_url": event.online_url, "campus_label": event.campus_label,
        "going_count": event.going_count, "idea_id": event.idea_id, "idea_title": event.idea.title if event.idea else None,
        "created_by": author_out(event.creator), "i_am_going": going, "is_past": event.ends_at <= utcnow(),
    }


def check_times_and_place(data):
    if not data.location_text and data.online_url is None:
        raise api_error(422, "location_required", "Add a place or an online link")
    if data.ends_at <= data.starts_at:
        raise api_error(422, "bad_time_range", "The event must end after it starts")
    if data.starts_at <= utcnow():
        raise api_error(422, "starts_in_past", "The event must start in the future")


async def create_event(db, settings, user, data):
    check_times_and_place(data)
    idea = None
    if data.idea_id is not None:
        idea = await lock_idea(db, data.idea_id)
        if idea.author_id != user.id and user.role not in curators:
            raise api_error(403, "forbidden", "Only the author or a curator can put this idea on the Hub")
        if idea.status != "forming_team":
            raise api_error(409, "idea_not_ready", "This idea is not ready for an event")
        if idea.team_size < settings.team_min:
            raise api_error(409, "team_too_small", f"The team needs at least {settings.team_min} people")
        campus_label = idea.campus_label if idea.scope == "campus" else None
    else:
        if user.role not in curators:
            raise api_error(403, "forbidden", "Only curators can publish events without an idea")
        campus_label = user.campus_label if data.scope == "campus" else None
    event = Event(
        idea_id=idea.id if idea else None, created_by=user.id, title=data.title, description_md=data.description_md,
        starts_at=data.starts_at, ends_at=data.ends_at, location_text=data.location_text or None,
        online_url=str(data.online_url) if data.online_url else None, campus_label=campus_label,
    )
    db.add(event)
    await db.flush()
    if idea is not None:
        idea.status = "live"
        url = f"{settings.site_url}/events/{event.id}"
        for member in await team_of(db, idea.id):
            if member.id != user.id:
                enqueue(db, member.email, *templates.event_published(idea.title, url))
    emit(db, "event_published", actor_id=user.id, idea_id=idea.id if idea else None, event_id=event.id, campus_label=campus_label,
         data={"event_title": event.title, "idea_title": idea.title if idea else None, "starts_at": data.starts_at.isoformat()})
    await db.commit()
    return await get_event(db, event.id, user)


async def load_event(db, event_id, viewer=None, lock=False):
    statement = select(Event).where(Event.id == event_id)
    if lock:
        statement = statement.with_for_update(of=Event)
    event = (await db.execute(statement)).scalar_one_or_none()
    if event is None or (event.idea is not None and event.idea.is_hidden and not can_see_hidden(event.idea, viewer)):
        raise api_error(404, "event_not_found", "There is no such event")
    return event


async def is_going(db, event_id, viewer):
    return viewer is not None and await db.get(EventRsvp, (event_id, viewer.id)) is not None


async def get_event(db, event_id, viewer):
    event = await load_event(db, event_id, viewer)
    return event_out(event, await is_going(db, event.id, viewer))


async def list_events(db, viewer, when="upcoming", categories=None, network_only=False, going=False, idea_id=None, cursor=None, limit=20):
    now = utcnow()
    statement = select(Event).outerjoin(Idea, Event.idea_id == Idea.id).where(or_(Event.idea_id.is_(None), Idea.is_hidden.is_(False)))
    if when == "past":
        statement = statement.where(Event.ends_at <= now).order_by(Event.starts_at.desc())
    else:
        statement = statement.where(Event.ends_at > now).order_by(Event.starts_at.asc())
    if categories:
        statement = statement.where(Idea.category.in_(categories))
    if network_only:
        statement = statement.where(Event.campus_label.is_(None))
    if going:
        if viewer is None:
            raise api_error(401, "not_authenticated", "Please log in first")
        statement = statement.where(Event.id.in_(select(EventRsvp.event_id).where(EventRsvp.user_id == viewer.id)))
    if idea_id is not None:
        statement = statement.where(Event.idea_id == idea_id)
    offset = parse_offset(cursor)
    rows = (await db.execute(statement.offset(offset).limit(limit + 1))).scalars().all()
    page = rows[:limit]
    mine = set()
    if viewer is not None and page:
        mine = set((await db.execute(
            select(EventRsvp.event_id).where(EventRsvp.user_id == viewer.id, EventRsvp.event_id.in_([event.id for event in page]))
        )).scalars().all())
    return {
        "items": [event_out(event, event.id in mine) for event in page],
        "next_cursor": str(offset + limit) if len(rows) > limit else None,
    }


async def set_rsvp(db, user, event_id, going):
    event = await load_event(db, event_id, user, lock=True)
    if event.ends_at <= utcnow():
        raise api_error(409, "event_over", "This event is already over")
    existing = await db.get(EventRsvp, (event.id, user.id))
    if going and existing is None:
        db.add(EventRsvp(event_id=event.id, user_id=user.id))
        event.going_count += 1
    elif not going and existing is not None:
        await db.delete(existing)
        event.going_count -= 1
    await db.commit()
    return {"going_count": event.going_count, "i_am_going": going}


async def finish_events(db):
    ended = select(Event.idea_id).where(Event.idea_id.is_not(None), Event.ends_at < utcnow())
    idea_ids = set((await db.execute(ended)).scalars().all())
    return await mark_done(db, idea_ids)
