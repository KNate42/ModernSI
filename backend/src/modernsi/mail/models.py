"""
Mail queue: notifications are written in the action's transaction and sent by the worker.
This work made by Anfinogentov Nikita
"""
from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import mapped_column

from modernsi.core.db import Base, utcnow


class MailQueue(Base):
    __tablename__ = "mail_queue"

    id = mapped_column(Integer, primary_key=True)
    to_email = mapped_column(String(320), nullable=False)
    subject = mapped_column(String(200), nullable=False)
    body = mapped_column(Text, nullable=False)
    created_at = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    sent_at = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    attempts = mapped_column(Integer, nullable=False, default=0)
    last_error = mapped_column(Text, nullable=True)
