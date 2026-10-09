"""
Admin API: domains, domain requests, roles, blocking; the public campus list; CLI admin creation.
This work made by Anfinogentov Nikita
"""
from sqlalchemy import select

from modernsi.auth.service import create_admin
from modernsi.campuses.service import find_domain
from modernsi.mail.models import MailQueue
from tests.helpers import login_as, make_user


async def admin_client(make_client, hub):
    admin = await make_user(hub, email="boss@uni.edu", name="Boss", role="admin")
    return await login_as(make_client(), hub, admin)


async def test_admin_routes_are_closed(make_client, hub):
    assert (await make_client().get("/api/admin/domains")).status_code == 401
    student = await login_as(make_client(), hub, await make_user(hub))
    response = await student.get("/api/admin/domains")
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "forbidden"


async def test_add_domain_shows_in_campus_list(make_client, hub):
    admin = await admin_client(make_client, hub)
    response = await admin.post("/api/admin/domains", json={"domain": "tbilisi.edu", "campus_label": "Tbilisi", "country_code": "ge"})
    assert response.status_code == 201
    assert response.json()["country_code"] == "GE"
    campuses = (await make_client().get("/api/campuses")).json()
    assert {"campus_label": "Tbilisi", "country_code": "GE", "students": 0} in campuses


async def test_campus_list_counts_only_active_students(make_client, hub):
    await make_user(hub, email="a@uni.edu")
    await make_user(hub, email="b@uni.edu")
    await make_user(hub, email="c@uni.edu", status="pending")
    campuses = (await make_client().get("/api/campuses")).json()
    assert campuses == [{"campus_label": "Almaty", "country_code": "KZ", "students": 2}]


async def test_approve_domain_request(make_client, hub):
    admin = await admin_client(make_client, hub)
    body = {"domain": "newcampus.edu", "university_name": "New Campus University", "requester_email": "dana@newcampus.edu"}
    request_id = (await make_client().post("/api/campuses/requests", json=body)).json()["id"]
    pending = (await admin.get("/api/admin/domain-requests")).json()
    assert [row["id"] for row in pending] == [request_id]
    response = await admin.post(f"/api/admin/domain-requests/{request_id}/approve", json={"campus_label": "Yerevan", "country_code": "AM"})
    assert response.status_code == 200
    assert response.json()["status"] == "approved"
    async with hub.sessions() as db:
        assert (await find_domain(db, "dana@newcampus.edu")).campus_label == "Yerevan"
        mail = (await db.execute(select(MailQueue))).scalar_one()
        assert mail.to_email == "dana@newcampus.edu"
        assert "newcampus.edu" in mail.body


async def test_reject_domain_request(make_client, hub):
    admin = await admin_client(make_client, hub)
    body = {"domain": "newcampus.edu", "university_name": "New Campus University", "requester_email": "dana@newcampus.edu"}
    request_id = (await make_client().post("/api/campuses/requests", json=body)).json()["id"]
    response = await admin.post(f"/api/admin/domain-requests/{request_id}/reject")
    assert response.json()["status"] == "rejected"
    assert (await admin.get("/api/admin/domain-requests")).json() == []


async def test_set_role(make_client, hub):
    admin = await admin_client(make_client, hub)
    user = await make_user(hub)
    response = await admin.put(f"/api/admin/users/{user.id}/role", json={"role": "student_gov"})
    assert response.status_code == 200
    assert response.json()["role"] == "student_gov"
    bad = await admin.put(f"/api/admin/users/{user.id}/role", json={"role": "king"})
    assert bad.status_code == 422


async def test_block_ends_live_session(make_client, hub):
    admin = await admin_client(make_client, hub)
    user = await make_user(hub)
    student = await login_as(make_client(), hub, user)
    assert (await student.get("/api/auth/me")).status_code == 200
    assert (await admin.post(f"/api/admin/users/{user.id}/block")).json()["status"] == "blocked"
    assert (await student.get("/api/auth/me")).status_code == 401
    assert (await admin.post(f"/api/admin/users/{user.id}/unblock")).json()["status"] == "active"


async def test_admin_cannot_block_self(make_client, hub):
    admin = await admin_client(make_client, hub)
    me = (await admin.get("/api/auth/me")).json()
    response = await admin.post(f"/api/admin/users/{me['id']}/block")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "cannot_block_self"


async def test_search_users(make_client, hub):
    admin = await admin_client(make_client, hub)
    await make_user(hub, email="aru@uni.edu", name="Aru")
    rows = (await admin.get("/api/admin/users", params={"q": "aru"})).json()
    assert [row["email"] for row in rows] == ["aru@uni.edu"]


async def test_create_admin_without_allowed_domain(hub):
    async with hub.sessions() as db:
        user = await create_admin(db, "Owner@Example.com", "Owner", "a long admin password")
    assert user.email == "owner@example.com"
    assert user.role == "admin"
    assert user.status == "active"
    assert user.campus_label is None
