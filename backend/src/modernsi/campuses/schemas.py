"""
Request and response shapes of the campuses module.
This work made by Anfinogentov Nikita
"""
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class DomainRequestCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    domain: str = Field(min_length=3, max_length=253)
    university_name: str = Field(min_length=2, max_length=160)
    requester_email: EmailStr


class DomainRequestOut(BaseModel):
    id: int
    status: str


class CampusOut(BaseModel):
    campus_label: str
    country_code: str
    students: int
