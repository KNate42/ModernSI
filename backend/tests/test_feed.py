"""
Feed: outbox -> ClickHouse shipping, at-least-once without duplicates, outages, pagination, stats, request log.
This work made by Anfinogentov Nikita
"""
import asyncio
import uuid
from datetime import timedelta

from sqlalchemy import func, select, update

from modernsi.core.db import utcnow
from modernsi.feed.models import Outbox
from modernsi.feed.outbox import emit
from modernsi.feed.shipper import purge_old, ship_outbox
from tests.helpers import login_as, make_user


async def emit_now(hub, kind="idea_created", **fields):
    async with hub.sessions() as db:
        emit(db, kind, **fields)
        await db.commit()


async def test_outbox_reaches_feed(client, hub):
    await emit_now(hub, campus_label="Almaty", data={"actor_name": "Aru", "idea_title": "Food festival"})
    assert await ship_outbox(hub) == 1
    assert await ship_outbox(hub) == 0
    items = (await client.get("/api/feed")).json()["items"]
    assert len(items) == 1
    assert items[0]["kind"] == "idea_created"
    assert items[0]["campus_label"] == "Almaty"
    assert items[0]["data"] == {"actor_name": "Aru", "idea_title": "Food festival"}
    assert items[0]["at"].endswith("Z") or items[0]["at"].endswith("+00:00")


async def test_shipping_twice_does_not_duplicate(client, hub):
    await emit_now(hub)
    await ship_outbox(hub)
    async with hub.sessions() as db:
        await db.execute(update(Outbox).values(shipped_at=None))
        await db.commit()
    assert await ship_outbox(hub) == 1
    assert len((await client.get("/api/feed")).json()["items"]) == 1


async def test_clickhouse_outage_keeps_rows(client, hub, monkeypatch):
    await emit_now(hub)

    async def unreachable():
        return None

    monkeypatch.setattr(hub, "get_clickhouse", unreachable)
    assert await ship_outbox(hub) == 0
    response = await client.get("/api/feed")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "feed_unavailable"
    assert (await client.get("/api/stats")).status_code == 503
    monkeypatch.undo()
    assert await ship_outbox(hub) == 1


async def test_failed_insert_rolls_back_and_reconnects(hub, monkeypatch):
    await emit_now(hub)
    client = await hub.get_clickhouse()

    async def broken_insert(*args, **kwargs):
        raise ConnectionError("clickhouse went away")

    monkeypatch.setattr(client, "insert", broken_insert)
    assert await ship_outbox(hub) == 0
    assert hub.clickhouse is None
    async with hub.sessions() as db:
        assert (await db.execute(select(func.count()).select_from(Outbox).where(Outbox.shipped_at.is_(None)))).scalar() == 1
    monkeypatch.undo()
    hub.clickhouse_tried_at = float("-inf")
    assert await ship_outbox(hub) == 1


async def test_pagination(client, hub):
    for number in range(3):
        await emit_now(hub, data={"n": number})
        # ClickHouse keeps milliseconds; I keep the rows apart so the order is unambiguous
        await asyncio.sleep(0.005)
    await ship_outbox(hub)
    first = (await client.get("/api/feed", params={"limit": 2})).json()
    assert [item["data"]["n"] for item in first["items"]] == [2, 1]
    assert first["next_cursor"]
    second = (await client.get("/api/feed", params={"limit": 2, "cursor": first["next_cursor"]})).json()
    assert [item["data"]["n"] for item in second["items"]] == [0]
    assert second["next_cursor"] is None


async def test_bad_cursor(client):
    response = await client.get("/api/feed", params={"cursor": "nonsense"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "bad_cursor"


async def test_mine_needs_login_and_filters(client, hub):
    assert (await client.get("/api/feed", params={"mine": "true"})).status_code == 401
    user = await make_user(hub)
    await emit_now(hub, actor_id=user.id, data={"n": "mine"})
    await emit_now(hub, actor_id=uuid.uuid4(), data={"n": "other"})
    await ship_outbox(hub)
    await login_as(client, hub, user)
    items = (await client.get("/api/feed", params={"mine": "true"})).json()["items"]
    assert [item["data"]["n"] for item in items] == ["mine"]


async def test_stats(client, hub, settings, monkeypatch):
    await emit_now(hub, "user_verified", actor_id=uuid.uuid4(), campus_label="Almaty")
    await emit_now(hub, "user_verified", actor_id=uuid.uuid4(), campus_label="Tbilisi")
    await emit_now(hub, "event_published", idea_id=uuid.uuid4(), event_id=uuid.uuid4())
    await emit_now(hub, "event_published", event_id=uuid.uuid4())
    await ship_outbox(hub)
    assert (await client.get("/api/stats")).json() == {"students": 2, "campuses": 2, "ideas_to_events": 1, "show_counters": False}
    monkeypatch.setattr(settings, "stats_min_students", 2)
    assert (await client.get("/api/stats")).json()["show_counters"] is True


async def test_request_log_reaches_clickhouse(client, app, hub):
    await client.get("/api/health")
    await app.state.request_log.flush()
    clickhouse = await hub.get_clickhouse()
    count = await clickhouse.command("SELECT count() FROM http_requests WHERE route = '/api/health' AND status = 200")
    assert count >= 1


async def test_purge_old_rows(hub):
    await emit_now(hub)
    async with hub.sessions() as db:
        await db.execute(update(Outbox).values(shipped_at=utcnow() - timedelta(days=8)))
        await db.commit()
    await purge_old(hub)
    async with hub.sessions() as db:
        assert (await db.execute(select(func.count()).select_from(Outbox))).scalar() == 0
