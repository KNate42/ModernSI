"""
Request and response shapes of the auth module.
This work made by Anfinogentov Nikita
"""
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, StringConstraints, field_validator


class EmailIn(BaseModel):
    email: EmailStr

    @field_validator("email", mode="before")
    @classmethod
    def strip_email(cls, value):
        # people paste addresses with spaces around them; I forgive that
        return value.strip() if isinstance(value, str) else value


class RegisterIn(EmailIn):
    password: str = Field(min_length=10, max_length=200)
    display_name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=60)]


class LoginIn(EmailIn):
    password: str = Field(min_length=1, max_length=200)


class VerifyIn(BaseModel):
    code: str = Field(pattern=r"^\d{6}$")


class ResetIn(EmailIn):
    code: str = Field(pattern=r"^\d{6}$")
    password: str = Field(min_length=10, max_length=200)


class MeOut(BaseModel):
    id: UUID
    email: str
    display_name: str
    campus_label: str | None
    role: str
    status: str


class AuthorOut(BaseModel):
    id: UUID
    display_name: str
    campus_label: str | None
