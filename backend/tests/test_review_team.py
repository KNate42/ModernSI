"""
Student Government review, resubmission after changes, team forming, reports and hiding.
This work made by Anfinogentov Nikita
"""
import uuid
from datetime import timedelta

from sqlalchemy import func, select

from modernsi.core.db import utcnow
from modernsi.feed.models import Outbox
from modernsi.feed.outbox import emit
from modernsi.feed.shipper import ship_outbox
from modernsi.ideas.models import Idea, IdeaTeamMember
from modernsi.mail.models import MailQueue
from tests.helpers import login_as, make_user


async def seed_idea(hub, author, status, vote_count=0):
    async with hub.sessions() as db:
        idea = Idea(
            author_id=author.id, title="International Food Festival", summary="One evening, one table per country.",
            category="event", scope="network", campus_label=author.campus_label, status=status,
            vote_count=vote_count, expires_at=utcnow() + timedelta(days=60),
        )
        db.add(idea)
        await db.commit()
        return idea.id


async def people(make_client, hub):
    author = await make_user(hub, email="aru@uni.edu", name="Aru")
    gov = await make_user(hub, email="gov@uni.edu", name="Gov", role="student_gov")
    return author, await login_as(make_client(), hub, author), await login_as(make_client(), hub, gov)


async def count(hub, model, *conditions):
    async with hub.sessions() as db:
        return (await db.execute(select(func.count()).select_from(model).where(*conditions))).scalar()


async def test_only_student_government_decides(make_client, hub):
    author, author_client, _ = await people(make_client, hub)
    idea_id = await seed_idea(hub, author, "in_review")
    student = await login_as(make_client(), hub, await make_user(hub, email="s@uni.edu", name="S"))
    response = await student.post(f"/api/ideas/{idea_id}/decision", json={"decision": "approve"})
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "forbidden"


async def test_decision_needs_review_state_and_note(make_client, hub):
    author, _, gov = await people(make_client, hub)
    open_id = await seed_idea(hub, author, "open")
    response = await gov.post(f"/api/ideas/{open_id}/decision", json={"decision": "approve"})
    assert response.json()["error"]["code"] == "not_in_review"
    review_id = await seed_idea(hub, author, "in_review")
    response = await gov.post(f"/api/ideas/{review_id}/decision", json={"decision": "reject", "note": "  "})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "note_required"


async def test_approve_starts_team_with_author(make_client, hub):
    author, _, gov = await people(make_client, hub)
    idea_id = await seed_idea(hub, author, "in_review", vote_count=50)
    response = await gov.post(f"/api/ideas/{idea_id}/decision", json={"decision": "approve", "note": "Great, go ahead"})
    body = response.json()
    assert body["status"] == "forming_team"
    assert body["team_size"] == 1
    assert [member["display_name"] for member in body["team"]] == ["Aru"]
    assert body["review_note"] == "Great, go ahead"
    assert await count(hub, Outbox, Outbox.kind == "idea_decided") == 1
    async with hub.sessions() as db:
        mail = (await db.execute(select(MailQueue).where(MailQueue.to_email == "aru@uni.edu"))).scalar_one()
        assert "approved" in mail.subject


async def test_needs_changes_then_resubmit(make_client, hub):
    author, author_client, gov = await people(make_client, hub)
    idea_id = await seed_idea(hub, author, "in_review", vote_count=50)
    await gov.post(f"/api/ideas/{idea_id}/decision", json={"decision": "needs_changes", "note": "Add a budget"})
    edited = await author_client.patch(f"/api/ideas/{idea_id}", json={"body_md": "Budget: 200 USD for ingredients."})
    assert edited.status_code == 200
    stranger = await login_as(make_client(), hub, await make_user(hub, email="s@uni.edu", name="S"))
    assert (await stranger.post(f"/api/ideas/{idea_id}/resubmit")).json()["error"]["code"] == "not_author"
    response = await author_client.post(f"/api/ideas/{idea_id}/resubmit")
    assert response.status_code == 200
    assert response.json()["status"] == "in_review"
    assert response.json()["vote_count"] == 50
    assert response.json()["review_note"] is None
    again = await author_client.post(f"/api/ideas/{idea_id}/resubmit")
    assert again.json()["error"]["code"] == "not_needs_changes"


