"""
HTTP endpoints of the events module.
This work made by Anfinogentov Nikita
"""
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from modernsi.auth.deps import active_user, optional_user
from modernsi.core.db import get_db
from modernsi.core.deps import get_config
from modernsi.events import service
from modernsi.events.schemas import EventCreate, EventOut, EventPage, RsvpOut
from modernsi.ideas.schemas import Category

router = APIRouter(prefix="/api/events", tags=["events"])


@router.get("", response_model=EventPage)
async def events(
    when: Literal["upcoming", "past"] = "upcoming",
    category: list[Category] | None = Query(None),
    network_only: bool = False,
    going: bool = False,
    idea: UUID | None = None,
    cursor: str | None = None,
    limit: int = Query(20, ge=1, le=50),
    viewer=Depends(optional_user),
    db=Depends(get_db),
):
    return await service.list_events(db, viewer, when, category, network_only, going, idea, cursor, limit)


@router.post("", status_code=201, response_model=EventOut)
async def create(data: EventCreate, user=Depends(active_user), db=Depends(get_db), settings=Depends(get_config)):
    return await service.create_event(db, settings, user, data)


@router.get("/{event_id}", response_model=EventOut)
async def read(event_id: UUID, viewer=Depends(optional_user), db=Depends(get_db)):
    return await service.get_event(db, event_id, viewer)


@router.post("/{event_id}/rsvp", response_model=RsvpOut)
async def rsvp(event_id: UUID, user=Depends(active_user), db=Depends(get_db)):
    return await service.set_rsvp(db, user, event_id, True)


@router.delete("/{event_id}/rsvp", response_model=RsvpOut)
async def cancel_rsvp(event_id: UUID, user=Depends(active_user), db=Depends(get_db)):
    return await service.set_rsvp(db, user, event_id, False)
