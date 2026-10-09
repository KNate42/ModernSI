"""
Events: standalone curator events, events grown from ideas, validation, RSVPs, listing filters.
This work made by Anfinogentov Nikita
"""
import uuid
from datetime import timedelta

from sqlalchemy import select, update

from modernsi.core.db import utcnow
from modernsi.events.models import Event
from modernsi.feed.models import Outbox
from modernsi.ideas.models import Idea, IdeaTeamMember
from modernsi.mail.models import MailQueue
from tests.helpers import login_as, make_user


def when(days, hours=2):
    start = utcnow() + timedelta(days=days)
    return {"starts_at": start.isoformat(), "ends_at": (start + timedelta(hours=hours)).isoformat()}


def event_body(**extra):
    return {"title": "Conversation night", "description_md": "Bring a friend.", "location_text": "Student lounge", **when(3), **extra}


async def seed_team_idea(hub, author, members, status="forming_team", category="volunteering"):
    async with hub.sessions() as db:
        idea = Idea(
            author_id=author.id, title="Autumn volunteering day", summary="Clean the city park together.",
            category=category, scope="campus", campus_label=author.campus_label, status=status,
            team_size=1 + len(members), expires_at=utcnow() + timedelta(days=60),
        )
        db.add(idea)
        await db.flush()
        for member in [author, *members]:
            db.add(IdeaTeamMember(idea_id=idea.id, user_id=member.id))
        await db.commit()
        return idea.id


async def test_curator_publishes_standalone_event(make_client, hub):
    curator = await login_as(make_client(), hub, await make_user(hub, email="cur@uni.edu", name="Cur", role="curator"))
    response = await curator.post("/api/events", json=event_body())
    assert response.status_code == 201
    event = response.json()
    assert event["created_by"]["display_name"] == "Cur"
    assert event["campus_label"] is None
    assert event["idea_id"] is None
    assert event["going_count"] == 0
    assert event["is_past"] is False
    listed = (await make_client().get("/api/events")).json()["items"]
    assert [item["title"] for item in listed] == ["Conversation night"]


async def test_student_cannot_publish_standalone(make_client, hub):
    student = await login_as(make_client(), hub, await make_user(hub))
    response = await student.post("/api/events", json=event_body())
    assert response.status_code == 403


async def test_event_time_validation(make_client, hub):
    curator = await login_as(make_client(), hub, await make_user(hub, email="cur@uni.edu", name="Cur", role="curator"))
    naive = event_body(starts_at="2030-11-01T18:00:00", ends_at="2030-11-01T20:00:00")
    assert (await curator.post("/api/events", json=naive)).status_code == 422
    backwards = event_body(starts_at=when(3)["ends_at"], ends_at=when(3)["starts_at"])
    assert (await curator.post("/api/events", json=backwards)).json()["error"]["code"] == "bad_time_range"
    past = event_body(**when(-1))
    assert (await curator.post("/api/events", json=past)).json()["error"]["code"] == "starts_in_past"
    nowhere = event_body(location_text=None)
    assert (await curator.post("/api/events", json=nowhere)).json()["error"]["code"] == "location_required"
    online = event_body(location_text=None, online_url="https://meet.example.org/room")
    assert (await curator.post("/api/events", json=online)).status_code == 201


async def test_event_from_idea(make_client, hub, settings):
    author = await make_user(hub, email="aru@uni.edu", name="Aru")
    members = [await make_user(hub, email=f"m{number}@uni.edu", name=f"M{number}") for number in range(settings.team_min - 1)]
    idea_id = await seed_team_idea(hub, author, members)
    author_client = await login_as(make_client(), hub, author)
    stranger = await login_as(make_client(), hub, await make_user(hub, email="s@uni.edu", name="S"))
    refused = await stranger.post("/api/events", json=event_body(idea_id=str(idea_id)))
    assert refused.status_code == 403
    assert refused.json()["error"]["message"] == "Only the author or a curator can put this idea on the calendar"
    response = await author_client.post("/api/events", json=event_body(idea_id=str(idea_id), scope="network"))
    assert response.status_code == 201
    event = response.json()
    assert event["idea_title"] == "Autumn volunteering day"
    assert event["campus_label"] == "Almaty"
    assert (await author_client.get(f"/api/ideas/{idea_id}")).json()["status"] == "live"
    by_idea = (await make_client().get("/api/events", params={"idea": str(idea_id)})).json()["items"]
    assert [item["id"] for item in by_idea] == [event["id"]]
    async with hub.sessions() as db:
        outbox = (await db.execute(select(Outbox).where(Outbox.kind == "event_published"))).scalar_one()
        assert outbox.idea_id == idea_id
        recipients = set((await db.execute(select(MailQueue.to_email))).scalars().all())
        assert recipients == {member.email for member in members}


