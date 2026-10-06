"""
Shapes of the feed module.
This work made by Anfinogentov Nikita
"""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class FeedItem(BaseModel):
    id: UUID
    kind: str
    at: datetime
    actor_id: UUID | None
    idea_id: UUID | None
    event_id: UUID | None
    campus_label: str | None
    data: dict


class FeedPage(BaseModel):
    items: list[FeedItem]
    next_cursor: str | None


class StatsOut(BaseModel):
    students: int
    campuses: int
    ideas_to_events: int
    show_counters: bool
