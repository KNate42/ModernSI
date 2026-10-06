"""
Shared test fixtures: real stores from infra/docker-compose.test.yml, one app per session, clean data per test.
This work made by Anfinogentov Nikita
"""
import os
import subprocess
from pathlib import Path

import httpx
import pytest
from sqlalchemy import text

TEST_ENV = {
    "MSI_POSTGRES_DSN": "postgresql+asyncpg://modernsi:modernsi@localhost:25432/modernsi",
    "MSI_REDIS_URL": "redis://localhost:26379/0",
    "MSI_MONGO_URL": "mongodb://localhost:27117",
    "MSI_MONGO_DB": "modernsi_test",
    "MSI_CLICKHOUSE_PORT": "28123",
    "MSI_SMTP_PORT": "21025",
    "MSI_ALLOWED_ORIGINS": '["http://localhost:3000"]',
}
# I set the env before importing the app so nothing picks up dev settings by accident
os.environ.update(TEST_ENV)

from modernsi import models  # noqa: E402
from modernsi.app import create_app  # noqa: E402
from modernsi.core.config import Settings  # noqa: E402
from modernsi.feed.schema import CLICKHOUSE_TABLES  # noqa: E402
from tests.helpers import MAILPIT, ORIGIN  # noqa: E402

backend_dir = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="session")
def settings():
    subprocess.run(["uv", "run", "alembic", "upgrade", "head"], cwd=backend_dir, check=True, env=os.environ.copy())
    return Settings(_env_file=None)


@pytest.fixture(scope="session")
async def app(settings):
    application = create_app(settings)
    async with application.router.lifespan_context(application):
        yield application


@pytest.fixture
def hub(app):
    return app.state.stores


@pytest.fixture(autouse=True)
async def clean(app):
    hub = app.state.stores
    tables = ", ".join(table.name for table in models.Base.metadata.sorted_tables)
    if tables:
        async with hub.engine.begin() as conn:
            await conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
    await hub.redis.flushdb()
    await hub.mongo_client.drop_database(hub.settings.mongo_db)
    # a previous test may have simulated a ClickHouse outage; I make sure the next call reconnects at once
    hub.clickhouse_tried_at = float("-inf")
    client = await hub.get_clickhouse()
    for table in CLICKHOUSE_TABLES:
        await client.command(f"TRUNCATE TABLE IF EXISTS {table}")
    async with httpx.AsyncClient() as http:
        await http.delete(f"{MAILPIT}/api/v1/messages")
    yield


@pytest.fixture
async def make_client(app):
    opened = []

    def factory():
        client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test", headers={"Origin": ORIGIN})
        opened.append(client)
        return client

    yield factory
    for client in opened:
        await client.aclose()


@pytest.fixture
def client(make_client):
    return make_client()
