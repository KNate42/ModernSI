"""
Core behaviour: error format, origin check, rate limiting, store outages turning into 503.
This work made by Anfinogentov Nikita
"""
import httpx
import pytest
from fastapi import FastAPI
from pydantic import BaseModel
from redis.exceptions import ConnectionError as RedisConnectionError

from modernsi.core.config import Settings
from modernsi.core.errors import api_error, install_error_handlers
from modernsi.core.ratelimit import hit
from modernsi.core.security import client_ip, install_origin_check


class Thing(BaseModel):
    name: str


def tiny_app():
    settings = Settings(_env_file=None, allowed_origins=["http://localhost:3000"])
    app = FastAPI()
    install_error_handlers(app)
    install_origin_check(app, settings)

    @app.post("/api/things")
    async def create_thing(thing: Thing):
        return {"name": thing.name}

    @app.get("/api/boom")
    async def boom():
        raise api_error(409, "already_there", "It is already there")

    @app.get("/api/redis-down")
    async def redis_down():
        raise RedisConnectionError("refused")

    return app


def tiny_client(origin=None):
    headers = {"Origin": origin} if origin else {}
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=tiny_app()), base_url="http://test", headers=headers)


async def test_post_without_origin_is_rejected():
    async with tiny_client() as client:
        response = await client.post("/api/things", json={"name": "x"})
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "bad_origin"


async def test_post_from_foreign_origin_is_rejected():
    async with tiny_client("https://evil.example") as client:
        response = await client.post("/api/things", json={"name": "x"})
    assert response.status_code == 403


async def test_post_from_allowed_origin_passes():
    async with tiny_client("http://localhost:3000") as client:
        response = await client.post("/api/things", json={"name": "x"})
    assert response.status_code == 200


async def test_get_needs_no_origin():
    async with tiny_client() as client:
        response = await client.get("/api/boom")
    assert response.status_code == 409
    assert response.json() == {"error": {"code": "already_there", "message": "It is already there"}}


async def test_validation_error_format():
    async with tiny_client("http://localhost:3000") as client:
        response = await client.post("/api/things", json={})
    body = response.json()
    assert response.status_code == 422
    assert body["error"]["code"] == "validation_error"
    assert body["error"]["fields"][0]["field"] == "name"


async def test_unknown_route_is_not_found():
    async with tiny_client() as client:
        response = await client.get("/api/nothing-here")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


async def test_redis_outage_is_503():
    async with tiny_client() as client:
        response = await client.get("/api/redis-down")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "store_unavailable"


async def test_rate_limit_blocks_after_limit(hub):
    await hit(hub.redis, "demo", 2, 60)
    await hit(hub.redis, "demo", 2, 60)
    with pytest.raises(api_error) as caught:
        await hit(hub.redis, "demo", 2, 60)
    assert caught.value.status == 429
    assert caught.value.code == "rate_limited"


async def test_client_ip_ignores_forwarded_header_unless_trusted():
    class fake_request:
        headers = {"x-forwarded-for": "203.0.113.9, 10.0.0.1"}
        client = type("c", (), {"host": "10.0.0.1"})()

    assert client_ip(fake_request(), Settings(_env_file=None, trust_forwarded_for=False)) == "10.0.0.1"
    assert client_ip(fake_request(), Settings(_env_file=None, trust_forwarded_for=True)) == "203.0.113.9"
