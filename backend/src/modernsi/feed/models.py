"""
Transactional outbox: feed events written in the same transaction as the action, shipped to ClickHouse later.
This work made by Anfinogentov Nikita
"""
import uuid

from sqlalchemy import BigInteger, DateTime, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import mapped_column

from modernsi.core.db import Base, utcnow


class Outbox(Base):
    __tablename__ = "outbox"

    id = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    uid = mapped_column(Uuid, nullable=False, unique=True, default=uuid.uuid4)
    kind = mapped_column(String(40), nullable=False)
    # no foreign keys on purpose: the feed must outlive hidden or deleted rows
    actor_id = mapped_column(Uuid, nullable=True)
    idea_id = mapped_column(Uuid, nullable=True)
    event_id = mapped_column(Uuid, nullable=True)
    campus_label = mapped_column(String(80), nullable=True)
    data = mapped_column(JSONB, nullable=True)
    created_at = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    shipped_at = mapped_column(DateTime(timezone=True), nullable=True, index=True)
