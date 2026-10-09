"""
The demo network: it fills every page with believable made-up data, its accounts can log in,
running it again changes nothing but the event dates, and going live blocks every demo account.
This work made by Anfinogentov Nikita
"""
from datetime import timedelta

from sqlalchemy import func, select

from modernsi.auth.models import User
from modernsi.core.db import utcnow
from modernsi.demo import accounts, demo_id, disable_demo, seed_demo
from modernsi.events.models import Event, EventRsvp
from modernsi.feed.models import Outbox
from modernsi.feed.shipper import ship_outbox
from modernsi.ideas.models import Idea, IdeaVote


async def counts(hub):
    async with hub.sessions() as db:
        result = {}
        for model in (User, Idea, IdeaVote, Event, EventRsvp, Outbox):
            result[model.__name__] = (await db.execute(select(func.count()).select_from(model))).scalar_one()
        return result


async def test_demo_fills_the_site(hub, settings, client):
    assert await seed_demo(hub, settings) == "created"
    async with hub.sessions() as db:
        statuses = set((await db.execute(select(Idea.status))).scalars().all())
        assert statuses == {"open", "in_review", "needs_changes", "rejected", "forming_team", "live", "done", "expired"}
        # every vote count matches its vote rows
        for idea in (await db.execute(select(Idea))).scalars().all():
            votes = (await db.execute(select(func.count()).where(IdeaVote.idea_id == idea.id))).scalar_one()
            assert votes == idea.vote_count
        for event in (await db.execute(select(Event))).scalars().all():
            going = (await db.execute(select(func.count()).where(EventRsvp.event_id == event.id))).scalar_one()
            assert going == event.going_count
        users = (await db.execute(select(User))).scalars().all()
        assert all(user.email.endswith(".demo.example") for user in users)

    upcoming = (await client.get("/api/events")).json()["items"]
    week = [item for item in upcoming if item["starts_at"] < (utcnow() + timedelta(days=7)).isoformat()]
    assert len(week) >= 4
    assert (await client.get("/api/ideas?status=open")).json()["items"]

    # the outbox reaches ClickHouse, the feed has stories and the homepage counters switch on
    while await ship_outbox(hub):
        pass
    assert len((await client.get("/api/feed?limit=12")).json()["items"]) == 12
    stats = (await client.get("/api/stats")).json()
    assert stats["show_counters"] is True
    assert stats["campuses"] == 4

    for email, _name, role, _bio in accounts:
        response = await client.post("/api/auth/login", json={"email": email, "password": settings.demo_password})
        assert response.status_code == 200
        assert response.json()["role"] == role
    profile = (await client.get(f"/api/profiles/{demo_id('user', accounts[0][0])}")).json()
    assert profile["bio"].startswith("Second-year economics")


async def test_demo_runs_again_without_duplicates(hub, settings):
    assert await seed_demo(hub, settings) == "created"
    before = await counts(hub)
    async with hub.sessions() as db:
        # pretend the stack was off for a month: the events are over and the worker closed the idea
        event = await db.get(Event, demo_id("event", "cooking"))
        event.starts_at -= timedelta(days=30)
        event.ends_at -= timedelta(days=30)
        (await db.get(Idea, demo_id("idea", "cooking"))).status = "done"
        (await db.get(Idea, demo_id("idea", "hike"))).status = "expired"
        await db.commit()
    assert await seed_demo(hub, settings) == "refreshed"
    assert await counts(hub) == before
    async with hub.sessions() as db:
        event = await db.get(Event, demo_id("event", "cooking"))
        assert utcnow() < event.starts_at < utcnow() + timedelta(days=2)
        assert (await db.get(Idea, demo_id("idea", "cooking"))).status == "live"
        assert (await db.get(Idea, demo_id("idea", "hike"))).status == "open"


async def test_demo_password_follows_the_settings(hub, settings, client):
    assert await seed_demo(hub, settings) == "created"
    # a public demo gets its own random password in .env; a refresh moves the accounts to it
    assert await seed_demo(hub, settings.model_copy(update={"demo_password": "another-secret-1"})) == "refreshed"
    email = accounts[-1][0]
    assert (await client.post("/api/auth/login", json={"email": email, "password": settings.demo_password})).status_code == 401
    assert (await client.post("/api/auth/login", json={"email": email, "password": "another-secret-1"})).status_code == 200


async def test_going_live_closes_the_demo(hub, settings, make_client):
    assert await seed_demo(hub, settings) == "created"
    admin = make_client()
    email = accounts[-1][0]
    assert (await admin.post("/api/auth/login", json={"email": email, "password": settings.demo_password})).status_code == 200
    assert (await admin.get("/api/auth/me")).status_code == 200

    assert await disable_demo(hub) == 60
    # the open session ends, the known password no longer opens the account, and demo sign-ups stop
    assert (await admin.get("/api/auth/me")).status_code == 401
    other = make_client()
    assert (await other.post("/api/auth/login", json={"email": email, "password": settings.demo_password})).status_code != 200
    signup = await other.post("/api/auth/register", json={"email": "new.person@almaty.demo.example", "password": "long-enough-pass", "display_name": "New Person"})
    assert signup.status_code != 201
    assert await disable_demo(hub) == 0

    # switching the demo back on opens the seeded accounts again
    assert await seed_demo(hub, settings) == "refreshed"
    assert (await other.post("/api/auth/login", json={"email": email, "password": settings.demo_password})).status_code == 200
