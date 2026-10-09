"""
Password reset by e-mailed code, and the auth rate limits.
This work made by Anfinogentov Nikita
"""
import re

from modernsi.campuses.service import add_domain
from tests.helpers import last_mail, login_as, mail_count, make_user


async def reset_code_for(email):
    mail = await last_mail(email, "Reset")
    return re.search(r"\b(\d{6})\b", mail["subject"]).group(1)


async def test_forgot_for_unknown_email_is_silent(client):
    response = await client.post("/api/auth/password/forgot", json={"email": "nobody@uni.edu"})
    assert response.status_code == 202
    assert await mail_count() == 0


async def test_reset_changes_password_and_ends_sessions(make_client, hub):
    user = await make_user(hub)
    phone = await login_as(make_client(), hub, user)
    client = make_client()
    assert (await client.post("/api/auth/password/forgot", json={"email": "aru@uni.edu"})).status_code == 202
    code = await reset_code_for("aru@uni.edu")
    response = await client.post("/api/auth/password/reset", json={"email": "aru@uni.edu", "code": code, "password": "a brand new password"})
    assert response.status_code == 204
    assert (await phone.get("/api/auth/me")).status_code == 401
    old = await client.post("/api/auth/login", json={"email": "aru@uni.edu", "password": "correct horse battery"})
    assert old.status_code == 401
    new = await client.post("/api/auth/login", json={"email": "aru@uni.edu", "password": "a brand new password"})
    assert new.status_code == 200


async def test_reset_with_wrong_code(client, hub):
    await make_user(hub)
    await client.post("/api/auth/password/forgot", json={"email": "aru@uni.edu"})
    real = await reset_code_for("aru@uni.edu")
    wrong = "000000" if real != "000000" else "111111"
    response = await client.post("/api/auth/password/reset", json={"email": "aru@uni.edu", "code": wrong, "password": "a brand new password"})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_code"


async def test_reset_for_unknown_email_is_invalid_code(client):
    response = await client.post("/api/auth/password/reset", json={"email": "nobody@uni.edu", "code": "123456", "password": "a brand new password"})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_code"


async def test_register_rate_limit(client, hub):
    async with hub.sessions() as db:
        await add_domain(db, "uni.edu", "Almaty", "KZ")
    for number in range(5):
        body = {"email": f"s{number}@uni.edu", "password": "correct horse battery", "display_name": f"S{number}"}
        assert (await client.post("/api/auth/register", json=body)).status_code == 201
    body = {"email": "s9@uni.edu", "password": "correct horse battery", "display_name": "S9"}
    response = await client.post("/api/auth/register", json=body)
    assert response.status_code == 429
    assert response.json()["error"]["code"] == "rate_limited"


async def test_login_rate_limit(client, hub):
    await make_user(hub)
    for _ in range(10):
        response = await client.post("/api/auth/login", json={"email": "aru@uni.edu", "password": "wrong password!"})
        assert response.status_code == 401
    response = await client.post("/api/auth/login", json={"email": "aru@uni.edu", "password": "correct horse battery"})
    assert response.status_code == 429