async def test_small_team_or_wrong_state_blocks_event(make_client, hub):
    author = await make_user(hub, email="aru@uni.edu", name="Aru")
    small = await seed_team_idea(hub, author, [])
    client = await login_as(make_client(), hub, author)
    assert (await client.post("/api/events", json=event_body(idea_id=str(small)))).json()["error"]["code"] == "team_too_small"
    still_open = await seed_team_idea(hub, author, [], status="open")
    assert (await client.post("/api/events", json=event_body(idea_id=str(still_open)))).json()["error"]["code"] == "idea_not_ready"


async def test_rsvp(make_client, hub):
    curator = await login_as(make_client(), hub, await make_user(hub, email="cur@uni.edu", name="Cur", role="curator"))
    event_id = (await curator.post("/api/events", json=event_body())).json()["id"]
    assert (await make_client().post(f"/api/events/{event_id}/rsvp")).status_code == 401
    student = await login_as(make_client(), hub, await make_user(hub))
    assert (await student.post(f"/api/events/{event_id}/rsvp")).json() == {"going_count": 1, "i_am_going": True}
    assert (await student.post(f"/api/events/{event_id}/rsvp")).json()["going_count"] == 1
    assert (await student.get(f"/api/events/{event_id}")).json()["i_am_going"] is True
    going = (await student.get("/api/events", params={"going": "true"})).json()["items"]
    assert [item["id"] for item in going] == [event_id]
    assert (await student.delete(f"/api/events/{event_id}/rsvp")).json() == {"going_count": 0, "i_am_going": False}


async def test_rsvp_to_finished_event(make_client, hub):
    curator = await login_as(make_client(), hub, await make_user(hub, email="cur@uni.edu", name="Cur", role="curator"))
    event_id = uuid.UUID((await curator.post("/api/events", json=event_body())).json()["id"])
    async with hub.sessions() as db:
        await db.execute(update(Event).where(Event.id == event_id).values(starts_at=utcnow() - timedelta(days=2), ends_at=utcnow() - timedelta(days=1)))
        await db.commit()
    response = await curator.post(f"/api/events/{event_id}/rsvp")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "event_over"
    past = (await curator.get("/api/events", params={"when": "past"})).json()["items"]
    assert past[0]["is_past"] is True
    assert (await curator.get("/api/events")).json()["items"] == []


async def test_category_filter_follows_idea(make_client, hub, settings):
    author = await make_user(hub, email="aru@uni.edu", name="Aru")
    members = [await make_user(hub, email=f"m{number}@uni.edu", name=f"M{number}") for number in range(settings.team_min - 1)]
    idea_id = await seed_team_idea(hub, author, members, category="academic")
    client = await login_as(make_client(), hub, author)
    await client.post("/api/events", json=event_body(idea_id=str(idea_id), title="Peer tutoring hour"))
    curator = await login_as(make_client(), hub, await make_user(hub, email="cur@uni.edu", name="Cur", role="curator"))
    await curator.post("/api/events", json=event_body(title="Board games and tea"))
    academic = (await make_client().get("/api/events", params={"category": "academic"})).json()["items"]
    assert [item["title"] for item in academic] == ["Peer tutoring hour"]


async def test_unknown_event(client):
    response = await client.get(f"/api/events/{uuid.uuid4()}")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "event_not_found"
