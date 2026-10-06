"""
Shapes of the ideas module.
This work made by Anfinogentov Nikita
"""
from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, Field, StringConstraints

from modernsi.auth.schemas import AuthorOut

Category = Literal["event", "academic", "club", "research", "volunteering", "campus_life"]
Scope = Literal["campus", "network"]
Status = Literal["open", "in_review", "needs_changes", "rejected", "forming_team", "live", "done", "expired"]
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=120)]
Summary = Annotated[str, StringConstraints(strip_whitespace=True, min_length=10, max_length=280)]


class IdeaCreate(BaseModel):
    title: Title
    summary: Summary
    body_md: str = Field(default="", max_length=10_000)
    category: Category
    scope: Scope = "network"


class IdeaUpdate(BaseModel):
    title: Title | None = None
    summary: Summary | None = None
    body_md: str | None = Field(default=None, max_length=10_000)
    category: Category | None = None
    scope: Scope | None = None


class IdeaCard(BaseModel):
    id: UUID
    title: str
    summary: str
    category: str
    scope: str
    campus_label: str | None
    status: str
    vote_count: int
    vote_threshold: int
    team_size: int
    team_min: int
    author: AuthorOut
    created_at: datetime
    expires_at: datetime


class IdeaDetail(IdeaCard):
    body_md: str
    body_html: str
    review_note: str | None
    is_hidden: bool
    my_vote: bool
    in_team: bool
    is_author: bool
    can_edit: bool
    team: list[AuthorOut]


class IdeaPage(BaseModel):
    items: list[IdeaCard]
    next_cursor: str | None
