"""
Auth over HTTP: sign-up with a university e-mail, confirmation code, login/logout, blocked accounts.
This work made by Anfinogentov Nikita
"""
import re

from sqlalchemy import select

from modernsi.campuses.service import add_domain
from modernsi.feed.models import Outbox
from tests.helpers import last_mail, login_as, make_user

signup = {"email": "aru@uni.edu", "password": "correct horse battery", "display_name": "Aru"}


async def allow(hub, domain="uni.edu"):
    async with hub.sessions() as db:
        await add_domain(db, domain, "Almaty", "KZ")


async def code_for(email):
    mail = await last_mail(email, "code")
    return re.search(r"\b(\d{6})\b", mail["subject"]).group(1)


async def test_register_verify_me(client, hub):
    await allow(hub)
    response = await client.post("/api/auth/register", json={**signup, "email": " Aru@Uni.EDU "})
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "aru@uni.edu"
    assert body["status"] == "pending"
    assert body["campus_label"] == "Almaty"
    assert body["role"] == "student"

    response = await client.post("/api/auth/verify", json={"code": await code_for("aru@uni.edu")})
    assert response.status_code == 200
    assert response.json()["status"] == "active"
    assert (await client.get("/api/auth/me")).json()["status"] == "active"

    async with hub.sessions() as db:
        row = (await db.execute(select(Outbox).where(Outbox.kind == "user_verified"))).scalar_one()
        assert row.campus_label == "Almaty"
        assert row.data == {"display_name": "Aru"}


async def test_session_cookie_flags(client, hub):
    await allow(hub)
    response = await client.post("/api/auth/register", json=signup)
    cookie = response.headers["set-cookie"].lower()
    assert "msi_session=" in cookie
    assert "httponly" in cookie
    assert "samesite=lax" in cookie
    assert "path=/" in cookie


async def test_unknown_domain_is_rejected(client, hub):
    response = await client.post("/api/auth/register", json={**signup, "email": "aru@gmail.com"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "domain_not_allowed"


async def test_same_email_in_other_case_is_taken(make_client, hub):
    await allow(hub)
    assert (await make_client().post("/api/auth/register", json=signup)).status_code == 201
    response = await make_client().post("/api/auth/register", json={**signup, "email": "ARU@uni.edu "})
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "email_taken"


async def test_short_password_is_validation_error(client, hub):
    await allow(hub)
    response = await client.post("/api/auth/register", json={**signup, "password": "short"})
    assert response.status_code == 422
    assert response.json()["error"]["fields"][0]["field"] == "password"


async def test_wrong_code(client, hub):
    await allow(hub)
    await client.post("/api/auth/register", json=signup)
    real = await code_for("aru@uni.edu")
    wrong = "000000" if real != "000000" else "111111"
    response = await client.post("/api/auth/verify", json={"code": wrong})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_code"


async def test_verify_needs_session(client):
    response = await client.post("/api/auth/verify", json={"code": "123456"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "not_authenticated"


async def test_resend_has_cooldown(client, hub):
    await allow(hub)
    await client.post("/api/auth/register", json=signup)
    response = await client.post("/api/auth/verify/resend")
    assert response.status_code == 429
    assert response.json()["error"]["code"] == "code_cooldown"


async def test_login_and_logout(client, hub):
    await make_user(hub)
    bad = await client.post("/api/auth/login", json={"email": "aru@uni.edu", "password": "wrong password!"})
    assert bad.status_code == 401
    assert bad.json()["error"]["code"] == "invalid_credentials"
    good = await client.post("/api/auth/login", json={"email": " ARU@uni.edu", "password": "correct horse battery"})
    assert good.status_code == 200
    assert (await client.get("/api/auth/me")).status_code == 200
    assert (await client.post("/api/auth/logout")).status_code == 204
    assert (await client.get("/api/auth/me")).status_code == 401


async def test_unknown_email_gets_same_error(client, hub):
    response = await client.post("/api/auth/login", json={"email": "nobody@uni.edu", "password": "whatever123"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_credentials"


async def test_logout_all_ends_other_sessions(make_client, hub):
    user = await make_user(hub)
    laptop = await login_as(make_client(), hub, user)
    phone = await login_as(make_client(), hub, user)
    assert (await laptop.post("/api/auth/logout-all")).status_code == 204
    assert (await phone.get("/api/auth/me")).status_code == 401


async def test_blocked_user_cannot_login(client, hub):
    await make_user(hub, status="blocked")
    response = await client.post("/api/auth/login", json={"email": "aru@uni.edu", "password": "correct horse battery"})
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "account_blocked"
