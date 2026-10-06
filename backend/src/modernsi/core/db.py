"""
SQLAlchemy base class, the request-scoped session and a UTC clock.
This work made by Anfinogentov Nikita
"""
from datetime import UTC, datetime

from fastapi import Request
from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase

naming = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=naming)


def utcnow():
    return datetime.now(UTC)


async def get_db(request: Request):
    # One session per request; FastAPI caches the dependency, so every dependency of a request shares it
    async with request.app.state.stores.sessions() as session:
        yield session
