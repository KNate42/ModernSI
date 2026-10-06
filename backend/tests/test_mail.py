"""
Mail: direct sending through SMTP (Mailpit in tests) and the retrying queue.
This work made by Anfinogentov Nikita
"""
from sqlalchemy import select

from modernsi.core.config import Settings
from modernsi.feed.models import Outbox
from modernsi.feed.outbox import emit
from modernsi.mail import templates
from modernsi.mail.models import MailQueue
from modernsi.mail.queue import enqueue, send_pending
from modernsi.mail.sender import send_now
from tests.helpers import last_mail


async def test_send_now_delivers(settings):
    subject, body = templates.verify_code("123456")
    await send_now(settings, "aru@uni.edu", subject, body)
    mail = await last_mail("aru@uni.edu")
    assert "123456" in mail["text"]
    assert "123456" in mail["subject"]


async def test_queue_sends_and_marks(hub):
    async with hub.sessions() as db:
        enqueue(db, "aru@uni.edu", "Hello", "Body text")
        await db.commit()
    assert await send_pending(hub) == 1
    assert (await last_mail("aru@uni.edu"))["subject"] == "Hello"
    async with hub.sessions() as db:
        row = (await db.execute(select(MailQueue))).scalar_one()
        assert row.sent_at is not None
    assert await send_pending(hub) == 0


async def test_queue_counts_failures(hub, monkeypatch):
    broken = Settings(_env_file=None, smtp_port=1)
    monkeypatch.setattr(hub, "settings", broken)
    async with hub.sessions() as db:
        enqueue(db, "aru@uni.edu", "Hello", "Body")
        await db.commit()
    assert await send_pending(hub) == 0
    async with hub.sessions() as db:
        row = (await db.execute(select(MailQueue))).scalar_one()
        assert row.attempts == 1
        assert row.sent_at is None
        assert row.last_error


async def test_emit_adds_outbox_row(hub):
    async with hub.sessions() as db:
        emit(db, "idea_created", campus_label="Almaty", data={"idea_title": "Food festival"})
        await db.commit()
        row = (await db.execute(select(Outbox))).scalar_one()
        assert row.kind == "idea_created"
        assert row.data == {"idea_title": "Food festival"}
        assert row.uid is not None
        assert row.shipped_at is None
