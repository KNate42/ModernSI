"""
Tables of the events module.
This work made by Anfinogentov Nikita
"""
import uuid

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import mapped_column, relationship

from modernsi.auth.models import User
from modernsi.core.db import Base, utcnow
from modernsi.ideas.models import Idea


class Event(Base):
    __tablename__ = "events"

    id = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    # one idea grows into at most one event; curator events have no idea
    idea_id = mapped_column(ForeignKey("ideas.id"), nullable=True, unique=True)
    created_by = mapped_column(ForeignKey("users.id"), nullable=False)
    title = mapped_column(String(120), nullable=False)
    description_md = mapped_column(Text, nullable=False, default="")
    starts_at = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    ends_at = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    location_text = mapped_column(String(200), nullable=True)
    online_url = mapped_column(String(500), nullable=True)
    campus_label = mapped_column(String(80), nullable=True)
    going_count = mapped_column(Integer, nullable=False, default=0)
    created_at = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    creator = relationship(User, lazy="joined")
    idea = relationship(Idea, lazy="joined")


class EventRsvp(Base):
    __tablename__ = "event_rsvps"

    event_id = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), primary_key=True)
    user_id = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True)
    created_at = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