async def test_team_forms_once(make_client, hub, settings):
    author, author_client, _ = await people(make_client, hub)
    idea_id = await seed_idea(hub, author, "forming_team")
    async with hub.sessions() as db:
        db.add(IdeaTeamMember(idea_id=idea_id, user_id=author.id))
        await db.execute(Idea.__table__.update().where(Idea.id == idea_id).values(team_size=1))
        await db.commit()
    first = await login_as(make_client(), hub, await make_user(hub, email="m1@uni.edu", name="M1"))
    second = await login_as(make_client(), hub, await make_user(hub, email="m2@uni.edu", name="M2"))
    assert (await first.post(f"/api/ideas/{idea_id}/team")).json() == {"team_size": 2, "in_team": True, "status": "forming_team"}
    assert (await first.post(f"/api/ideas/{idea_id}/team")).json()["team_size"] == 2
    assert (await second.post(f"/api/ideas/{idea_id}/team")).json()["team_size"] == settings.team_min
    assert (await second.delete(f"/api/ideas/{idea_id}/team")).json() == {"team_size": 2, "in_team": False, "status": "forming_team"}
    await second.post(f"/api/ideas/{idea_id}/team")
    assert await count(hub, Outbox, Outbox.kind == "team_formed") == 1
    assert await count(hub, MailQueue, MailQueue.subject.like("The team is ready%")) == 1
    response = await author_client.delete(f"/api/ideas/{idea_id}/team")
    assert response.json()["error"]["code"] == "author_cannot_leave"


async def test_cannot_join_before_approval(make_client, hub):
    author, _, _ = await people(make_client, hub)
    idea_id = await seed_idea(hub, author, "open")
    member = await login_as(make_client(), hub, await make_user(hub, email="m1@uni.edu", name="M1"))
    response = await member.post(f"/api/ideas/{idea_id}/team")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "team_closed"


async def test_report_once_and_admin_resolves(make_client, hub):
    author, _, _ = await people(make_client, hub)
    idea_id = await seed_idea(hub, author, "open")
    reporter = await login_as(make_client(), hub, await make_user(hub, email="r@uni.edu", name="R"))
    assert (await reporter.post(f"/api/ideas/{idea_id}/report", json={"reason": "This is spam, not an idea"})).status_code == 201
    again = await reporter.post(f"/api/ideas/{idea_id}/report", json={"reason": "Still spam, really"})
    assert again.json()["error"]["code"] == "already_reported"
    admin = await login_as(make_client(), hub, await make_user(hub, email="boss@uni.edu", name="Boss", role="admin"))
    reports = (await admin.get("/api/admin/reports")).json()
    assert [(row["idea_title"], row["reason"]) for row in reports] == [("International Food Festival", "This is spam, not an idea")]
    assert (await admin.post(f"/api/admin/reports/{reports[0]['id']}/resolve")).status_code == 200
    assert (await admin.get("/api/admin/reports")).json() == []


async def test_hidden_idea_disappears_everywhere(make_client, hub):
    author, author_client, _ = await people(make_client, hub)
    idea_id = await seed_idea(hub, author, "open")
    async with hub.sessions() as db:
        emit(db, "idea_created", actor_id=author.id, idea_id=idea_id, data={"idea_title": "International Food Festival"})
        emit(db, "user_verified", actor_id=author.id, data={"display_name": "Aru"})
        await db.commit()
    await ship_outbox(hub)
    admin = await login_as(make_client(), hub, await make_user(hub, email="boss@uni.edu", name="Boss", role="admin"))
    assert (await admin.post(f"/api/admin/ideas/{idea_id}/hide")).json() == {"id": str(idea_id), "is_hidden": True}
    guest = make_client()
    assert (await guest.get(f"/api/ideas/{idea_id}")).status_code == 404
    assert (await author_client.get(f"/api/ideas/{idea_id}")).json()["is_hidden"] is True
    assert (await guest.get("/api/ideas")).json()["items"] == []
    assert [item["kind"] for item in (await guest.get("/api/feed")).json()["items"]] == ["user_verified"]
    await admin.post(f"/api/admin/ideas/{idea_id}/unhide")
    assert (await guest.get(f"/api/ideas/{idea_id}")).status_code == 200


async def test_unknown_report_is_404(make_client, hub):
    admin = await login_as(make_client(), hub, await make_user(hub, email="boss@uni.edu", name="Boss", role="admin"))
    assert (await admin.post("/api/admin/reports/999/resolve")).status_code == 404
    assert (await admin.post(f"/api/admin/ideas/{uuid.uuid4()}/hide")).status_code == 404
