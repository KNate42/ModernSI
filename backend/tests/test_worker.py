"""
Worker round: ships the outbox, sends mail, expires stale ideas, closes ideas whose event is over.
This work made by Anfinogentov Nikita
"""
from datetime import timedelta

from modernsi.core.db import utcnow
from modernsi.events.models import Event
from modernsi.feed.outbox import emit
from modernsi.ideas.models import Idea
from modernsi.mail.queue import enqueue
from modernsi.worker import run_once
from tests.helpers import last_mail, make_user


async def test_worker_round(hub):
    author = await make_user(hub)
    async with hub.sessions() as db:
        stale = Idea(author_id=author.id, title="Stale idea here", summary="Nobody voted for this one.", category="club",
                     scope="network", status="open", expires_at=utcnow() - timedelta(minutes=1))
        fresh = Idea(author_id=author.id, title="Fresh idea here", summary="Still collecting votes now.", category="club",
                     scope="network", status="open", expires_at=utcnow() + timedelta(days=10))
        finished = Idea(author_id=author.id, title="Finished idea here", summary="Its event already happened.", category="event",
                        scope="network", status="live", expires_at=utcnow() + timedelta(days=10))
        db.add_all([stale, fresh, finished])
        await db.flush()
        db.add(Event(idea_id=finished.id, created_by=author.id, title="Done event", starts_at=utcnow() - timedelta(days=2),
                     ends_at=utcnow() - timedelta(days=1), location_text="Hall"))
        emit(db, "user_verified", actor_id=author.id, data={"display_name": "Aru"})
        enqueue(db, "aru@uni.edu", "Worker says hi", "Body")
        await db.commit()
        ids = (stale.id, fresh.id, finished.id)

    quick = await run_once(hub)
    assert quick == {"shipped": 1, "sent": 1, "expired": 0, "done": 0}
    assert (await last_mail("aru@uni.edu", "Worker says hi"))["text"].startswith("Body")

    full = await run_once(hub, periodic=True)
    assert full["expired"] == 1 and full["done"] == 1
    async with hub.sessions() as db:
        statuses = [(await db.get(Idea, idea_id)).status for idea_id in ids]
    assert statuses == ["expired", "open", "done"]
