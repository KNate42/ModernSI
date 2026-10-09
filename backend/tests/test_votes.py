"""
Votes: idempotent vote/unvote, own idea, unconfirmed users, the threshold transition and its race.
This work made by Anfinogentov Nikita
"""
import asyncio
import uuid

from sqlalchemy import func, select, update

from modernsi.feed.models import Outbox
from modernsi.ideas.models import Idea
from modernsi.mail.models import MailQueue
from tests.helpers import login_as, make_user

festival = {"title": "International Food Festival", "summary": "One evening, one table per country.", "category": "event"}


async def new_idea(make_client, hub):
    author = await make_user(hub, email="aru@uni.edu", name="Aru")
    client = await login_as(make_client(), hub, author)
    return uuid.UUID((await client.post("/api/ideas", json=festival)).json()["id"]), client


async def voter(make_client, hub, number, **extra):
    user = await make_user(hub, email=f"v{number}@uni.edu", name=f"Voter {number}", **extra)
    return await login_as(make_client(), hub, user)


async def count(hub, model, *conditions):
    async with hub.sessions() as db:
        return (await db.execute(select(func.count()).select_from(model).where(*conditions))).scalar()


async def test_vote_and_unvote_are_idempotent(make_client, hub):
    idea_id, _ = await new_idea(make_client, hub)
    client = await voter(make_client, hub, 1)
    first = await client.post(f"/api/ideas/{idea_id}/vote")
    assert first.status_code == 200
    assert first.json() == {"vote_count": 1, "status": "open", "my_vote": True}
    assert (await client.post(f"/api/ideas/{idea_id}/vote")).json()["vote_count"] == 1
    assert (await client.get(f"/api/ideas/{idea_id}")).json()["my_vote"] is True
    assert (await client.delete(f"/api/ideas/{idea_id}/vote")).json() == {"vote_count": 0, "status": "open", "my_vote": False}
    assert (await client.delete(f"/api/ideas/{idea_id}/vote")).json()["vote_count"] == 0


async def test_cannot_vote_for_own_idea(make_client, hub):
    idea_id, author = await new_idea(make_client, hub)
    response = await author.post(f"/api/ideas/{idea_id}/vote")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "own_idea"


async def test_unconfirmed_and_anonymous_cannot_vote(make_client, hub):
    idea_id, _ = await new_idea(make_client, hub)
    assert (await make_client().post(f"/api/ideas/{idea_id}/vote")).status_code == 401
    pending = await voter(make_client, hub, 1, status="pending")
    response = await pending.post(f"/api/ideas/{idea_id}/vote")
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "email_not_verified"


async def test_threshold_moves_to_review(make_client, hub, settings, monkeypatch):
    monkeypatch.setattr(settings, "vote_threshold", 2)
    idea_id, _ = await new_idea(make_client, hub)
    await (await voter(make_client, hub, 1)).post(f"/api/ideas/{idea_id}/vote")
    second = await (await voter(make_client, hub, 2)).post(f"/api/ideas/{idea_id}/vote")
    assert second.json() == {"vote_count": 2, "status": "in_review", "my_vote": True}
    late = await voter(make_client, hub, 3)
    response = await late.post(f"/api/ideas/{idea_id}/vote")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "voting_closed"
    assert await count(hub, Outbox, Outbox.kind == "idea_reached_review") == 1
    assert await count(hub, MailQueue, MailQueue.to_email == "aru@uni.edu") == 1


async def test_unvote_after_review_is_closed(make_client, hub, settings, monkeypatch):
    monkeypatch.setattr(settings, "vote_threshold", 1)
    idea_id, _ = await new_idea(make_client, hub)
    client = await voter(make_client, hub, 1)
    await client.post(f"/api/ideas/{idea_id}/vote")
    response = await client.delete(f"/api/ideas/{idea_id}/vote")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "voting_closed"


async def test_race_at_threshold_moves_once(make_client, hub, settings, monkeypatch):
    monkeypatch.setattr(settings, "vote_threshold", 3)
    idea_id, _ = await new_idea(make_client, hub)
    clients = [await voter(make_client, hub, number) for number in range(6)]
    responses = await asyncio.gather(*(client.post(f"/api/ideas/{idea_id}/vote") for client in clients))
    codes = sorted(response.status_code for response in responses)
    assert codes == [200, 200, 200, 409, 409, 409]
    async with hub.sessions() as db:
        idea = await db.get(Idea, idea_id)
        assert idea.vote_count == 3
        assert idea.status == "in_review"
    assert await count(hub, Outbox, Outbox.kind == "idea_reached_review") == 1


async def test_hidden_idea_cannot_be_voted(make_client, hub):
    idea_id, _ = await new_idea(make_client, hub)
    async with hub.sessions() as db:
        await db.execute(update(Idea).where(Idea.id == idea_id).values(is_hidden=True))
        await db.commit()
    response = await (await voter(make_client, hub, 1)).post(f"/api/ideas/{idea_id}/vote")
    assert response.status_code == 404


async def test_vote_rate_limit(make_client, hub, settings, monkeypatch):
    monkeypatch.setattr(settings, "rl_votes_per_minute", 2)
    idea_id, _ = await new_idea(make_client, hub)
    client = await voter(make_client, hub, 1)
    await client.post(f"/api/ideas/{idea_id}/vote")
    await client.delete(f"/api/ideas/{idea_id}/vote")
    response = await client.post(f"/api/ideas/{idea_id}/vote")
    assert response.status_code == 429
