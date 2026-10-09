"""
Mail queue helpers: enqueue inside a transaction, send_pending from the worker with retries.
This work made by Anfinogentov Nikita
"""
import logging

from sqlalchemy import select

from modernsi.core.db import utcnow
from modernsi.mail.models import MailQueue
from modernsi.mail.sender import send_now

log = logging.getLogger("modernsi.mail")
max_attempts = 5


def enqueue(db, to_email, subject, body):
    db.add(MailQueue(to_email=to_email, subject=subject, body=body))


async def send_pending(hub, limit=50):
    sent = 0
    async with hub.sessions() as db:
        rows = (await db.execute(
            select(MailQueue)
            .where(MailQueue.sent_at.is_(None), MailQueue.attempts < max_attempts)
            .order_by(MailQueue.id)
            .limit(limit)
            .with_for_update(skip_locked=True)
        )).scalars().all()
        for row in rows:
            try:
                await send_now(hub.settings, row.to_email, row.subject, row.body)
                row.sent_at = utcnow()
                sent += 1
            except Exception as exc:
                row.attempts += 1
                row.last_error = repr(exc)[:1000]
                log.warning("mail to %s failed: %r", row.to_email, exc)
        await db.commit()
    return sent
