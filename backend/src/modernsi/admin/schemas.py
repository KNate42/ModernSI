"""
Shapes of the admin API. Admins do see e-mail addresses; nobody else does.
This work made by Anfinogentov Nikita
"""
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

Role = Literal["student", "student_gov", "curator", "admin"]


class DomainIn(BaseModel):
    domain: str = Field(min_length=3, max_length=253)
    campus_label: str = Field(min_length=2, max_length=80)
    country_code: str = Field(pattern=r"^[A-Za-z]{2}$")


class DomainPatch(BaseModel):
    campus_label: str | None = Field(default=None, min_length=2, max_length=80)
    country_code: str | None = Field(default=None, pattern=r"^[A-Za-z]{2}$")
    is_active: bool | None = None


class DomainOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    domain: str
    campus_label: str
    country_code: str
    is_active: bool


class ApproveIn(BaseModel):
    campus_label: str = Field(min_length=2, max_length=80)
    country_code: str = Field(pattern=r"^[A-Za-z]{2}$")


class DomainRequestAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    domain: str
    university_name: str
    requester_email: str
    status: str
    created_at: datetime


class RoleIn(BaseModel):
    role: Role


class AdminUserOut(BaseModel):
    id: UUID
    email: str
    display_name: str
    campus_label: str | None
    role: str
    status: str
    created_at: datetime


class ReportOut(BaseModel):
    id: int
    idea_id: UUID
    idea_title: str
    reason: str
    created_at: datetime


class HiddenOut(BaseModel):
    id: UUID
    is_hidden: bool
