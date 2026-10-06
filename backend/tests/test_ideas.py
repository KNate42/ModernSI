"""
Ideas: who may create them, validation, listing and sorting, reading, editing rules.
This work made by Anfinogentov Nikita
"""
import uuid
from datetime import timedelta

from sqlalchemy import select, update

from modernsi.core.db import utcnow
from modernsi.feed.models import Outbox
from modernsi.ideas.models import Idea, IdeaVote
from tests.helpers import login_as, make_user

festival = {
    "title": "International Food Festival",
    "summary": "One evening, one table per country, dishes from home.",
    "body_md": "**Plan**: cook and share.",
    "category": "event",
    "scope": "network",
}


async def author_client(make_client, hub, email="aru@uni.edu", name="Aru", **extra):
    user = await make_user(hub, email=email, name=name, **extra)
    return await login_as(make_client(), hub, user), user


async def test_create_needs_confirmed_account(make_client, hub):
    assert (await make_client().post("/api/ideas", json=festival)).status_code == 401
    pending, _ = await author_client(make_client, hub, status="pending")
    response = await pending.post("/api/ideas", json=festival)
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "email_not_verified"


async def test_create_and_read(make_client, hub):
    client, user = await author_client(make_client, hub)
    response = await client.post("/api/ideas", json=festival)
    assert response.status_code == 201
    idea = response.json()
    assert idea["status"] == "open"
    assert idea["vote_count"] == 0
    assert idea["vote_threshold"] == 50
    assert idea["team_min"] == 3
    assert idea["author"] == {"id": str(user.id), "display_name": "Aru", "campus_label": "Almaty"}
    assert idea["campus_label"] == "Almaty"
    assert "<strong>Plan</strong>" in idea["body_html"]
    assert idea["is_author"] is True and idea["can_edit"] is True
    public = (await make_client().get(f"/api/ideas/{idea['id']}")).json()
    assert public["is_author"] is False
    assert public["my_vote"] is False
    async with hub.sessions() as db:
        row = (await db.execute(select(Outbox).where(Outbox.kind == "idea_created"))).scalar_one()
        assert row.data == {"actor_name": "Aru", "idea_title": "International Food Festival", "category": "event"}


async def test_expiry_is_sixty_days(make_client, hub):
    client, _ = await author_client(make_client, hub)
    idea = (await client.post("/api/ideas", json=festival)).json()
    async with hub.sessions() as db:
        row = await db.get(Idea, uuid.UUID(idea["id"]))
        assert timedelta(days=59, hours=23) < row.expires_at - row.created_at <= timedelta(days=60, seconds=5)


async def test_validation(make_client, hub):
    client, _ = await author_client(make_client, hub)
    response = await client.post("/api/ideas", json={**festival, "title": "Hi"})
    assert response.status_code == 422
    assert response.json()["error"]["fields"][0]["field"] == "title"
    response = await client.post("/api/ideas", json={**festival, "category": "party"})
    assert response.status_code == 422


