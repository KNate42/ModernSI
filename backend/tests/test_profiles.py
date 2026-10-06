"""
Profiles: extended fields in MongoDB, avatars in GridFS, degraded reads when MongoDB is down.
This work made by Anfinogentov Nikita
"""
from pymongo import AsyncMongoClient

from tests.helpers import login_as, make_user

png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
jpeg = b"\xff\xd8\xff\xe0" + b"\x00" * 64


async def test_own_profile_defaults(client, hub):
    await login_as(client, hub, await make_user(hub))
    body = (await client.get("/api/profiles/me")).json()
    assert body["display_name"] == "Aru"
    assert body["campus_label"] == "Almaty"
    assert body["bio"] == ""
    assert body["theme"] == "system"
    assert body["has_avatar"] is False
    assert body["extended"] is True


async def test_update_and_public_view_has_no_email(make_client, hub):
    user = await make_user(hub)
    me = await login_as(make_client(), hub, user)
    update = {"bio": "Linguistics, 2nd year", "languages": ["Kazakh", "English"], "interests": ["debate"], "links": ["https://example.org/aru"], "theme": "dark"}
    response = await me.put("/api/profiles/me", json=update)
    assert response.status_code == 200
    public = await make_client().get(f"/api/profiles/{user.id}")
    body = public.json()
    assert body["bio"] == "Linguistics, 2nd year"
    assert body["languages"] == ["Kazakh", "English"]
    assert "email" not in body
    assert "aru@uni.edu" not in public.text


async def test_pending_user_cannot_edit(client, hub):
    await login_as(client, hub, await make_user(hub, status="pending"))
    response = await client.put("/api/profiles/me", json={"bio": "hi"})
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "email_not_verified"


async def test_avatar_upload_replace_and_read(make_client, hub):
    user = await make_user(hub)
    me = await login_as(make_client(), hub, user)
    assert (await me.put("/api/profiles/me/avatar", files={"file": ("a.png", png, "image/png")})).status_code == 204
    assert (await me.put("/api/profiles/me/avatar", files={"file": ("b.jpg", jpeg, "image/jpeg")})).status_code == 204
    assert (await me.get("/api/profiles/me")).json()["has_avatar"] is True
    picture = await make_client().get(f"/api/profiles/{user.id}/avatar")
    assert picture.status_code == 200
    assert picture.headers["content-type"] == "image/jpeg"
    assert picture.content == jpeg
    assert await hub.mongo["avatars.files"].count_documents({}) == 1


async def test_avatar_must_be_a_picture(client, hub):
    await login_as(client, hub, await make_user(hub))
    response = await client.put("/api/profiles/me/avatar", files={"file": ("x.png", b"<svg onload=alert(1)>", "image/png")})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "avatar_bad_type"


async def test_avatar_size_limit(client, hub):
    await login_as(client, hub, await make_user(hub))
    big = png + b"\x00" * (2 * 1024 * 1024)
    response = await client.put("/api/profiles/me/avatar", files={"file": ("big.png", big, "image/png")})
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "avatar_too_large"


async def test_no_avatar_is_404(client, hub):
    user = await make_user(hub)
    response = await client.get(f"/api/profiles/{user.id}/avatar")
    assert response.status_code == 404


async def test_blocked_user_profile_is_hidden(client, hub):
    user = await make_user(hub, status="blocked")
    assert (await client.get(f"/api/profiles/{user.id}")).status_code == 404


async def test_mongo_down_degrades(client, hub, monkeypatch):
    await login_as(client, hub, await make_user(hub))
    dead = AsyncMongoClient("mongodb://localhost:1", serverSelectionTimeoutMS=200)
    monkeypatch.setattr(hub, "mongo", dead["modernsi_test"])
    try:
        body = (await client.get("/api/profiles/me")).json()
        assert body["extended"] is False
        assert body["display_name"] == "Aru"
        response = await client.put("/api/profiles/me", json={"bio": "x"})
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "store_unavailable"
    finally:
        await dead.close()
