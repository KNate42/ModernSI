"""
Tables of the ideas module.
This work made by Anfinogentov Nikita
"""
import uuid

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import mapped_column, relationship

from modernsi.auth.models import User
from modernsi.core.db import Base, utcnow

statuses = ("open", "in_review", "needs_changes", "rejected", "forming_team", "live", "done", "expired")
categories = ("event", "academic", "club", "research", "volunteering", "campus_life")


class Idea(Base):
    __tablename__ = "ideas"

    id = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    author_id = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    title = mapped_column(String(120), nullable=False)
    summary = mapped_column(String(280), nullable=False)
    body_md = mapped_column(Text, nullable=False, default="")
    category = mapped_column(String(20), nullable=False, index=True)
    scope = mapped_column(String(10), nullable=False, default="network")
    campus_label = mapped_column(String(80), nullable=True)
    status = mapped_column(String(20), nullable=False, default="open", index=True)
    vote_count = mapped_column(Integer, nullable=False, default=0)
    team_size = mapped_column(Integer, nullable=False, default=0)
    is_hidden = mapped_column(Boolean, nullable=False, default=False)
    review_note = mapped_column(Text, nullable=True)
    created_at = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow, index=True)
    updated_at = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    review_started_at = mapped_column(DateTime(timezone=True), nullable=True)
    decided_at = mapped_column(DateTime(timezone=True), nullable=True)
    team_formed_at = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at = mapped_column(DateTime(timezone=True), nullable=False)

    author = relationship(User, lazy="joined")


class IdeaVote(Base):
    __tablename__ = "idea_votes"

    idea_id = mapped_column(ForeignKey("ideas.id", ondelete="CASCADE"), primary_key=True)
    user_id = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True)
    created_at = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow, index=True)


class IdeaTeamMember(Base):
    __tablename__ = "idea_team_members"

    idea_id = mapped_column(ForeignKey("ideas.id", ondelete="CASCADE"), primary_key=True)
    user_id = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True)
    joined_at = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


class IdeaReport(Base):
    __tablename__ = "idea_reports"
    __table_args__ = (UniqueConstraint("idea_id", "reporter_id", name="uq_idea_reports_idea_reporter"),)

    id = mapped_column(Integer, primary_key=True)
    idea_id = mapped_column(ForeignKey("ideas.id", ondelete="CASCADE"), nullable=False, index=True)
    reporter_id = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reason = mapped_column(String(500), nullable=False)
    created_at = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    resolved_at = mapped_column(DateTime(timezone=True), nullable=True)