async def test_unknown_idea(client):
    response = await client.get("/api/ideas/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "idea_not_found"


async def test_list_new_and_filters(make_client, hub):
    client, _ = await author_client(make_client, hub)
    await client.post("/api/ideas", json=festival)
    await client.post("/api/ideas", json={**festival, "title": "Peer tutoring hour", "category": "academic"})
    await client.post("/api/ideas", json={**festival, "title": "Open data hackathon", "category": "research", "scope": "campus"})
    everything = (await make_client().get("/api/ideas")).json()
    assert [item["title"] for item in everything["items"]] == ["Open data hackathon", "Peer tutoring hour", "International Food Festival"]
    academic = (await make_client().get("/api/ideas", params=[("category", "academic"), ("category", "research")])).json()
    assert {item["title"] for item in academic["items"]} == {"Peer tutoring hour", "Open data hackathon"}
    campus = (await make_client().get("/api/ideas", params={"scope": "campus"})).json()
    assert [item["title"] for item in campus["items"]] == ["Open data hackathon"]


async def test_pagination_and_bad_cursor(make_client, hub):
    client, _ = await author_client(make_client, hub)
    for number in range(3):
        await client.post("/api/ideas", json={**festival, "title": f"Idea number {number}"})
    first = (await client.get("/api/ideas", params={"limit": 2})).json()
    assert len(first["items"]) == 2 and first["next_cursor"]
    second = (await client.get("/api/ideas", params={"limit": 2, "cursor": first["next_cursor"]})).json()
    assert len(second["items"]) == 1 and second["next_cursor"] is None
    assert (await client.get("/api/ideas", params={"cursor": "x"})).json()["error"]["code"] == "bad_cursor"


async def test_closest_and_trending(make_client, hub):
    client, _ = await author_client(make_client, hub)
    slow = (await client.post("/api/ideas", json={**festival, "title": "Old favourite"})).json()
    fast = (await client.post("/api/ideas", json={**festival, "title": "Rising star"})).json()
    voters = [await make_user(hub, email=f"v{number}@uni.edu", name=f"V{number}") for number in range(3)]
    slow_id, fast_id = uuid.UUID(slow["id"]), uuid.UUID(fast["id"])
    async with hub.sessions() as db:
        long_ago = utcnow() - timedelta(days=20)
        for voter in voters:
            db.add(IdeaVote(idea_id=slow_id, user_id=voter.id, created_at=long_ago))
        db.add(IdeaVote(idea_id=fast_id, user_id=voters[0].id))
        await db.execute(update(Idea).where(Idea.id == slow_id).values(vote_count=3))
        await db.execute(update(Idea).where(Idea.id == fast_id).values(vote_count=1))
        await db.commit()
    closest = (await client.get("/api/ideas", params={"sort": "closest"})).json()["items"]
    assert [item["title"] for item in closest] == ["Old favourite", "Rising star"]
    trending = (await client.get("/api/ideas", params={"sort": "trending"})).json()["items"]
    assert [item["title"] for item in trending] == ["Rising star", "Old favourite"]


async def test_mine_authored(make_client, hub):
    assert (await make_client().get("/api/ideas", params={"mine": "authored"})).status_code == 401
    aru, _ = await author_client(make_client, hub)
    dana, _ = await author_client(make_client, hub, email="dana@uni.edu", name="Dana")
    await aru.post("/api/ideas", json=festival)
    await dana.post("/api/ideas", json={**festival, "title": "Dana's idea here"})
    mine = (await aru.get("/api/ideas", params={"mine": "authored"})).json()["items"]
    assert [item["title"] for item in mine] == ["International Food Festival"]


async def test_edit_rules(make_client, hub):
    aru, _ = await author_client(make_client, hub)
    dana, _ = await author_client(make_client, hub, email="dana@uni.edu", name="Dana")
    idea = (await aru.post("/api/ideas", json=festival)).json()
    response = await aru.patch(f"/api/ideas/{idea['id']}", json={"summary": "A new and better summary text."})
    assert response.status_code == 200
    assert response.json()["summary"] == "A new and better summary text."
    response = await dana.patch(f"/api/ideas/{idea['id']}", json={"summary": "Hijacked summary text here."})
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "not_author"
    response = await aru.patch(f"/api/ideas/{idea['id']}", json={"category": "club"})
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "category_locked"
    async with hub.sessions() as db:
        await db.execute(update(Idea).where(Idea.id == uuid.UUID(idea["id"])).values(status="in_review"))
        await db.commit()
    response = await aru.patch(f"/api/ideas/{idea['id']}", json={"summary": "Too late to change this."})
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "idea_locked"


async def test_create_rate_limit(make_client, hub):
    client, _ = await author_client(make_client, hub)
    for number in range(5):
        assert (await client.post("/api/ideas", json={**festival, "title": f"Idea number {number}"})).status_code == 201
    response = await client.post("/api/ideas", json={**festival, "title": "One idea too many"})
    assert response.status_code == 429
