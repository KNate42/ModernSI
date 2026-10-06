"""
Moves outbox rows into ClickHouse. At-least-once: a row may be sent twice, ReplacingMergeTree folds the copies.
This work made by Anfinogentov Nikita
"""
import json
import logging
from datetime import timedelta

from sqlalchemy import delete, select

from modernsi.core.db import utcnow
from modernsi.feed.models import Outbox
from modernsi.feed.schema import ACTIVITY_COLUMNS
from modernsi.mail.models import MailQueue

log = logging.getLogger("modernsi.feed")


def activity_row(row):
    data = json.dumps(row.data or {}, ensure_ascii=False)
    return [row.uid, row.kind, row.created_at, row.actor_id, row.idea_id, row.event_id, row.campus_label or "", data]


async def ship_outbox(hub, limit=500):
    client = await hub.get_clickhouse()
    if client is None:
        return 0
    async with hub.sessions() as db:
        rows = (await db.execute(
            select(Outbox).where(Outbox.shipped_at.is_(None)).order_by(Outbox.id).limit(limit).with_for_update(skip_locked=True)
        )).scalars().all()
        if not rows:
            return 0
        try:
            await client.insert("activity", [activity_row(row) for row in rows], column_names=ACTIVITY_COLUMNS)
        except Exception as exc:
            log.warning("outbox shipping failed: %r", exc)
            hub.drop_clickhouse()
            await db.rollback()
            return 0
        now = utcnow()
        for row in rows:
            row.shipped_at = now
        await db.commit()
        return len(rows)


async def purge_old(hub):
    async with hub.sessions() as db:
        await db.execute(delete(Outbox).where(Outbox.shipped_at < utcnow() - timedelta(days=7)))
        await db.execute(delete(MailQueue).where(MailQueue.sent_at < utcnow() - timedelta(days=30)))
        await db.commit()
