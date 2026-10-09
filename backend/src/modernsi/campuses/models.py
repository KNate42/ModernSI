"""
Tables of allowed e-mail domains (each one is a campus label) and of requests to add a domain.
This work made by Anfinogentov Nikita
"""
from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import mapped_column

from modernsi.core.db import Base, utcnow


class EmailDomain(Base):
    __tablename__ = "email_domains"

    id = mapped_column(Integer, primary_key=True)
    domain = mapped_column(String(253), unique=True, nullable=False)
    campus_label = mapped_column(String(80), nullable=False)
    country_code = mapped_column(String(2), nullable=False)
    is_active = mapped_column(Boolean, nullable=False, default=True)
    created_at = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


class DomainRequest(Base):
    __tablename__ = "domain_requests"

    id = mapped_column(Integer, primary_key=True)
    domain = mapped_column(String(253), nullable=False, index=True)
    university_name = mapped_column(String(160), nullable=False)
    requester_email = mapped_column(String(320), nullable=False)
    status = mapped_column(String(10), nullable=False, default="pending")
    created_at = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
