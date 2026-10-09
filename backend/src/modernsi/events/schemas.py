"""
Shapes of the events module. Times must carry a timezone: a naive time is a 422, never a guess.
This work made by Anfinogentov Nikita
"""
from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, Field, HttpUrl, StringConstraints

from modernsi.auth.schemas import AuthorOut

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=120)]
Place = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]


class EventCreate(BaseModel):
    title: Title
    description_md: str = Field(default="", max_length=5000)
    starts_at: AwareDatetime
    ends_at: AwareDatetime
    location_text: Place | None = None
    online_url: HttpUrl | None = None
    idea_id: UUID | None = None
    scope: Literal["campus", "network"] = "network"


class EventOut(BaseModel):
    id: UUID
    title: str
    description_md: str
    description_html: str
    starts_at: datetime
    ends_at: datetime
    location_text: str | None
    online_url: str | None
    campus_label: str | None
    going_count: int
    idea_id: UUID | None
    idea_title: str | None
    created_by: AuthorOut
    i_am_going: bool
    is_past: bool


class EventPage(BaseModel):
    items: list[EventOut]
    next_cursor: str | None


class RsvpOut(BaseModel):
    going_count: int
    i_am_going: bool
