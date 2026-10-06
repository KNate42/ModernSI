"""
Shapes of the profiles module.
This work made by Anfinogentov Nikita
"""
from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl, StringConstraints

Language = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=30)]
Interest = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]


class ProfileUpdate(BaseModel):
    bio: str = Field(default="", max_length=500)
    languages: list[Language] = Field(default_factory=list, max_length=10)
    interests: list[Interest] = Field(default_factory=list, max_length=15)
    links: list[HttpUrl] = Field(default_factory=list, max_length=5)
    theme: Literal["system", "light", "dark"] = "system"


class ProfileOut(BaseModel):
    id: UUID
    display_name: str
    campus_label: str | None
    role: str
    joined_at: datetime
    bio: str = ""
    languages: list[str] = []
    interests: list[str] = []
    links: list[str] = []
    theme: str = "system"
    has_avatar: bool = False
    extended: bool = True
