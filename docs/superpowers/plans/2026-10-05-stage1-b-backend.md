# ModernSI — Stage 1B: Backend — Implementation Plan

**Goal:** The FastAPI modular monolith for stage 1: university-email sign-up with roles, the idea → vote → review → team → event cycle, profiles, the activity feed in ClickHouse, e-mail notifications, admin API and CLI.

**Architecture:** One FastAPI app (`backend/src/modernsi`) split into modules (`core`, `campuses`, `mail`, `auth`, `admin`, `profiles`, `feed`, `ideas`, `events`), each with router → service → storage. PostgreSQL is the source of truth (SQLAlchemy 2 async + Alembic); Redis keeps sessions, one-time codes and rate limits; MongoDB keeps profiles and avatars (GridFS); ClickHouse receives the activity feed through a transactional outbox, plus HTTP request logs. A separate `modernsi worker` process ships the outbox, sends queued mail and runs periodic transitions.

**Tech Stack:** Python 3.14, uv, FastAPI 0.142.2, SQLAlchemy 2.1.3 + asyncpg 0.31.0, Alembic 1.20.0, redis-py 8.1.0, PyMongo 4.18.2 (async API), clickhouse-connect[async] 1.9.0, argon2-cffi 25.1.0, pydantic-settings 2.15.0, markdown-it-py 4.2.0, Typer 0.27.2, pytest 9.1.1 + pytest-asyncio 1.4.0 + httpx 0.28.1. Docker: postgres:18-alpine, redis:8-alpine, mongo:8, clickhouse/clickhouse-server:26.8, axllent/mailpit:v1.31.

**Spec:** `docs/superpowers/specs/2026-10-05-stage1-foundation-home-design.md` (sections 3, 4, 5, 9, 10, 11)

## Global Constraints

- Every Python module starts with a docstring: one line on what the file does + `This work made by Anfinogentov Nikita`.
- Comments and docstrings in English, first person ("There I …").
- snake_case for modules and functions. Plain (non-ORM, non-Pydantic) classes in lower case (`class stores`, `class api_error`). ORM models and Pydantic schemas keep normal class names (`User`, `IdeaCreate`).
- Type annotations only where FastAPI, Pydantic or Typer need them (endpoint parameters, schemas, CLI options). No annotations in services, no `from __future__`.
- No `Co-Authored-By` line in commit messages.
- Error body is always `{"error": {"code": "...", "message": "..."}}` (+ `"fields"` for 422 validation). Codes listed per task are stable — the frontend keys on them.
- E-mail is never returned by any public endpoint; public user shape is `{id, display_name, campus_label}`.
- Defaults: `VOTE_THRESHOLD=50`, `IDEA_TTL_DAYS=60`, `TEAM_MIN=3`, counters shown when students ≥ 25, session 30 days sliding, code TTL 15 min / 5 attempts / resend 60 s / 10 per day.
- Rate limits: register 5/hour per IP; login 10 per 15 min per IP+email; votes 60/min per user; idea creation 5/day per user.
- Mutating `/api/*` requests require `Origin` in `MSI_ALLOWED_ORIGINS`, else `403 bad_origin`.
- Passwords: argon2id, minimum 10 characters.
- All timestamps are timezone-aware UTC.
- Dev ports: Postgres 15432, Redis 16379, Mongo 17017, ClickHouse HTTP 18123, SMTP 11025, Mailpit UI 18025. Test ports: 25432, 26379, 27117, 28123, 21025, Mailpit API 28025.

## Review Focus

- E-mail typed with capitals or spaces (`" Aru@Uni.EDU "`) → treated as the same account and the same allowed domain; a second registration is `409 email_taken`. Test in Task B6.
- Student addresses on a subdomain (`aru@student.uni.edu` when `uni.edu` is allowed) → accepted and labelled with the parent domain's campus; `evil-uni.edu` must not match `uni.edu`. Test in Task B3.
- A user blocked while logged in → their very next request is anonymous (`401` on protected routes), not a lingering session. Test in Task B8.
- Event times without a timezone (`"2026-11-01T18:00:00"`) → `422`, not silently treated as server-local time. Test in Task B14.
- Markdown with raw HTML, `javascript:` links or images → escaped / not linked / not rendered; links get `rel="nofollow ugc noopener"`. Test in Task B11.

---

## File Structure

```
infra/
  docker-compose.yml            dev stores (+ mailpit)
  docker-compose.test.yml       test stores on separate ports, tmpfs
backend/
  pyproject.toml  alembic.ini  .env.example  README.md
  migrations/env.py  migrations/script.py.mako  migrations/versions/*.py
  src/modernsi/
    __init__.py
    app.py                      create_app(): lifespan, middleware, error handlers, routers
    cli.py                      Typer CLI: dev, worker, migrate, add-domain, create-admin
    models.py                   imports every ORM module (Alembic + tests)
    worker.py                   run_once(), run_worker()
    core/
      config.py                 Settings (MSI_* env)
      db.py                     Base, utcnow(), get_db()
      stores.py                 class stores: engine, sessions, redis, mongo, clickhouse
      deps.py                   get_hub(), get_config()
      health.py                 GET /api/health
      errors.py                 class api_error, install_error_handlers()
      security.py               install_origin_check(), client_ip()
      ratelimit.py              hit()
      markdown.py               render_markdown()
    campuses/  models.py schemas.py service.py router.py
    mail/      models.py sender.py queue.py templates.py
    feed/      models.py outbox.py schema.py shipper.py requestlog.py service.py router.py
    auth/      models.py passwords.py sessions.py codes.py schemas.py service.py deps.py router.py
    admin/     schemas.py router.py
    profiles/  schemas.py service.py router.py
    ideas/     models.py schemas.py service.py router.py
    events/    models.py schemas.py service.py router.py
  tests/
    conftest.py  helpers.py  test_*.py
```

---

### Task B1: Infrastructure, backend skeleton, health endpoint, test harness

**Files:**
- Create: `infra/docker-compose.yml`, `infra/docker-compose.test.yml`
- Create: `backend/pyproject.toml`, `backend/.env.example`, `backend/.gitignore`
- Create: `backend/src/modernsi/__init__.py`, `backend/src/modernsi/models.py`, `backend/src/modernsi/app.py`, `backend/src/modernsi/cli.py`
- Create: `backend/src/modernsi/core/__init__.py`, `core/config.py`, `core/db.py`, `core/stores.py`, `core/deps.py`, `core/health.py`
- Create: `backend/src/modernsi/feed/__init__.py`, `feed/schema.py`
- Create: `backend/alembic.ini`, `backend/migrations/env.py` (+ generated `script.py.mako`)
- Test: `backend/tests/conftest.py`, `backend/tests/helpers.py`, `backend/tests/test_health.py`

**Interfaces:**
- Produces: `create_app(settings=None)`; `app.state.stores` (instance of `stores` with `.engine`, `.sessions`, `.redis`, `.mongo_client`, `.mongo`, `.settings`, `await .get_clickhouse()`, `.drop_clickhouse()`, `await .health()`, `await .close()`); `app.state.settings`; dependencies `get_db` (AsyncSession), `get_hub`, `get_config`; `Base`, `utcnow()`; `routers()` list in `app.py`; `CLICKHOUSE_TABLES`, `ensure_schema(client)`, `ACTIVITY_COLUMNS`, `HTTP_COLUMNS`. Test fixtures: `settings`, `app`, `hub`, `client`, `make_client`; helper `last_mail(to)`.

- [ ] **Step 1: Write the compose files**

`infra/docker-compose.yml`:

```yaml
# Dev stores for ModernSI. Start: docker compose -f infra/docker-compose.yml up -d --wait
name: modernsi
services:
  postgres:
    image: postgres:18-alpine
    environment: { POSTGRES_USER: modernsi, POSTGRES_PASSWORD: modernsi, POSTGRES_DB: modernsi }
    ports: ["15432:5432"]
    volumes: [pg:/var/lib/postgresql]
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U modernsi"], interval: 2s, timeout: 3s, retries: 30 }
  redis:
    image: redis:8-alpine
    command: ["redis-server", "--appendonly", "yes"]
    ports: ["16379:6379"]
    volumes: [redis:/data]
    healthcheck: { test: ["CMD", "redis-cli", "ping"], interval: 2s, timeout: 3s, retries: 30 }
  mongo:
    image: mongo:8
    ports: ["17017:27017"]
    volumes: [mongo:/data/db]
    healthcheck: { test: ["CMD", "mongosh", "--quiet", "--eval", "db.runCommand({ping:1}).ok"], interval: 3s, timeout: 5s, retries: 30 }
  clickhouse:
    image: clickhouse/clickhouse-server:26.8
    environment:
      CLICKHOUSE_USER: modernsi
      CLICKHOUSE_PASSWORD: modernsi
      CLICKHOUSE_DB: modernsi
      CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT: "1"
    ports: ["18123:8123"]
    ulimits: { nofile: { soft: 262144, hard: 262144 } }
    volumes: [clickhouse:/var/lib/clickhouse]
    healthcheck: { test: ["CMD", "wget", "-qO-", "http://localhost:8123/ping"], interval: 2s, timeout: 3s, retries: 30 }
  mailpit:
    image: axllent/mailpit:v1.31
    ports: ["11025:1025", "18025:8025"]
volumes: { pg: {}, redis: {}, mongo: {}, clickhouse: {} }
```

`infra/docker-compose.test.yml`:

```yaml
# Throwaway stores for pytest, on their own ports and in memory.
# Start: docker compose -f infra/docker-compose.test.yml up -d --wait
name: modernsi-test
services:
  postgres:
    image: postgres:18-alpine
    environment: { POSTGRES_USER: modernsi, POSTGRES_PASSWORD: modernsi, POSTGRES_DB: modernsi }
    ports: ["25432:5432"]
    tmpfs: [/var/lib/postgresql]
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U modernsi"], interval: 2s, timeout: 3s, retries: 30 }
  redis:
    image: redis:8-alpine
    ports: ["26379:6379"]
    healthcheck: { test: ["CMD", "redis-cli", "ping"], interval: 2s, timeout: 3s, retries: 30 }
  mongo:
    image: mongo:8
    ports: ["27117:27017"]
    tmpfs: [/data/db]
    healthcheck: { test: ["CMD", "mongosh", "--quiet", "--eval", "db.runCommand({ping:1}).ok"], interval: 3s, timeout: 5s, retries: 30 }
  clickhouse:
    image: clickhouse/clickhouse-server:26.8
    environment:
      CLICKHOUSE_USER: modernsi
      CLICKHOUSE_PASSWORD: modernsi
      CLICKHOUSE_DB: modernsi
      CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT: "1"
    ports: ["28123:8123"]
    ulimits: { nofile: { soft: 262144, hard: 262144 } }
    healthcheck: { test: ["CMD", "wget", "-qO-", "http://localhost:8123/ping"], interval: 2s, timeout: 3s, retries: 30 }
  mailpit:
    image: axllent/mailpit:v1.31
    ports: ["21025:1025", "28025:8025"]
```

- [ ] **Step 2: Write `pyproject.toml`, `.env.example`, `.gitignore` and install**

`backend/pyproject.toml`:

```toml
[project]
name = "modernsi"
version = "0.1.0"
description = "ModernSI backend"
requires-python = ">=3.14"
dependencies = [
  "fastapi==0.142.2",
  "uvicorn==0.54.0",
  "sqlalchemy[asyncio]==2.1.3",
  "asyncpg==0.31.0",
  "alembic==1.20.0",
  "redis==8.1.0",
  "pymongo==4.18.2",
  "clickhouse-connect[async]==1.9.0",
  "argon2-cffi==25.1.0",
  "pydantic-settings==2.15.0",
  "email-validator==2.3.0",
  "markdown-it-py==4.2.0",
  "python-multipart==0.0.32",
  "typer==0.27.2",
]

[project.scripts]
modernsi = "modernsi.cli:cli"

[dependency-groups]
dev = ["pytest==9.1.1", "pytest-asyncio==1.4.0", "httpx==0.28.1"]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/modernsi"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
asyncio_default_fixture_loop_scope = "session"
asyncio_default_test_loop_scope = "session"
testpaths = ["tests"]
```

`backend/.env.example`:

```bash
# Copy to backend/.env and adjust. Every setting is MSI_<NAME>; defaults match infra/docker-compose.yml.
MSI_POSTGRES_DSN=postgresql+asyncpg://modernsi:modernsi@localhost:15432/modernsi
MSI_REDIS_URL=redis://localhost:16379/0
MSI_MONGO_URL=mongodb://localhost:17017
MSI_CLICKHOUSE_PORT=18123
MSI_SMTP_PORT=11025
MSI_SITE_URL=http://localhost:3000
# JSON list
MSI_ALLOWED_ORIGINS=["http://localhost:3000"]
# true only behind a proxy that sets X-Forwarded-For (Next.js dev server, nginx); the API port must not be public then
MSI_TRUST_FORWARDED_FOR=true
MSI_COOKIE_SECURE=false
MSI_LOG_SALT=change-me
```

`backend/.gitignore`:

```
.venv/
__pycache__/
.env
.pytest_cache/
```

Nothing to run yet: `uv sync` builds the package, so it needs the source tree from Step 3. Installation happens in Step 6.

- [ ] **Step 3: Write the core package**

`backend/src/modernsi/__init__.py`:

```python
"""
ModernSI backend package.
This work made by Anfinogentov Nikita
"""
```

`backend/src/modernsi/core/__init__.py` and `backend/src/modernsi/feed/__init__.py` — same two-line docstring with "Core building blocks shared by every module." / "Activity feed: outbox, ClickHouse shipping, request logs."

`backend/src/modernsi/core/config.py`:

```python
"""
Settings of the whole backend, read from MSI_* environment variables or backend/.env.
This work made by Anfinogentov Nikita
"""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="MSI_", env_file=".env", extra="ignore")

    postgres_dsn: str = "postgresql+asyncpg://modernsi:modernsi@localhost:15432/modernsi"
    redis_url: str = "redis://localhost:16379/0"
    mongo_url: str = "mongodb://localhost:17017"
    mongo_db: str = "modernsi"
    clickhouse_host: str = "localhost"
    clickhouse_port: int = 18123
    clickhouse_user: str = "modernsi"
    clickhouse_password: str = "modernsi"
    clickhouse_db: str = "modernsi"

    smtp_host: str = "localhost"
    smtp_port: int = 11025
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_starttls: bool = False
    mail_from: str = "ModernSI <no-reply@modernsi.local>"

    site_url: str = "http://localhost:3000"
    allowed_origins: list[str] = ["http://localhost:3000"]
    cookie_secure: bool = False
    trust_forwarded_for: bool = False
    session_days: int = 30
    log_salt: str = "change-me"

    vote_threshold: int = 50
    idea_ttl_days: int = 60
    team_min: int = 3
    stats_min_students: int = 25

    rl_register_per_hour: int = 5
    rl_login_per_15min: int = 10
    rl_codes_per_day: int = 10
    rl_votes_per_minute: int = 60
    rl_ideas_per_day: int = 5


@lru_cache
def get_settings():
    return Settings()
```

`backend/src/modernsi/core/db.py`:

```python
"""
SQLAlchemy base class, the request-scoped session and a UTC clock.
This work made by Anfinogentov Nikita
"""
from datetime import UTC, datetime

from fastapi import Request
from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase

naming = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=naming)


def utcnow():
    return datetime.now(UTC)


async def get_db(request: Request):
    # One session per request; FastAPI caches the dependency, so every dependency of a request shares it
    async with request.app.state.stores.sessions() as session:
        yield session
```

`backend/src/modernsi/core/stores.py`:

```python
"""
Connections to every store the backend uses. I open them once at startup and keep them on app.state.
This work made by Anfinogentov Nikita
"""
import time

import clickhouse_connect
from pymongo import AsyncMongoClient
from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine


class stores:
    def __init__(self, settings):
        self.settings = settings
        self.engine = create_async_engine(settings.postgres_dsn, pool_pre_ping=True, pool_size=10, max_overflow=10)
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)
        self.redis = Redis.from_url(settings.redis_url, decode_responses=True, socket_timeout=3)
        self.mongo_client = AsyncMongoClient(settings.mongo_url, serverSelectionTimeoutMS=2000)
        self.mongo = self.mongo_client[settings.mongo_db]
        self.clickhouse = None
        self.clickhouse_tried_at = float("-inf")

    async def get_clickhouse(self):
        # The ClickHouse client connects eagerly; if ClickHouse is down I retry at most every 5 seconds
        if self.clickhouse is not None:
            return self.clickhouse
        if time.monotonic() - self.clickhouse_tried_at < 5:
            return None
        self.clickhouse_tried_at = time.monotonic()
        try:
            self.clickhouse = await clickhouse_connect.get_async_client(
                host=self.settings.clickhouse_host,
                port=self.settings.clickhouse_port,
                username=self.settings.clickhouse_user,
                password=self.settings.clickhouse_password,
                database=self.settings.clickhouse_db,
            )
        except Exception:
            self.clickhouse = None
        return self.clickhouse

    def drop_clickhouse(self):
        # Called after a failed query, so the next call reconnects instead of reusing a broken client
        self.clickhouse = None

    async def health(self):
        result = {}
        try:
            async with self.engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            result["postgres"] = True
        except Exception:
            result["postgres"] = False
        try:
            result["redis"] = bool(await self.redis.ping())
        except Exception:
            result["redis"] = False
        try:
            await self.mongo.command("ping")
            result["mongo"] = True
        except Exception:
            result["mongo"] = False
        client = await self.get_clickhouse()
        try:
            result["clickhouse"] = client is not None and (await client.command("SELECT 1")) == 1
        except Exception:
            self.drop_clickhouse()
            result["clickhouse"] = False
        return result

    async def close(self):
        await self.engine.dispose()
        await self.redis.aclose()
        await self.mongo_client.close()
        if self.clickhouse is not None:
            await self.clickhouse.close()
```

`backend/src/modernsi/core/deps.py`:

```python
"""
Tiny dependencies that hand the shared stores and settings to endpoints.
This work made by Anfinogentov Nikita
"""
from fastapi import Request


def get_hub(request: Request):
    return request.app.state.stores


def get_config(request: Request):
    return request.app.state.settings
```

`backend/src/modernsi/core/health.py`:

```python
"""
Health endpoint: tells which stores answer. 503 only when Postgres, the source of truth, is down.
This work made by Anfinogentov Nikita
"""
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from modernsi.core.deps import get_hub

router = APIRouter()


@router.get("/api/health")
async def health(hub=Depends(get_hub)):
    state = await hub.health()
    status = "ok" if all(state.values()) else "degraded"
    return JSONResponse({"status": status, "stores": state}, status_code=200 if state["postgres"] else 503)
```

`backend/src/modernsi/feed/schema.py`:

```python
"""
ClickHouse tables of the feed module. CREATE IF NOT EXISTS, so I run it on every startup.
This work made by Anfinogentov Nikita
"""

CLICKHOUSE_TABLES = ("activity", "http_requests")

ACTIVITY_COLUMNS = ["id", "kind", "at", "actor_id", "idea_id", "event_id", "campus_label", "data"]
HTTP_COLUMNS = ["at", "method", "route", "status", "duration_ms", "user_hash"]

# ReplacingMergeTree on (at, id): shipping the same outbox row twice collapses into one, I read with FINAL
ACTIVITY_SQL = """
CREATE TABLE IF NOT EXISTS activity (
    id UUID,
    kind LowCardinality(String),
    at DateTime64(3, 'UTC'),
    actor_id Nullable(UUID),
    idea_id Nullable(UUID),
    event_id Nullable(UUID),
    campus_label String,
    data String
) ENGINE = ReplacingMergeTree ORDER BY (at, id)
"""

HTTP_SQL = """
CREATE TABLE IF NOT EXISTS http_requests (
    at DateTime64(3, 'UTC'),
    method LowCardinality(String),
    route String,
    status UInt16,
    duration_ms Float32,
    user_hash String
) ENGINE = MergeTree ORDER BY at TTL toDateTime(at) + INTERVAL 90 DAY
"""


async def ensure_schema(client):
    await client.command(ACTIVITY_SQL)
    await client.command(HTTP_SQL)
```

`backend/src/modernsi/models.py`:

```python
"""
Imports every ORM module so Alembic autogenerate and the tests see all tables.
This work made by Anfinogentov Nikita
"""
from modernsi.core.db import Base  # noqa: F401
```

`backend/src/modernsi/app.py`:

```python
"""
Builds the FastAPI application: stores on startup, middleware, error handlers and every module router.
This work made by Anfinogentov Nikita
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI

from modernsi.core.config import get_settings
from modernsi.core.health import router as health_router
from modernsi.core.stores import stores
from modernsi.feed.schema import ensure_schema


def routers():
    # There I keep every module router in one list; each module task appends its own line
    return [health_router]


def create_app(settings=None):
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app):
        hub = stores(settings)
        client = await hub.get_clickhouse()
        if client is not None:
            await ensure_schema(client)
        app.state.stores = hub
        yield
        await hub.close()

    app = FastAPI(title="ModernSI API", lifespan=lifespan, docs_url="/api/docs", openapi_url="/api/openapi.json", redoc_url=None)
    app.state.settings = settings
    for router in routers():
        app.include_router(router)
    return app
```

`backend/src/modernsi/cli.py`:

```python
"""
Command line of the backend: dev server, migrations. More commands come with later modules.
This work made by Anfinogentov Nikita
"""
import asyncio
import subprocess
from pathlib import Path

import typer
import uvicorn

from modernsi.core.config import get_settings
from modernsi.core.stores import stores
from modernsi.feed.schema import ensure_schema

cli = typer.Typer(no_args_is_help=True)
backend_dir = Path(__file__).resolve().parents[2]


def run_with_hub(work):
    # There I open the stores for one CLI command and always close them
    async def runner():
        hub = stores(get_settings())
        try:
            return await work(hub)
        finally:
            await hub.close()

    return asyncio.run(runner())


@cli.command()
def dev(port: int = 8040):
    """Run the API with auto-reload."""
    uvicorn.run("modernsi.app:create_app", factory=True, reload=True, port=port)


@cli.command()
def migrate():
    """Apply Postgres migrations and create ClickHouse tables."""
    subprocess.run(["alembic", "upgrade", "head"], cwd=backend_dir, check=True)

    async def clickhouse(hub):
        client = await hub.get_clickhouse()
        if client is None:
            typer.echo("Ooops.. ClickHouse is not reachable, tables not created")
            raise typer.Exit(1)
        await ensure_schema(client)

    run_with_hub(clickhouse)
    typer.echo("migrations applied")
```

- [ ] **Step 4: Set up Alembic**

Run: `cd backend && uv run alembic init -t async migrations`
Expected: creates `alembic.ini`, `migrations/env.py`, `migrations/script.py.mako`, `migrations/versions/`.

Replace `backend/migrations/env.py` entirely with:

```python
"""
Alembic environment: takes the DSN from Settings and the tables from modernsi.models.
This work made by Anfinogentov Nikita
"""
import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

from modernsi import models
from modernsi.core.config import get_settings

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)
target_metadata = models.Base.metadata


def run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


async def run_online():
    engine = create_async_engine(get_settings().postgres_dsn)
    async with engine.connect() as connection:
        await connection.run_sync(run_migrations)
    await engine.dispose()


if context.is_offline_mode():
    context.configure(url=get_settings().postgres_dsn, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()
else:
    asyncio.run(run_online())
```

In `backend/alembic.ini` delete the line starting with `sqlalchemy.url =` (the DSN comes from Settings).

- [ ] **Step 5: Write the test harness and the failing health test**

`backend/tests/conftest.py`:

```python
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
```

`backend/tests/__init__.py`: empty file.

`backend/tests/helpers.py`:

```python
"""
Helpers shared by tests: reading mail from Mailpit; later tasks add user helpers here.
This work made by Anfinogentov Nikita
"""
import asyncio

import httpx

MAILPIT = "http://localhost:28025"
ORIGIN = "http://localhost:3000"


async def last_mail(to, subject_contains=""):
    # Mailpit lists newest first; I poll briefly because SMTP delivery is not instant
    async with httpx.AsyncClient(base_url=MAILPIT) as http:
        for _ in range(30):
            data = (await http.get("/api/v1/messages")).json()
            for message in data["messages"]:
                to_match = any(item["Address"] == to for item in message["To"])
                if to_match and subject_contains in message["Subject"]:
                    full = (await http.get(f"/api/v1/message/{message['ID']}")).json()
                    return {"subject": message["Subject"], "text": full["Text"]}
            await asyncio.sleep(0.1)
    raise AssertionError(f"no mail to {to} with subject containing {subject_contains!r}")
```

`backend/tests/test_health.py`:

```python
"""
Health endpoint test: every store of the test compose answers.
This work made by Anfinogentov Nikita
"""


async def test_health_reports_every_store(client):
    response = await client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "stores": {"postgres": True, "redis": True, "mongo": True, "clickhouse": True},
    }
```

- [ ] **Step 6: Start the stores and run the test**

Run:
```bash
docker compose -f infra/docker-compose.yml up -d --wait
docker compose -f infra/docker-compose.test.yml up -d --wait
cd backend && uv sync && uv run pytest -v
```
Expected: `test_health_reports_every_store PASSED`. (If you run pytest before Step 3 existed you get `ModuleNotFoundError: modernsi.app` — that is the failing state.)

- [ ] **Step 7: Check the dev CLI**

Run: `cd backend && uv run modernsi migrate`
Expected: `migrations applied`.

- [ ] **Step 8: Commit**

```bash
git add infra backend
git commit -m "Add stores compose, FastAPI skeleton, health endpoint and test harness"
```

---

### Task B2: Errors, origin check, rate limiting, client IP

**Files:**
- Create: `backend/src/modernsi/core/errors.py`, `core/security.py`, `core/ratelimit.py`
- Modify: `backend/src/modernsi/app.py` (install handlers and origin check)
- Test: `backend/tests/test_core.py`

**Interfaces:**
- Consumes: `create_app`, `Settings`.
- Produces: `class api_error(Exception)` with `__init__(self, status, code, message)`; `install_error_handlers(app)`; `install_origin_check(app, settings)`; `client_ip(request, settings) -> str`; `await hit(redis, key, limit, window_seconds)` raising `api_error(429, "rate_limited", ...)`.

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_core.py`:

```python
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
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && uv run pytest tests/test_core.py -v`
Expected: collection error `ModuleNotFoundError: No module named 'modernsi.core.errors'`.

- [ ] **Step 3: Implement**

`backend/src/modernsi/core/errors.py`:

```python
"""
One error shape for the whole API: {"error": {"code", "message"}}. Store outages become 503.
This work made by Anfinogentov Nikita
"""
import logging

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pymongo.errors import ServerSelectionTimeoutError
from redis.exceptions import ConnectionError as RedisConnectionError
from redis.exceptions import TimeoutError as RedisTimeoutError
from sqlalchemy.exc import InterfaceError, OperationalError
from starlette.exceptions import HTTPException

log = logging.getLogger("modernsi")


class api_error(Exception):
    def __init__(self, status, code, message):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


def error_body(code, message, **extra):
    return {"error": {"code": code, "message": message, **extra}}


def install_error_handlers(app):
    @app.exception_handler(api_error)
    async def on_api_error(request, exc):
        return JSONResponse(error_body(exc.code, exc.message), status_code=exc.status)

    @app.exception_handler(RequestValidationError)
    async def on_validation(request, exc):
        fields = []
        for item in exc.errors():
            # loc looks like ("body", "name") or ("query", "limit"); the first part is noise for the client
            location = [str(part) for part in item["loc"][1:]] or [str(item["loc"][0])]
            fields.append({"field": ".".join(location), "message": item["msg"]})
        return JSONResponse(error_body("validation_error", "Some fields are invalid", fields=fields), status_code=422)

    @app.exception_handler(HTTPException)
    async def on_http(request, exc):
        code = {404: "not_found", 405: "method_not_allowed"}.get(exc.status_code, "http_error")
        return JSONResponse(error_body(code, str(exc.detail)), status_code=exc.status_code)

    async def on_store_down(request, exc):
        log.warning("store unavailable: %r", exc)
        return JSONResponse(error_body("store_unavailable", "A service is temporarily unavailable, try again shortly"), status_code=503)

    for kind in (RedisConnectionError, RedisTimeoutError, OperationalError, InterfaceError, ServerSelectionTimeoutError, ConnectionRefusedError):
        app.add_exception_handler(kind, on_store_down)
```

`backend/src/modernsi/core/security.py`:

```python
"""
Request guards: Origin check for every mutating API call and the real client IP for rate limits.
This work made by Anfinogentov Nikita
"""
from fastapi.responses import JSONResponse

from modernsi.core.errors import error_body

safe_methods = {"GET", "HEAD", "OPTIONS"}


def install_origin_check(app, settings):
    allowed = set(settings.allowed_origins)

    @app.middleware("http")
    async def origin_check(request, call_next):
        # SameSite=Lax already stops most CSRF; the Origin check closes the rest for POST/PUT/PATCH/DELETE
        if request.method not in safe_methods and request.url.path.startswith("/api/"):
            if request.headers.get("origin") not in allowed:
                return JSONResponse(error_body("bad_origin", "Request origin is not allowed"), status_code=403)
        return await call_next(request)


def client_ip(request, settings):
    forwarded = request.headers.get("x-forwarded-for")
    if settings.trust_forwarded_for and forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
```

`backend/src/modernsi/core/ratelimit.py`:

```python
"""
Fixed-window rate limiter on Redis.
This work made by Anfinogentov Nikita
"""
from modernsi.core.errors import api_error


async def hit(redis, key, limit, window_seconds):
    full_key = "rl:" + key
    async with redis.pipeline(transaction=True) as pipe:
        pipe.incr(full_key)
        pipe.expire(full_key, window_seconds, nx=True)
        count, _ = await pipe.execute()
    if count > limit:
        wait = max(await redis.ttl(full_key), 1)
        raise api_error(429, "rate_limited", f"Too many attempts. Try again in {wait} s.")
```

Modify `backend/src/modernsi/app.py`: add imports

```python
from modernsi.core.errors import install_error_handlers
from modernsi.core.security import install_origin_check
```

and in `create_app`, right after `app.state.settings = settings`, add:

```python
    install_error_handlers(app)
    install_origin_check(app, settings)
```

- [ ] **Step 4: Run tests**

Run: `cd backend && uv run pytest -v`
Expected: all tests pass (10 in `test_core.py` + health).

- [ ] **Step 5: Commit**

```bash
git add backend
git commit -m "Add error format, origin check, rate limiter and client IP helper"
```

---

### Task B3: Campuses — allowed domains and domain requests

**Files:**
- Create: `backend/src/modernsi/campuses/__init__.py`, `campuses/models.py`, `campuses/schemas.py`, `campuses/service.py`, `campuses/router.py`
- Modify: `backend/src/modernsi/models.py`, `backend/src/modernsi/app.py` (`routers()`), `backend/src/modernsi/cli.py` (`add-domain`)
- Create: `backend/migrations/versions/<generated>_campuses.py`
- Test: `backend/tests/test_campuses.py`

**Interfaces:**
- Consumes: `Base`, `utcnow`, `get_db`, `get_hub`, `get_config`, `api_error`, `hit`, `client_ip`.
- Produces: ORM `EmailDomain(id, domain, campus_label, country_code, is_active, created_at)`, `DomainRequest(id, domain, university_name, requester_email, status, created_at)`; `domain_of(email) -> str`; `await find_domain(db, email) -> EmailDomain | None`; `await add_domain(db, domain, campus_label, country_code) -> EmailDomain` (activates/relabels if it exists); `await create_request(db, data) -> DomainRequest`; endpoint `POST /api/campuses/requests` → `201 {"id", "status"}`; error codes `invalid_domain`, `email_domain_mismatch`, `domain_already_allowed`.

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_campuses.py`:

```python
"""
Allowed domains: exact and subdomain matches, inactive domains, requests for new domains.
This work made by Anfinogentov Nikita
"""
from modernsi.campuses.service import add_domain, domain_of, find_domain


async def test_domain_of_normalises():
    assert domain_of("  Aru@Student.Uni.EDU ") == "student.uni.edu"


async def test_find_domain_exact_and_subdomain(hub):
    async with hub.sessions() as db:
        await add_domain(db, "uni.edu", "Almaty", "KZ")
        assert (await find_domain(db, "aru@uni.edu")).campus_label == "Almaty"
        assert (await find_domain(db, "aru@student.uni.edu")).campus_label == "Almaty"
        assert await find_domain(db, "aru@evil-uni.edu") is None
        assert await find_domain(db, "aru@uni.edu.evil.com") is None


async def test_more_specific_domain_wins(hub):
    async with hub.sessions() as db:
        await add_domain(db, "uni.edu", "Almaty", "KZ")
        await add_domain(db, "tbilisi.uni.edu", "Tbilisi", "GE")
        assert (await find_domain(db, "nino@tbilisi.uni.edu")).campus_label == "Tbilisi"


async def test_inactive_domain_does_not_match(hub):
    async with hub.sessions() as db:
        domain = await add_domain(db, "uni.edu", "Almaty", "KZ")
        domain.is_active = False
        await db.commit()
        assert await find_domain(db, "aru@uni.edu") is None


async def test_request_new_domain(client):
    body = {"domain": "Newcampus.edu", "university_name": "New Campus University", "requester_email": "dana@newcampus.edu"}
    response = await client.post("/api/campuses/requests", json=body)
    assert response.status_code == 201
    first = response.json()
    assert first["status"] == "pending"
    again = await client.post("/api/campuses/requests", json=body)
    assert again.json()["id"] == first["id"]


async def test_request_email_must_match_domain(client):
    body = {"domain": "newcampus.edu", "university_name": "New Campus University", "requester_email": "dana@gmail.com"}
    response = await client.post("/api/campuses/requests", json=body)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "email_domain_mismatch"


async def test_request_rejects_garbage_domain(client):
    body = {"domain": "not a domain", "university_name": "X University", "requester_email": "a@b.edu"}
    response = await client.post("/api/campuses/requests", json=body)
    assert response.json()["error"]["code"] == "invalid_domain"


async def test_request_for_allowed_domain_is_conflict(client, hub):
    async with hub.sessions() as db:
        await add_domain(db, "uni.edu", "Almaty", "KZ")
    body = {"domain": "uni.edu", "university_name": "Uni", "requester_email": "aru@uni.edu"}
    response = await client.post("/api/campuses/requests", json=body)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "domain_already_allowed"
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && uv run pytest tests/test_campuses.py -v`
Expected: `ModuleNotFoundError: No module named 'modernsi.campuses'`.

- [ ] **Step 3: Implement models, schemas, service, router**

`backend/src/modernsi/campuses/__init__.py`: docstring `"""Campuses: allowed e-mail domains and requests to add new ones.\nThis work made by Anfinogentov Nikita\n"""`.

`backend/src/modernsi/campuses/models.py`:

```python
"""
Tables of allowed e-mail domains (each one is a campus label) and of requests to add a domain.
This work made by Anfinogentov Nikita
"""
from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import mapped_column

from modernsi.core.db import Base, utcnow


class EmailDomain(Base):
    __tablename__ = "email_domains"

    id = mapped_column(Integer, primary_key=True)
    domain = mapped_column(String(253), unique=True, nullable=False)
    campus_label = mapped_column(String(80), nullable=False)
    country_code = mapped_column(String(2), nullable=False)
    is_active = mapped_column(Boolean, nullable=False, default=True)
    created_at = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


class DomainRequest(Base):
    __tablename__ = "domain_requests"

    id = mapped_column(Integer, primary_key=True)
    domain = mapped_column(String(253), nullable=False, index=True)
    university_name = mapped_column(String(160), nullable=False)
    requester_email = mapped_column(String(320), nullable=False)
    status = mapped_column(String(10), nullable=False, default="pending")
    created_at = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
```

`backend/src/modernsi/campuses/schemas.py`:

```python
"""
Request and response shapes of the campuses module.
This work made by Anfinogentov Nikita
"""
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class DomainRequestCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    domain: str = Field(min_length=3, max_length=253)
    university_name: str = Field(min_length=2, max_length=160)
    requester_email: EmailStr


class DomainRequestOut(BaseModel):
    id: int
    status: str


class CampusOut(BaseModel):
    campus_label: str
    country_code: str
    students: int
```

`backend/src/modernsi/campuses/service.py`:

```python
"""
Campus logic: which e-mail domains may sign up and what campus label they carry.
This work made by Anfinogentov Nikita
"""
import re

from sqlalchemy import select

from modernsi.campuses.models import DomainRequest, EmailDomain
from modernsi.core.errors import api_error

domain_pattern = re.compile(r"^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$")


def domain_of(email):
    return email.strip().lower().rsplit("@", 1)[-1]


def candidate_domains(domain):
    # student.uni.edu -> student.uni.edu, uni.edu (never the bare TLD)
    parts = domain.split(".")
    return [".".join(parts[i:]) for i in range(len(parts) - 1)]


async def find_domain(db, email):
    candidates = candidate_domains(domain_of(email))
    rows = (await db.execute(
        select(EmailDomain).where(EmailDomain.domain.in_(candidates), EmailDomain.is_active.is_(True))
    )).scalars().all()
    if not rows:
        return None
    return max(rows, key=lambda row: len(row.domain))


async def add_domain(db, domain, campus_label, country_code):
    domain = domain.strip().lower()
    if not domain_pattern.match(domain):
        raise api_error(422, "invalid_domain", "This does not look like a domain")
    row = (await db.execute(select(EmailDomain).where(EmailDomain.domain == domain))).scalar_one_or_none()
    if row is None:
        row = EmailDomain(domain=domain, campus_label=campus_label.strip(), country_code=country_code.strip().upper())
        db.add(row)
    else:
        row.campus_label = campus_label.strip()
        row.country_code = country_code.strip().upper()
        row.is_active = True
    await db.commit()
    return row


async def create_request(db, data):
    domain = data.domain.strip().lower()
    if not domain_pattern.match(domain):
        raise api_error(422, "invalid_domain", "This does not look like a domain")
    email = data.requester_email.strip().lower()
    email_domain = domain_of(email)
    if email_domain != domain and not email_domain.endswith("." + domain):
        raise api_error(422, "email_domain_mismatch", "Use an e-mail address on the domain you are requesting")
    if await find_domain(db, email) is not None:
        raise api_error(409, "domain_already_allowed", "This domain is already allowed, you can sign up")
    existing = (await db.execute(select(DomainRequest).where(
        DomainRequest.domain == domain, DomainRequest.requester_email == email, DomainRequest.status == "pending"
    ))).scalar_one_or_none()
    if existing is not None:
        return existing
    row = DomainRequest(domain=domain, university_name=data.university_name, requester_email=email)
    db.add(row)
    await db.commit()
    return row
```

`backend/src/modernsi/campuses/router.py`:

```python
"""
HTTP endpoints of the campuses module.
This work made by Anfinogentov Nikita
"""
from fastapi import APIRouter, Depends, Request

from modernsi.campuses import service
from modernsi.campuses.schemas import DomainRequestCreate, DomainRequestOut
from modernsi.core.db import get_db
from modernsi.core.deps import get_config, get_hub
from modernsi.core.ratelimit import hit
from modernsi.core.security import client_ip

router = APIRouter(prefix="/api/campuses", tags=["campuses"])


@router.post("/requests", status_code=201, response_model=DomainRequestOut)
async def request_domain(data: DomainRequestCreate, request: Request, db=Depends(get_db), hub=Depends(get_hub), settings=Depends(get_config)):
    await hit(hub.redis, "domain_request:" + client_ip(request, settings), settings.rl_register_per_hour, 3600)
    row = await service.create_request(db, data)
    return {"id": row.id, "status": row.status}
```

Modify `backend/src/modernsi/models.py` — append:

```python
from modernsi.campuses import models as campuses_models  # noqa: F401,E402
```

Modify `backend/src/modernsi/app.py` — add import `from modernsi.campuses.router import router as campuses_router` and change `routers()` to `return [health_router, campuses_router]`.

Modify `backend/src/modernsi/cli.py` — add at the end:

```python
@cli.command("add-domain")
def add_domain_command(domain: str, label: str = typer.Option(..., help="Campus label shown next to names"), country: str = typer.Option(..., help="ISO country code, e.g. KZ")):
    """Allow sign-ups from DOMAIN (and its subdomains) under a campus label."""
    from modernsi.campuses.service import add_domain

    async def work(hub):
        async with hub.sessions() as db:
            row = await add_domain(db, domain, label, country)
            typer.echo(f"allowed {row.domain} as {row.campus_label} ({row.country_code})")

    run_with_hub(work)
```

- [ ] **Step 4: Generate and apply the migration**

Run:
```bash
cd backend && uv run alembic upgrade head && uv run alembic revision --autogenerate -m "campuses" && uv run alembic upgrade head
```
Expected: a new file in `migrations/versions/` containing `op.create_table('email_domains'` and `op.create_table('domain_requests'`.

- [ ] **Step 5: Run tests**

Run: `cd backend && uv run pytest -v`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add backend
git commit -m "Add campuses module: allowed domains and domain requests"
```

---

### Task B4: Outbox and mail queue

**Files:**
- Create: `backend/src/modernsi/feed/models.py`, `feed/outbox.py`
- Create: `backend/src/modernsi/mail/__init__.py`, `mail/models.py`, `mail/sender.py`, `mail/queue.py`, `mail/templates.py`
- Modify: `backend/src/modernsi/models.py`
- Create: `backend/migrations/versions/<generated>_outbox_mail.py`
- Test: `backend/tests/test_mail.py`

**Interfaces:**
- Produces: ORM `Outbox(id, uid, kind, actor_id, idea_id, event_id, campus_label, data, created_at, shipped_at)`; `emit(db, kind, actor_id=None, idea_id=None, event_id=None, campus_label=None, data=None)` (adds to the session, caller commits); ORM `MailQueue(id, to_email, subject, body, created_at, sent_at, attempts, last_error)`; `enqueue(db, to_email, subject, body)` (caller commits); `await send_now(settings, to_email, subject, body)`; `await send_pending(hub, limit=50) -> int` (number sent); templates `verify_code(code)`, `reset_code(code)`, `domain_approved(domain, site_url)`, `idea_in_review(title, url)`, `idea_decided(title, decision, note, url)`, `team_formed(title, url)`, `event_published(title, url)` — each returns `(subject, body)`.

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_mail.py`:

```python
"""
Mail: direct sending through SMTP (Mailpit in tests) and the retrying queue.
This work made by Anfinogentov Nikita
"""
from sqlalchemy import select

from modernsi.core.config import Settings
from modernsi.feed.models import Outbox
from modernsi.feed.outbox import emit
from modernsi.mail import templates
from modernsi.mail.models import MailQueue
from modernsi.mail.queue import enqueue, send_pending
from modernsi.mail.sender import send_now
from tests.helpers import last_mail


async def test_send_now_delivers(settings):
    subject, body = templates.verify_code("123456")
    await send_now(settings, "aru@uni.edu", subject, body)
    mail = await last_mail("aru@uni.edu")
    assert "123456" in mail["text"]
    assert "123456" in mail["subject"]


async def test_queue_sends_and_marks(hub):
    async with hub.sessions() as db:
        enqueue(db, "aru@uni.edu", "Hello", "Body text")
        await db.commit()
    assert await send_pending(hub) == 1
    assert (await last_mail("aru@uni.edu"))["subject"] == "Hello"
    async with hub.sessions() as db:
        row = (await db.execute(select(MailQueue))).scalar_one()
        assert row.sent_at is not None
    assert await send_pending(hub) == 0


async def test_queue_counts_failures(hub, monkeypatch):
    broken = Settings(_env_file=None, smtp_port=1)
    monkeypatch.setattr(hub, "settings", broken)
    async with hub.sessions() as db:
        enqueue(db, "aru@uni.edu", "Hello", "Body")
        await db.commit()
    assert await send_pending(hub) == 0
    async with hub.sessions() as db:
        row = (await db.execute(select(MailQueue))).scalar_one()
        assert row.attempts == 1
        assert row.sent_at is None
        assert row.last_error


async def test_emit_adds_outbox_row(hub):
    async with hub.sessions() as db:
        emit(db, "idea_created", campus_label="Almaty", data={"idea_title": "Food festival"})
        await db.commit()
        row = (await db.execute(select(Outbox))).scalar_one()
        assert row.kind == "idea_created"
        assert row.data == {"idea_title": "Food festival"}
        assert row.uid is not None
        assert row.shipped_at is None
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && uv run pytest tests/test_mail.py -v`
Expected: `ModuleNotFoundError: No module named 'modernsi.feed.models'`.

- [ ] **Step 3: Implement**

`backend/src/modernsi/feed/models.py`:

```python
"""
Transactional outbox: feed events written in the same transaction as the action, shipped to ClickHouse later.
This work made by Anfinogentov Nikita
"""
import uuid

from sqlalchemy import BigInteger, DateTime, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import mapped_column

from modernsi.core.db import Base, utcnow


class Outbox(Base):
    __tablename__ = "outbox"

    id = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    uid = mapped_column(Uuid, nullable=False, unique=True, default=uuid.uuid4)
    kind = mapped_column(String(40), nullable=False)
    # no foreign keys on purpose: the feed must outlive hidden or deleted rows
    actor_id = mapped_column(Uuid, nullable=True)
    idea_id = mapped_column(Uuid, nullable=True)
    event_id = mapped_column(Uuid, nullable=True)
    campus_label = mapped_column(String(80), nullable=True)
    data = mapped_column(JSONB, nullable=True)
    created_at = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    shipped_at = mapped_column(DateTime(timezone=True), nullable=True, index=True)
```

`backend/src/modernsi/feed/outbox.py`:

```python
"""
emit(): the only way modules put something into the activity feed.
This work made by Anfinogentov Nikita
"""
from modernsi.feed.models import Outbox

kinds = {"user_verified", "idea_created", "idea_reached_review", "idea_decided", "team_formed", "event_published"}


def emit(db, kind, actor_id=None, idea_id=None, event_id=None, campus_label=None, data=None):
    # I only add the row; the caller commits it together with the action itself
    if kind not in kinds:
        raise ValueError("unknown feed kind: " + kind)
    db.add(Outbox(kind=kind, actor_id=actor_id, idea_id=idea_id, event_id=event_id, campus_label=campus_label, data=data or {}))
```

`backend/src/modernsi/mail/__init__.py`: docstring `"""Mail: SMTP sending, a retrying queue and plain-text templates.\nThis work made by Anfinogentov Nikita\n"""`.

`backend/src/modernsi/mail/models.py`:

```python
"""
Mail queue: notifications are written in the action's transaction and sent by the worker.
This work made by Anfinogentov Nikita
"""
from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import mapped_column

from modernsi.core.db import Base, utcnow


class MailQueue(Base):
    __tablename__ = "mail_queue"

    id = mapped_column(Integer, primary_key=True)
    to_email = mapped_column(String(320), nullable=False)
    subject = mapped_column(String(200), nullable=False)
    body = mapped_column(Text, nullable=False)
    created_at = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    sent_at = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    attempts = mapped_column(Integer, nullable=False, default=0)
    last_error = mapped_column(Text, nullable=True)
```

`backend/src/modernsi/mail/sender.py`:

```python
"""
Sends one plain-text e-mail over SMTP. smtplib is blocking, so I run it in a thread.
This work made by Anfinogentov Nikita
"""
import asyncio
import smtplib
from email.message import EmailMessage


def send_blocking(settings, to_email, subject, body):
    message = EmailMessage()
    message["From"] = settings.mail_from
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(body)
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
        if settings.smtp_starttls:
            smtp.starttls()
        if settings.smtp_user:
            smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(message)


async def send_now(settings, to_email, subject, body):
    await asyncio.to_thread(send_blocking, settings, to_email, subject, body)
```

`backend/src/modernsi/mail/queue.py`:

```python
"""
Mail queue helpers: enqueue inside a transaction, send_pending from the worker with retries.
This work made by Anfinogentov Nikita
"""
import logging

from sqlalchemy import select

from modernsi.core.db import utcnow
from modernsi.mail.models import MailQueue
from modernsi.mail.sender import send_now

log = logging.getLogger("modernsi.mail")
max_attempts = 5


def enqueue(db, to_email, subject, body):
    db.add(MailQueue(to_email=to_email, subject=subject, body=body))


async def send_pending(hub, limit=50):
    sent = 0
    async with hub.sessions() as db:
        rows = (await db.execute(
            select(MailQueue)
            .where(MailQueue.sent_at.is_(None), MailQueue.attempts < max_attempts)
            .order_by(MailQueue.id)
            .limit(limit)
            .with_for_update(skip_locked=True)
        )).scalars().all()
        for row in rows:
            try:
                await send_now(hub.settings, row.to_email, row.subject, row.body)
                row.sent_at = utcnow()
                sent += 1
            except Exception as exc:
                row.attempts += 1
                row.last_error = repr(exc)[:1000]
                log.warning("mail to %s failed: %r", row.to_email, exc)
        await db.commit()
    return sent
```

`backend/src/modernsi/mail/templates.py`:

```python
"""
Plain-text e-mails. Every function returns (subject, body).
This work made by Anfinogentov Nikita
"""

signature = "\n\n— ModernSI, an independent international student network"


def verify_code(code):
    return (
        f"Your ModernSI code: {code}",
        f"Your confirmation code is {code}.\nIt works for 15 minutes.\n\nIf you did not sign up for ModernSI, ignore this e-mail." + signature,
    )


def reset_code(code):
    return (
        f"Reset your ModernSI password: {code}",
        f"Your password reset code is {code}.\nIt works for 15 minutes.\n\nIf you did not ask to reset your password, ignore this e-mail." + signature,
    )


def domain_approved(domain, site_url):
    return (
        "Your university is now on ModernSI",
        f"Good news: e-mail addresses on {domain} can now join ModernSI.\nSign up here: {site_url}/join" + signature,
    )


def idea_in_review(title, url):
    return (
        f"Your idea is in review: {title}",
        f"“{title}” collected enough support and went to Student Government for review.\nFollow it here: {url}" + signature,
    )


def idea_decided(title, decision, note, url):
    headline = {
        "approve": "was approved — now gather a team",
        "reject": "was not approved",
        "needs_changes": "needs a few changes",
    }[decision]
    note_text = f"\n\nNote from Student Government:\n{note}" if note else ""
    return (f"Your idea {headline}: {title}", f"“{title}” {headline}.{note_text}\n\nOpen it: {url}" + signature)


def team_formed(title, url):
    return (
        f"The team is ready: {title}",
        f"Enough people joined the team for “{title}”. Set a date and place to put it on the Hub: {url}" + signature,
    )


def event_published(title, url):
    return (
        f"It is on the Hub: {title}",
        f"An event for “{title}”, the idea you are part of, is now on the Hub: {url}" + signature,
    )
```

Modify `backend/src/modernsi/models.py` — append:

```python
from modernsi.feed import models as feed_models  # noqa: F401,E402
from modernsi.mail import models as mail_models  # noqa: F401,E402
```

- [ ] **Step 4: Generate and apply the migration**

Run: `cd backend && uv run alembic revision --autogenerate -m "outbox and mail queue" && uv run alembic upgrade head`
Expected: new revision with `create_table('outbox'` and `create_table('mail_queue'`.

- [ ] **Step 5: Run tests**

Run: `cd backend && uv run pytest -v`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add backend
git commit -m "Add feed outbox and mail queue with SMTP sender and templates"
```

---

### Task B5: Users, passwords, sessions, one-time codes

**Files:**
- Create: `backend/src/modernsi/auth/__init__.py`, `auth/models.py`, `auth/passwords.py`, `auth/sessions.py`, `auth/codes.py`
- Modify: `backend/src/modernsi/models.py`, `backend/tests/helpers.py`
- Create: `backend/migrations/versions/<generated>_users.py`
- Test: `backend/tests/test_auth_units.py`

**Interfaces:**
- Consumes: `EmailDomain`, `add_domain`, `find_domain`, `api_error`, `utcnow`.
- Produces: ORM `User(id, email, password_hash, display_name, email_domain_id, role, status, created_at, verified_at, domain)` with property `campus_label`; `roles = ("student", "student_gov", "curator", "admin")`; `hash_password(password) -> str`; `verify_password(stored_hash, password) -> bool`; `await create_session(redis, user_id, days) -> token`; `await resolve_session(redis, token, days) -> str | None` (user id, sliding TTL); `await drop_session(redis, token)`; `await drop_all_sessions(redis, user_id)`; `await issue_code(redis, purpose, user_id, daily_limit) -> "123456"`; `await check_code(redis, purpose, user_id, code)`; `await clear_cooldown(redis, purpose, user_id)`. Error codes: `code_cooldown`, `code_daily_limit`, `code_expired`, `invalid_code`, `too_many_attempts`. Test helpers `make_user(hub, ...)`, `login_as(client, hub, user)`, `mail_count()`.

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_auth_units.py`:

```python
"""
Units of the auth module: password hashing, Redis sessions and one-time codes.
This work made by Anfinogentov Nikita
"""
import uuid

import pytest

from modernsi.auth.codes import check_code, issue_code
from modernsi.auth.passwords import hash_password, verify_password
from modernsi.auth.sessions import create_session, drop_all_sessions, drop_session, resolve_session
from modernsi.core.errors import api_error


async def test_password_roundtrip():
    stored = hash_password("correct horse battery")
    assert stored.startswith("$argon2id$")
    assert verify_password(stored, "correct horse battery")
    assert not verify_password(stored, "wrong horse battery")
    assert not verify_password("garbage", "anything")


async def test_session_lifecycle(hub):
    user_id = uuid.uuid4()
    token = await create_session(hub.redis, user_id, 30)
    assert await resolve_session(hub.redis, token, 30) == str(user_id)
    await drop_session(hub.redis, token)
    assert await resolve_session(hub.redis, token, 30) is None


async def test_session_token_is_not_stored_in_clear(hub):
    token = await create_session(hub.redis, uuid.uuid4(), 30)
    keys = await hub.redis.keys("session:*")
    assert keys and all(token not in key for key in keys)


async def test_drop_all_sessions(hub):
    user_id = uuid.uuid4()
    first = await create_session(hub.redis, user_id, 30)
    second = await create_session(hub.redis, user_id, 30)
    await drop_all_sessions(hub.redis, user_id)
    assert await resolve_session(hub.redis, first, 30) is None
    assert await resolve_session(hub.redis, second, 30) is None


async def test_code_accepts_right_code_once(hub):
    user_id = uuid.uuid4()
    code = await issue_code(hub.redis, "verify", user_id, 10)
    assert len(code) == 6 and code.isdigit()
    await check_code(hub.redis, "verify", user_id, code)
    with pytest.raises(api_error) as caught:
        await check_code(hub.redis, "verify", user_id, code)
    assert caught.value.code == "code_expired"


async def test_code_wrong_then_locked_after_five(hub):
    user_id = uuid.uuid4()
    code = await issue_code(hub.redis, "verify", user_id, 10)
    wrong = "000000" if code != "000000" else "111111"
    for _ in range(5):
        with pytest.raises(api_error) as caught:
            await check_code(hub.redis, "verify", user_id, wrong)
        assert caught.value.code == "invalid_code"
    with pytest.raises(api_error) as caught:
        await check_code(hub.redis, "verify", user_id, code)
    assert caught.value.code == "too_many_attempts"


async def test_code_resend_cooldown_and_daily_limit(hub):
    user_id = uuid.uuid4()
    await issue_code(hub.redis, "verify", user_id, 2)
    with pytest.raises(api_error) as caught:
        await issue_code(hub.redis, "verify", user_id, 2)
    assert caught.value.code == "code_cooldown"
    await hub.redis.delete(f"code_cooldown:verify:{user_id}")
    await issue_code(hub.redis, "verify", user_id, 2)
    await hub.redis.delete(f"code_cooldown:verify:{user_id}")
    with pytest.raises(api_error) as caught:
        await issue_code(hub.redis, "verify", user_id, 2)
    assert caught.value.code == "code_daily_limit"
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && uv run pytest tests/test_auth_units.py -v`
Expected: `ModuleNotFoundError: No module named 'modernsi.auth'`.

- [ ] **Step 3: Implement**

`backend/src/modernsi/auth/__init__.py`: docstring `"""Auth: accounts, university e-mail confirmation, sessions and roles.\nThis work made by Anfinogentov Nikita\n"""`.

`backend/src/modernsi/auth/models.py`:

```python
"""
User accounts. The campus label comes from the allowed e-mail domain the user signed up with.
This work made by Anfinogentov Nikita
"""
import uuid

from sqlalchemy import DateTime, ForeignKey, String, Uuid
from sqlalchemy.orm import mapped_column, relationship

from modernsi.campuses.models import EmailDomain
from modernsi.core.db import Base, utcnow

roles = ("student", "student_gov", "curator", "admin")


class User(Base):
    __tablename__ = "users"

    id = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email = mapped_column(String(320), unique=True, nullable=False)
    password_hash = mapped_column(String(255), nullable=False)
    display_name = mapped_column(String(60), nullable=False)
    # nullable only for admins created from the CLI with a non-university address
    email_domain_id = mapped_column(ForeignKey("email_domains.id"), nullable=True, index=True)
    role = mapped_column(String(20), nullable=False, default="student")
    status = mapped_column(String(10), nullable=False, default="pending", index=True)
    created_at = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    verified_at = mapped_column(DateTime(timezone=True), nullable=True)

    domain = relationship(EmailDomain, lazy="joined")

    @property
    def campus_label(self):
        return self.domain.campus_label if self.domain is not None else None
```

`backend/src/modernsi/auth/passwords.py`:

```python
"""
Password hashing with argon2id.
This work made by Anfinogentov Nikita
"""
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

hasher = PasswordHasher()


def hash_password(password):
    return hasher.hash(password)


def verify_password(stored_hash, password):
    try:
        return hasher.verify(stored_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False
```

`backend/src/modernsi/auth/sessions.py`:

```python
"""
Sessions in Redis. The cookie holds a random token; Redis only sees its SHA-256, so a dump leaks no live tokens.
This work made by Anfinogentov Nikita
"""
import hashlib
import secrets


def session_key(token):
    return "session:" + hashlib.sha256(token.encode()).hexdigest()


def user_set_key(user_id):
    return f"user_sessions:{user_id}"


async def create_session(redis, user_id, days):
    token = secrets.token_urlsafe(32)
    key = session_key(token)
    ttl = days * 86400
    async with redis.pipeline(transaction=True) as pipe:
        pipe.set(key, str(user_id), ex=ttl)
        pipe.sadd(user_set_key(user_id), key)
        pipe.expire(user_set_key(user_id), ttl)
        await pipe.execute()
    return token


async def resolve_session(redis, token, days):
    key = session_key(token)
    user_id = await redis.get(key)
    if user_id is None:
        return None
    # sliding expiry: every request pushes the end of the session 30 days forward
    ttl = days * 86400
    async with redis.pipeline(transaction=False) as pipe:
        pipe.expire(key, ttl)
        pipe.expire(user_set_key(user_id), ttl)
        await pipe.execute()
    return user_id


async def drop_session(redis, token):
    key = session_key(token)
    user_id = await redis.get(key)
    await redis.delete(key)
    if user_id is not None:
        await redis.srem(user_set_key(user_id), key)


async def drop_all_sessions(redis, user_id):
    keys = await redis.smembers(user_set_key(user_id))
    if keys:
        await redis.delete(*keys)
    await redis.delete(user_set_key(user_id))
```

`backend/src/modernsi/auth/codes.py`:

```python
"""
Six-digit one-time codes for e-mail confirmation and password reset: 15 minutes, 5 attempts,
one resend per minute and a daily cap.
This work made by Anfinogentov Nikita
"""
import hashlib
import hmac
import secrets

from modernsi.core.errors import api_error

code_ttl = 15 * 60
max_attempts = 5


def digest(code):
    return hashlib.sha256(code.encode()).hexdigest()


def cooldown_key(purpose, user_id):
    return f"code_cooldown:{purpose}:{user_id}"


async def issue_code(redis, purpose, user_id, daily_limit):
    if not await redis.set(cooldown_key(purpose, user_id), "1", ex=60, nx=True):
        raise api_error(429, "code_cooldown", "Wait a minute before asking for a new code")
    daily = f"code_daily:{purpose}:{user_id}"
    count = await redis.incr(daily)
    if count == 1:
        await redis.expire(daily, 86400)
    if count > daily_limit:
        raise api_error(429, "code_daily_limit", "Too many codes today, try again tomorrow")
    code = f"{secrets.randbelow(1_000_000):06d}"
    key = f"code:{purpose}:{user_id}"
    async with redis.pipeline(transaction=True) as pipe:
        pipe.delete(key)
        pipe.hset(key, mapping={"hash": digest(code), "attempts": 0})
        pipe.expire(key, code_ttl)
        await pipe.execute()
    return code


async def clear_cooldown(redis, purpose, user_id):
    # used when the e-mail could not be sent, so the user may retry at once
    await redis.delete(cooldown_key(purpose, user_id))


async def check_code(redis, purpose, user_id, code):
    key = f"code:{purpose}:{user_id}"
    stored = await redis.hget(key, "hash")
    if stored is None:
        raise api_error(400, "code_expired", "The code has expired, ask for a new one")
    attempts = await redis.hincrby(key, "attempts", 1)
    if attempts > max_attempts:
        await redis.delete(key)
        raise api_error(429, "too_many_attempts", "Too many wrong codes, ask for a new one")
    if not hmac.compare_digest(stored, digest(code)):
        raise api_error(400, "invalid_code", "This code is not right")
    await redis.delete(key)
```

Modify `backend/src/modernsi/models.py` — append:

```python
from modernsi.auth import models as auth_models  # noqa: F401,E402
```

Append to `backend/tests/helpers.py`:

```python


async def mail_count():
    async with httpx.AsyncClient(base_url=MAILPIT) as http:
        return (await http.get("/api/v1/messages")).json()["total"]


async def make_user(hub, email="aru@uni.edu", name="Aru", role="student", status="active", label="Almaty", country="KZ", password="correct horse battery"):
    # imported here because conftest loads this file before the auth module exists in early tasks
    from modernsi.auth.models import User
    from modernsi.auth.passwords import hash_password
    from modernsi.campuses.service import add_domain, find_domain
    from modernsi.core.db import utcnow

    async with hub.sessions() as db:
        domain = await find_domain(db, email)
        if domain is None:
            domain = await add_domain(db, email.split("@")[1], label, country)
        user = User(
            email=email, password_hash=hash_password(password), display_name=name, email_domain_id=domain.id,
            role=role, status=status, verified_at=utcnow() if status == "active" else None,
        )
        user.domain = domain
        db.add(user)
        await db.commit()
        return user


async def login_as(client, hub, user):
    from modernsi.auth.sessions import create_session

    token = await create_session(hub.redis, user.id, 30)
    client.cookies.set("msi_session", token)
    return client
```

- [ ] **Step 4: Generate and apply the migration**

Run: `cd backend && uv run alembic revision --autogenerate -m "users" && uv run alembic upgrade head`
Expected: new revision with `create_table('users'` and a foreign key to `email_domains.id`.

- [ ] **Step 5: Run tests**

Run: `cd backend && uv run pytest -v`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add backend
git commit -m "Add users, argon2 passwords, Redis sessions and one-time codes"
```

---

### Task B6: Registration, confirmation, login, logout, current user

**Files:**
- Create: `backend/src/modernsi/auth/schemas.py`, `auth/service.py`, `auth/deps.py`, `auth/router.py`
- Modify: `backend/src/modernsi/app.py` (`routers()`)
- Test: `backend/tests/test_auth_flow.py`

**Interfaces:**
- Consumes: B3 `find_domain`; B4 `emit`, `send_now`, `templates`; B5 everything.
- Produces:
  - Dependencies: `optional_user`, `current_user` (401 `not_authenticated`), `active_user` (403 `email_not_verified`), `require_roles(*roles)` (403 `forbidden`); `session_cookie = "msi_session"`; `set_session_cookie(response, token, settings)`, `clear_session_cookie(response, settings)`.
  - Service: `normalise_email(email)`, `await find_user_by_email(db, email)`, `await register(db, hub, settings, data) -> User`, `await verify(db, hub, user, code)`, `await resend_verification(hub, settings, user)`, `await login(db, hub, settings, data, ip) -> User`, `await send_code(hub, settings, user, purpose)`, `author_out(user) -> {"id", "display_name", "campus_label"}`.
  - Endpoints: `POST /api/auth/register` (201, `MeOut`), `POST /api/auth/verify` (`MeOut`), `POST /api/auth/verify/resend` (204), `POST /api/auth/login` (`MeOut`), `POST /api/auth/logout` (204), `POST /api/auth/logout-all` (204), `GET /api/auth/me` (`MeOut`).
  - `MeOut = {id, email, display_name, campus_label, role, status}`.
  - Error codes: `domain_not_allowed` (422), `email_taken` (409), `invalid_credentials` (401), `account_blocked` (403), `already_verified` (409), `mail_unavailable` (503).
  - Feed kind `user_verified` with `data={"display_name"}`.

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_auth_flow.py`:

```python
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
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && uv run pytest tests/test_auth_flow.py -v`
Expected: tests fail with `404` responses (routes do not exist yet).

- [ ] **Step 3: Implement**

`backend/src/modernsi/auth/schemas.py`:

```python
"""
Request and response shapes of the auth module.
This work made by Anfinogentov Nikita
"""
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, StringConstraints, field_validator


class EmailIn(BaseModel):
    email: EmailStr

    @field_validator("email", mode="before")
    @classmethod
    def strip_email(cls, value):
        # people paste addresses with spaces around them; I forgive that
        return value.strip() if isinstance(value, str) else value


class RegisterIn(EmailIn):
    password: str = Field(min_length=10, max_length=200)
    display_name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=60)]


class LoginIn(EmailIn):
    password: str = Field(min_length=1, max_length=200)


class VerifyIn(BaseModel):
    code: str = Field(pattern=r"^\d{6}$")


class ResetIn(EmailIn):
    code: str = Field(pattern=r"^\d{6}$")
    password: str = Field(min_length=10, max_length=200)


class MeOut(BaseModel):
    id: UUID
    email: str
    display_name: str
    campus_label: str | None
    role: str
    status: str


class AuthorOut(BaseModel):
    id: UUID
    display_name: str
    campus_label: str | None
```

`backend/src/modernsi/auth/service.py`:

```python
"""
Auth logic: sign-up limited to allowed university domains, confirmation codes, login and account lookups.
This work made by Anfinogentov Nikita
"""
import logging

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from modernsi.auth.codes import check_code, clear_cooldown, issue_code
from modernsi.auth.models import User
from modernsi.auth.passwords import hash_password, verify_password
from modernsi.campuses.service import find_domain
from modernsi.core.db import utcnow
from modernsi.core.errors import api_error
from modernsi.core.ratelimit import hit
from modernsi.feed.outbox import emit
from modernsi.mail import templates
from modernsi.mail.sender import send_now

log = logging.getLogger("modernsi.auth")
# I verify against this hash when the e-mail is unknown, so both answers take the same time
dummy_hash = hash_password("this is not anybody's password")


def normalise_email(email):
    return email.strip().lower()


def author_out(user):
    return {"id": user.id, "display_name": user.display_name, "campus_label": user.campus_label}


async def find_user_by_email(db, email):
    return (await db.execute(select(User).where(User.email == normalise_email(email)))).scalar_one_or_none()


async def send_code(hub, settings, user, purpose):
    code = await issue_code(hub.redis, purpose, user.id, settings.rl_codes_per_day)
    subject, body = templates.verify_code(code) if purpose == "verify" else templates.reset_code(code)
    try:
        await send_now(settings, user.email, subject, body)
    except Exception as exc:
        log.warning("could not send %s code to %s: %r", purpose, user.email, exc)
        await clear_cooldown(hub.redis, purpose, user.id)
        raise api_error(503, "mail_unavailable", "We could not send the e-mail, try again in a minute")


async def register(db, hub, settings, data):
    email = normalise_email(data.email)
    domain = await find_domain(db, email)
    if domain is None:
        raise api_error(422, "domain_not_allowed", "Your university e-mail domain is not on the list yet")
    if await find_user_by_email(db, email) is not None:
        raise api_error(409, "email_taken", "An account with this e-mail already exists")
    user = User(email=email, password_hash=hash_password(data.password), display_name=data.display_name)
    user.domain = domain
    db.add(user)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise api_error(409, "email_taken", "An account with this e-mail already exists")
    try:
        await send_code(hub, settings, user, "verify")
    except api_error:
        # the account exists and the user is logged in; the confirm page offers "send again"
        pass
    return user


async def verify(db, hub, user, code):
    if user.status == "active":
        return user
    await check_code(hub.redis, "verify", user.id, code)
    user.status = "active"
    user.verified_at = utcnow()
    emit(db, "user_verified", actor_id=user.id, campus_label=user.campus_label, data={"display_name": user.display_name})
    await db.commit()
    return user


async def resend_verification(hub, settings, user):
    if user.status == "active":
        raise api_error(409, "already_verified", "Your e-mail is already confirmed")
    await send_code(hub, settings, user, "verify")


async def login(db, hub, settings, data, ip):
    email = normalise_email(data.email)
    await hit(hub.redis, f"login:{ip}:{email}", settings.rl_login_per_15min, 900)
    user = await find_user_by_email(db, email)
    if user is None:
        verify_password(dummy_hash, data.password)
        raise api_error(401, "invalid_credentials", "Wrong e-mail or password")
    if not verify_password(user.password_hash, data.password):
        raise api_error(401, "invalid_credentials", "Wrong e-mail or password")
    if user.status == "blocked":
        raise api_error(403, "account_blocked", "This account is blocked")
    return user
```

`backend/src/modernsi/auth/deps.py`:

```python
"""
Who is calling: session cookie -> user, plus guards for confirmed users and roles.
This work made by Anfinogentov Nikita
"""
import uuid

from fastapi import Depends, Request

from modernsi.auth.models import User
from modernsi.auth.sessions import resolve_session
from modernsi.core.db import get_db
from modernsi.core.errors import api_error

session_cookie = "msi_session"


async def optional_user(request: Request, db=Depends(get_db)):
    token = request.cookies.get(session_cookie)
    if not token:
        return None
    hub = request.app.state.stores
    user_id = await resolve_session(hub.redis, token, request.app.state.settings.session_days)
    if user_id is None:
        return None
    user = await db.get(User, uuid.UUID(user_id))
    if user is None or user.status == "blocked":
        return None
    # the request log reads this to store an anonymised user hash
    request.state.user_id = user.id
    return user


async def current_user(user=Depends(optional_user)):
    if user is None:
        raise api_error(401, "not_authenticated", "Please log in first")
    return user


async def active_user(user=Depends(current_user)):
    if user.status != "active":
        raise api_error(403, "email_not_verified", "Confirm your e-mail first")
    return user


def require_roles(*allowed):
    async def checker(user=Depends(active_user)):
        if user.role not in allowed:
            raise api_error(403, "forbidden", "You do not have access to this")
        return user

    return checker


def set_session_cookie(response, token, settings):
    response.set_cookie(
        session_cookie, token, max_age=settings.session_days * 86400,
        httponly=True, secure=settings.cookie_secure, samesite="lax", path="/",
    )


def clear_session_cookie(response, settings):
    response.delete_cookie(session_cookie, path="/", httponly=True, secure=settings.cookie_secure, samesite="lax")
```

`backend/src/modernsi/auth/router.py`:

```python
"""
HTTP endpoints of the auth module.
This work made by Anfinogentov Nikita
"""
from fastapi import APIRouter, Depends, Request, Response

from modernsi.auth import service
from modernsi.auth.deps import clear_session_cookie, current_user, session_cookie, set_session_cookie
from modernsi.auth.schemas import LoginIn, MeOut, RegisterIn, VerifyIn
from modernsi.auth.sessions import create_session, drop_all_sessions, drop_session
from modernsi.core.db import get_db
from modernsi.core.deps import get_config, get_hub
from modernsi.core.ratelimit import hit
from modernsi.core.security import client_ip

router = APIRouter(prefix="/api/auth", tags=["auth"])


def me_out(user):
    return {
        "id": user.id, "email": user.email, "display_name": user.display_name,
        "campus_label": user.campus_label, "role": user.role, "status": user.status,
    }


@router.post("/register", status_code=201, response_model=MeOut)
async def register(data: RegisterIn, request: Request, response: Response, db=Depends(get_db), hub=Depends(get_hub), settings=Depends(get_config)):
    await hit(hub.redis, "register:" + client_ip(request, settings), settings.rl_register_per_hour, 3600)
    user = await service.register(db, hub, settings, data)
    set_session_cookie(response, await create_session(hub.redis, user.id, settings.session_days), settings)
    return me_out(user)


@router.post("/verify", response_model=MeOut)
async def verify(data: VerifyIn, user=Depends(current_user), db=Depends(get_db), hub=Depends(get_hub)):
    return me_out(await service.verify(db, hub, user, data.code))


@router.post("/verify/resend", status_code=204)
async def resend(user=Depends(current_user), hub=Depends(get_hub), settings=Depends(get_config)):
    await service.resend_verification(hub, settings, user)


@router.post("/login", response_model=MeOut)
async def login(data: LoginIn, request: Request, response: Response, db=Depends(get_db), hub=Depends(get_hub), settings=Depends(get_config)):
    user = await service.login(db, hub, settings, data, client_ip(request, settings))
    set_session_cookie(response, await create_session(hub.redis, user.id, settings.session_days), settings)
    return me_out(user)


@router.post("/logout", status_code=204)
async def logout(request: Request, response: Response, hub=Depends(get_hub), settings=Depends(get_config)):
    token = request.cookies.get(session_cookie)
    if token:
        await drop_session(hub.redis, token)
    clear_session_cookie(response, settings)


@router.post("/logout-all", status_code=204)
async def logout_all(response: Response, user=Depends(current_user), hub=Depends(get_hub), settings=Depends(get_config)):
    await drop_all_sessions(hub.redis, user.id)
    clear_session_cookie(response, settings)


@router.get("/me", response_model=MeOut)
async def me(user=Depends(current_user)):
    return me_out(user)
```

Modify `backend/src/modernsi/app.py` — add `from modernsi.auth.router import router as auth_router` and make `routers()` return `[health_router, campuses_router, auth_router]`.

- [ ] **Step 4: Run tests**

Run: `cd backend && uv run pytest -v`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend
git commit -m "Add sign-up with university e-mail, confirmation, login and logout"
```

---

### Task B7: Password reset and rate limits on auth

**Files:**
- Modify: `backend/src/modernsi/auth/service.py` (add `forgot_password`, `reset_password`), `auth/router.py` (two endpoints)
- Test: `backend/tests/test_password_reset.py`

**Interfaces:**
- Consumes: B5/B6.
- Produces: `POST /api/auth/password/forgot` `{email}` → always `202 {}`; `POST /api/auth/password/reset` `{email, code, password}` → `204`, ends every session of the user; wrong or unknown → `400 invalid_code`.

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_password_reset.py`:

```python
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
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && uv run pytest tests/test_password_reset.py -v`
Expected: the reset tests fail with 404; the rate-limit tests already pass (limits came with B6).

- [ ] **Step 3: Implement**

Append to `backend/src/modernsi/auth/service.py`:

```python


async def forgot_password(db, hub, settings, email):
    # the answer never tells whether the address exists
    user = await find_user_by_email(db, email)
    if user is None or user.status == "blocked":
        return
    try:
        await send_code(hub, settings, user, "reset")
    except api_error as exc:
        log.info("reset code not sent to %s: %s", user.email, exc.code)


async def reset_password(db, hub, data):
    user = await find_user_by_email(db, data.email)
    if user is None:
        raise api_error(400, "invalid_code", "This code is not right")
    await check_code(hub.redis, "reset", user.id, data.code)
    user.password_hash = hash_password(data.password)
    await db.commit()
    await drop_all_sessions(hub.redis, user.id)
```

and add `from modernsi.auth.sessions import drop_all_sessions` to its imports.

Append to `backend/src/modernsi/auth/router.py` (and add `EmailIn, ResetIn` to the schemas import):

```python


@router.post("/password/forgot", status_code=202)
async def forgot(data: EmailIn, request: Request, db=Depends(get_db), hub=Depends(get_hub), settings=Depends(get_config)):
    await hit(hub.redis, "forgot:" + client_ip(request, settings), settings.rl_login_per_15min, 900)
    await service.forgot_password(db, hub, settings, data.email)
    return {}


@router.post("/password/reset", status_code=204)
async def reset(data: ResetIn, request: Request, db=Depends(get_db), hub=Depends(get_hub), settings=Depends(get_config)):
    await hit(hub.redis, "reset:" + client_ip(request, settings), settings.rl_login_per_15min, 900)
    await service.reset_password(db, hub, data)
```

- [ ] **Step 4: Run tests**

Run: `cd backend && uv run pytest -v`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend
git commit -m "Add password reset by e-mailed code"
```

---

### Task B8: Admin API, campus list, create-admin CLI

**Files:**
- Create: `backend/src/modernsi/admin/__init__.py`, `admin/schemas.py`, `admin/router.py`
- Modify: `backend/src/modernsi/campuses/service.py` (domains admin, requests approve/reject, `list_campuses`), `campuses/router.py` (`GET /api/campuses`), `auth/service.py` (admin helpers), `app.py` (`routers()`), `cli.py` (`create-admin`)
- Test: `backend/tests/test_admin.py`

**Interfaces:**
- Consumes: B3–B7.
- Produces:
  - `GET /api/campuses` → `[{"campus_label", "country_code", "students"}]`, active domains only, grouped by label+country, sorted by students desc then label.
  - Admin endpoints (all `require_roles("admin")`):
    - `GET /api/admin/domains`, `POST /api/admin/domains` `{domain, campus_label, country_code}`, `PATCH /api/admin/domains/{id}` `{campus_label?, country_code?, is_active?}`;
    - `GET /api/admin/domain-requests?status=pending`, `POST /api/admin/domain-requests/{id}/approve` `{campus_label, country_code}`, `POST /api/admin/domain-requests/{id}/reject`;
    - `GET /api/admin/users?q=`, `PUT /api/admin/users/{id}/role` `{role}`, `POST /api/admin/users/{id}/block`, `POST /api/admin/users/{id}/unblock`.
  - Service:
    - auth: `await active_users_by_domain(db) -> {domain_id: count}`, `await get_public_user(db, user_id) -> User` (404 `user_not_found` unless active), `await set_role(db, user_id, role)`, `await block_user(db, hub, admin, user_id)`, `await unblock_user(db, user_id)`, `await search_users(db, query)`, `await create_admin(db, email, name, password)`;
    - campuses: `await approve_request(db, settings, request_id, label, country)`, `await reject_request(db, request_id)`.
  - Error codes: `request_not_found`, `domain_not_found`, `user_not_found` (404), `cannot_block_self` (409), `user_exists` (409).
  - CLI `modernsi create-admin --email --name` (password prompt).

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_admin.py`:

```python
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
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && uv run pytest tests/test_admin.py -v`
Expected: `ImportError: cannot import name 'create_admin'`.

- [ ] **Step 3: Implement**

Append to `backend/src/modernsi/auth/service.py` (add `from sqlalchemy import func, or_` and `from modernsi.auth.sessions import drop_all_sessions` to imports if not present):

```python


async def active_users_by_domain(db):
    rows = await db.execute(
        select(User.email_domain_id, func.count()).where(User.status == "active").group_by(User.email_domain_id)
    )
    return {domain_id: count for domain_id, count in rows.all()}


async def get_user(db, user_id):
    user = await db.get(User, user_id)
    if user is None:
        raise api_error(404, "user_not_found", "There is no such user")
    return user


async def get_public_user(db, user_id):
    user = await db.get(User, user_id)
    if user is None or user.status != "active":
        raise api_error(404, "user_not_found", "There is no such user")
    return user


async def set_role(db, user_id, role):
    user = await get_user(db, user_id)
    user.role = role
    await db.commit()
    return user


async def block_user(db, hub, admin, user_id):
    if admin.id == user_id:
        raise api_error(409, "cannot_block_self", "You cannot block yourself")
    user = await get_user(db, user_id)
    user.status = "blocked"
    await db.commit()
    await drop_all_sessions(hub.redis, user.id)
    return user


async def unblock_user(db, user_id):
    user = await get_user(db, user_id)
    user.status = "active" if user.verified_at is not None else "pending"
    await db.commit()
    return user


async def search_users(db, query, limit=50):
    statement = select(User).order_by(User.created_at.desc()).limit(limit)
    if query:
        pattern = f"%{query.strip().lower()}%"
        statement = statement.where(or_(User.email.like(pattern), func.lower(User.display_name).like(pattern)))
    return (await db.execute(statement)).scalars().all()


async def create_admin(db, email, name, password):
    email = normalise_email(email)
    if await find_user_by_email(db, email) is not None:
        raise api_error(409, "user_exists", "This e-mail already has an account")
    user = User(email=email, password_hash=hash_password(password), display_name=name.strip(), role="admin", status="active", verified_at=utcnow())
    user.domain = await find_domain(db, email)
    db.add(user)
    await db.commit()
    return user
```

Append to `backend/src/modernsi/campuses/service.py` (add imports `from modernsi.mail import templates` and `from modernsi.mail.queue import enqueue`):

```python


async def list_domains(db):
    return (await db.execute(select(EmailDomain).order_by(EmailDomain.domain))).scalars().all()


async def patch_domain(db, domain_id, data):
    row = await db.get(EmailDomain, domain_id)
    if row is None:
        raise api_error(404, "domain_not_found", "There is no such domain")
    if data.campus_label is not None:
        row.campus_label = data.campus_label.strip()
    if data.country_code is not None:
        row.country_code = data.country_code.upper()
    if data.is_active is not None:
        row.is_active = data.is_active
    await db.commit()
    return row


async def list_requests(db, status):
    return (await db.execute(
        select(DomainRequest).where(DomainRequest.status == status).order_by(DomainRequest.created_at)
    )).scalars().all()


async def get_request(db, request_id):
    row = await db.get(DomainRequest, request_id)
    if row is None:
        raise api_error(404, "request_not_found", "There is no such request")
    return row


async def approve_request(db, settings, request_id, campus_label, country_code):
    row = await get_request(db, request_id)
    await add_domain(db, row.domain, campus_label, country_code)
    # everyone who asked for the same domain gets the good news at once
    waiting = (await db.execute(select(DomainRequest).where(
        DomainRequest.domain == row.domain, DomainRequest.status == "pending"
    ))).scalars().all()
    subject, body = templates.domain_approved(row.domain, settings.site_url)
    for item in waiting:
        item.status = "approved"
        enqueue(db, item.requester_email, subject, body)
    await db.commit()
    return row


async def reject_request(db, request_id):
    row = await get_request(db, request_id)
    row.status = "rejected"
    await db.commit()
    return row


async def list_campuses(db):
    # imported here: auth depends on campuses, so a top-level import would be circular
    from modernsi.auth.service import active_users_by_domain

    counts = await active_users_by_domain(db)
    grouped = {}
    for row in await list_domains(db):
        if not row.is_active:
            continue
        key = (row.campus_label, row.country_code)
        grouped[key] = grouped.get(key, 0) + counts.get(row.id, 0)
    campuses = [{"campus_label": label, "country_code": country, "students": students} for (label, country), students in grouped.items()]
    return sorted(campuses, key=lambda item: (-item["students"], item["campus_label"]))
```

Append to `backend/src/modernsi/campuses/router.py` (add `CampusOut` to the schemas import):

```python


@router.get("", response_model=list[CampusOut])
async def campuses(db=Depends(get_db)):
    return await service.list_campuses(db)
```

`backend/src/modernsi/admin/__init__.py`: docstring `"""Admin API: domains, domain requests, roles, blocking, moderation.\nThis work made by Anfinogentov Nikita\n"""`.

`backend/src/modernsi/admin/schemas.py`:

```python
"""
Shapes of the admin API. Admins do see e-mail addresses; nobody else does.
This work made by Anfinogentov Nikita
"""
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

Role = Literal["student", "student_gov", "curator", "admin"]


class DomainIn(BaseModel):
    domain: str = Field(min_length=3, max_length=253)
    campus_label: str = Field(min_length=2, max_length=80)
    country_code: str = Field(pattern=r"^[A-Za-z]{2}$")


class DomainPatch(BaseModel):
    campus_label: str | None = Field(default=None, min_length=2, max_length=80)
    country_code: str | None = Field(default=None, pattern=r"^[A-Za-z]{2}$")
    is_active: bool | None = None


class DomainOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    domain: str
    campus_label: str
    country_code: str
    is_active: bool


class ApproveIn(BaseModel):
    campus_label: str = Field(min_length=2, max_length=80)
    country_code: str = Field(pattern=r"^[A-Za-z]{2}$")


class DomainRequestAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    domain: str
    university_name: str
    requester_email: str
    status: str
    created_at: datetime


class RoleIn(BaseModel):
    role: Role


class AdminUserOut(BaseModel):
    id: UUID
    email: str
    display_name: str
    campus_label: str | None
    role: str
    status: str
    created_at: datetime
```

`backend/src/modernsi/admin/router.py`:

```python
"""
Admin endpoints. Every route here needs the admin role.
This work made by Anfinogentov Nikita
"""
from uuid import UUID

from fastapi import APIRouter, Depends

from modernsi.admin.schemas import (
    AdminUserOut, ApproveIn, DomainIn, DomainOut, DomainPatch, DomainRequestAdminOut, RoleIn,
)
from modernsi.auth import service as auth_service
from modernsi.auth.deps import require_roles
from modernsi.campuses import service as campuses_service
from modernsi.core.db import get_db
from modernsi.core.deps import get_config, get_hub

admin_only = require_roles("admin")
router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(admin_only)])


def admin_user_out(user):
    return {
        "id": user.id, "email": user.email, "display_name": user.display_name, "campus_label": user.campus_label,
        "role": user.role, "status": user.status, "created_at": user.created_at,
    }


@router.get("/domains", response_model=list[DomainOut])
async def domains(db=Depends(get_db)):
    return await campuses_service.list_domains(db)


@router.post("/domains", status_code=201, response_model=DomainOut)
async def add_domain(data: DomainIn, db=Depends(get_db)):
    return await campuses_service.add_domain(db, data.domain, data.campus_label, data.country_code)


@router.patch("/domains/{domain_id}", response_model=DomainOut)
async def patch_domain(domain_id: int, data: DomainPatch, db=Depends(get_db)):
    return await campuses_service.patch_domain(db, domain_id, data)


@router.get("/domain-requests", response_model=list[DomainRequestAdminOut])
async def domain_requests(status: str = "pending", db=Depends(get_db)):
    return await campuses_service.list_requests(db, status)


@router.post("/domain-requests/{request_id}/approve", response_model=DomainRequestAdminOut)
async def approve(request_id: int, data: ApproveIn, db=Depends(get_db), settings=Depends(get_config)):
    return await campuses_service.approve_request(db, settings, request_id, data.campus_label, data.country_code)


@router.post("/domain-requests/{request_id}/reject", response_model=DomainRequestAdminOut)
async def reject(request_id: int, db=Depends(get_db)):
    return await campuses_service.reject_request(db, request_id)


@router.get("/users", response_model=list[AdminUserOut])
async def users(q: str = "", db=Depends(get_db)):
    return [admin_user_out(user) for user in await auth_service.search_users(db, q)]


@router.put("/users/{user_id}/role", response_model=AdminUserOut)
async def set_role(user_id: UUID, data: RoleIn, db=Depends(get_db)):
    return admin_user_out(await auth_service.set_role(db, user_id, data.role))


@router.post("/users/{user_id}/block", response_model=AdminUserOut)
async def block(user_id: UUID, admin=Depends(admin_only), db=Depends(get_db), hub=Depends(get_hub)):
    return admin_user_out(await auth_service.block_user(db, hub, admin, user_id))


@router.post("/users/{user_id}/unblock", response_model=AdminUserOut)
async def unblock(user_id: UUID, db=Depends(get_db)):
    return admin_user_out(await auth_service.unblock_user(db, user_id))
```

Modify `backend/src/modernsi/app.py` — add `from modernsi.admin.router import router as admin_router`; `routers()` returns `[health_router, campuses_router, auth_router, admin_router]`.

Append to `backend/src/modernsi/cli.py`:

```python


@cli.command("create-admin")
def create_admin_command(email: str = typer.Option(...), name: str = typer.Option(...)):
    """Create the first admin account (asks for the password)."""
    from modernsi.auth.service import create_admin
    from modernsi.core.errors import api_error

    password = typer.prompt("Password", hide_input=True, confirmation_prompt=True)
    if len(password) < 10:
        typer.echo("Ooops.. the password needs at least 10 characters")
        raise typer.Exit(1)

    async def work(hub):
        async with hub.sessions() as db:
            try:
                user = await create_admin(db, email, name, password)
            except api_error as exc:
                typer.echo("Ooops.. " + exc.message)
                raise typer.Exit(1)
            typer.echo(f"admin {user.email} created")

    run_with_hub(work)
```

- [ ] **Step 4: Run tests**

Run: `cd backend && uv run pytest -v`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend
git commit -m "Add admin API, public campus list and create-admin command"
```

---

### Task B9: Profiles in MongoDB with GridFS avatars

**Files:**
- Create: `backend/src/modernsi/profiles/__init__.py`, `profiles/schemas.py`, `profiles/service.py`, `profiles/router.py`
- Modify: `backend/src/modernsi/app.py` (`routers()`)
- Test: `backend/tests/test_profiles.py`

**Interfaces:**
- Consumes: B6 `current_user`, `active_user`; B8 `get_public_user`.
- Produces:
  - `GET /api/profiles/me`, `PUT /api/profiles/me`, `PUT /api/profiles/me/avatar` (multipart field `file`, 204), `GET /api/profiles/{user_id}`, `GET /api/profiles/{user_id}/avatar`.
  - `ProfileOut = {id, display_name, campus_label, role, joined_at, bio, languages, interests, links, theme, has_avatar, extended}` — `extended: false` means MongoDB was unreachable and only the base fields are real.
  - Error codes: `avatar_too_large` (413), `avatar_bad_type` (422), `no_avatar` (404).

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_profiles.py`:

```python
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
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && uv run pytest tests/test_profiles.py -v`
Expected: failures with 404 (routes missing).

- [ ] **Step 3: Implement**

`backend/src/modernsi/profiles/__init__.py`: docstring `"""Profiles: bio, languages, interests, links, theme and avatar, kept in MongoDB.\nThis work made by Anfinogentov Nikita\n"""`.

`backend/src/modernsi/profiles/schemas.py`:

```python
"""
Shapes of the profiles module.
This work made by Anfinogentov Nikita
"""
from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl, StringConstraints

Language = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=30)]
Interest = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]


class ProfileUpdate(BaseModel):
    bio: str = Field(default="", max_length=500)
    languages: list[Language] = Field(default_factory=list, max_length=10)
    interests: list[Interest] = Field(default_factory=list, max_length=15)
    links: list[HttpUrl] = Field(default_factory=list, max_length=5)
    theme: Literal["system", "light", "dark"] = "system"


class ProfileOut(BaseModel):
    id: UUID
    display_name: str
    campus_label: str | None
    role: str
    joined_at: datetime
    bio: str = ""
    languages: list[str] = []
    interests: list[str] = []
    links: list[str] = []
    theme: str = "system"
    has_avatar: bool = False
    extended: bool = True
```

`backend/src/modernsi/profiles/service.py`:

```python
"""
Profile logic. Base fields come from Postgres, the rest from the MongoDB "profiles" collection,
avatars from the GridFS bucket "avatars".
This work made by Anfinogentov Nikita
"""
from gridfs import AsyncGridFSBucket
from gridfs.errors import NoFile
from pymongo.errors import PyMongoError

from modernsi.core.db import utcnow
from modernsi.core.errors import api_error

max_avatar = 2 * 1024 * 1024


def sniff_image(head):
    # I trust the bytes, not the file name or the browser's content type
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if head.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image/webp"
    return None


def avatars(hub):
    return AsyncGridFSBucket(hub.mongo, bucket_name="avatars")


async def get_profile(hub, user):
    profile = {
        "id": user.id, "display_name": user.display_name, "campus_label": user.campus_label,
        "role": user.role, "joined_at": user.created_at,
    }
    try:
        doc = await hub.mongo["profiles"].find_one({"_id": str(user.id)}) or {}
    except PyMongoError:
        profile["extended"] = False
        return profile
    profile.update(
        bio=doc.get("bio", ""), languages=doc.get("languages", []), interests=doc.get("interests", []),
        links=doc.get("links", []), theme=doc.get("theme", "system"), has_avatar=bool(doc.get("avatar_id")), extended=True,
    )
    return profile


async def update_profile(hub, user, data):
    fields = {
        "bio": data.bio, "languages": data.languages, "interests": data.interests,
        "links": [str(link) for link in data.links], "theme": data.theme, "updated_at": utcnow(),
    }
    await hub.mongo["profiles"].update_one({"_id": str(user.id)}, {"$set": fields}, upsert=True)
    return await get_profile(hub, user)


async def set_avatar(hub, user, content):
    if len(content) > max_avatar:
        raise api_error(413, "avatar_too_large", "The picture must be 2 MB or smaller")
    kind = sniff_image(content[:16])
    if kind is None:
        raise api_error(422, "avatar_bad_type", "Use a PNG, JPEG or WebP picture")
    bucket = avatars(hub)
    new_id = await bucket.upload_from_stream(str(user.id), content, metadata={"user_id": str(user.id), "content_type": kind})
    old = await hub.mongo["profiles"].find_one_and_update({"_id": str(user.id)}, {"$set": {"avatar_id": new_id}}, upsert=True)
    if old and old.get("avatar_id"):
        try:
            await bucket.delete(old["avatar_id"])
        except NoFile:
            pass


async def get_avatar(hub, user_id):
    doc = await hub.mongo["profiles"].find_one({"_id": str(user_id)})
    if not doc or not doc.get("avatar_id"):
        raise api_error(404, "no_avatar", "This user has no picture")
    stream = await avatars(hub).open_download_stream(doc["avatar_id"])
    return await stream.read(), stream.metadata["content_type"]
```

`backend/src/modernsi/profiles/router.py`:

```python
"""
HTTP endpoints of the profiles module.
This work made by Anfinogentov Nikita
"""
from uuid import UUID

from fastapi import APIRouter, Depends, UploadFile
from fastapi.responses import Response

from modernsi.auth.deps import active_user, current_user
from modernsi.auth.service import get_public_user
from modernsi.core.db import get_db
from modernsi.core.deps import get_hub
from modernsi.profiles import service
from modernsi.profiles.schemas import ProfileOut, ProfileUpdate

router = APIRouter(prefix="/api/profiles", tags=["profiles"])


@router.get("/me", response_model=ProfileOut)
async def my_profile(user=Depends(current_user), hub=Depends(get_hub)):
    return await service.get_profile(hub, user)


@router.put("/me", response_model=ProfileOut)
async def update_my_profile(data: ProfileUpdate, user=Depends(active_user), hub=Depends(get_hub)):
    return await service.update_profile(hub, user, data)


@router.put("/me/avatar", status_code=204)
async def upload_avatar(file: UploadFile, user=Depends(active_user), hub=Depends(get_hub)):
    content = await file.read(service.max_avatar + 1)
    await service.set_avatar(hub, user, content)


@router.get("/{user_id}", response_model=ProfileOut)
async def profile(user_id: UUID, db=Depends(get_db), hub=Depends(get_hub)):
    return await service.get_profile(hub, await get_public_user(db, user_id))


@router.get("/{user_id}/avatar")
async def avatar(user_id: UUID, hub=Depends(get_hub)):
    content, content_type = await service.get_avatar(hub, user_id)
    return Response(content, media_type=content_type, headers={"Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff"})
```

Modify `backend/src/modernsi/app.py` — add `from modernsi.profiles.router import router as profiles_router`; append `profiles_router` to `routers()`.

- [ ] **Step 4: Run tests**

Run: `cd backend && uv run pytest -v`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend
git commit -m "Add profiles in MongoDB with GridFS avatars"
```

---

### Task B10: Feed — outbox shipping, request log, feed and stats endpoints

**Files:**
- Create: `backend/src/modernsi/feed/shipper.py`, `feed/requestlog.py`, `feed/schemas.py`, `feed/service.py`, `feed/router.py`
- Modify: `backend/src/modernsi/app.py` (replace whole file)
- Test: `backend/tests/test_feed.py`

**Interfaces:**
- Consumes: B1 `stores`, `ensure_schema`, `ACTIVITY_COLUMNS`, `HTTP_COLUMNS`; B4 `Outbox`, `emit`, `MailQueue`; B6 `optional_user` (sets `request.state.user_id`).
- Produces:
  - Shipping: `await ship_outbox(hub, limit=500) -> int`, `await purge_old(hub)`.
  - Request log: `class request_log(salt)` with `.hub`, `.add(method, route, status, duration_ms, user_id)`, `await .flush() -> int`, `await .run(every=2.0)`; `install_request_log(app, log)`; `app.state.request_log`.
  - Service: `await list_feed(hub, db, cursor=None, limit=20, actor_id=None) -> {"items", "next_cursor"}`, `await stats(hub, settings)`.
  - `GET /api/feed?cursor=&limit=&mine=` → `{"items": [{"id", "kind", "at", "actor_id", "idea_id", "event_id", "campus_label", "data"}], "next_cursor"}`.
  - `GET /api/stats` → `{"students", "campuses", "ideas_to_events", "show_counters"}`.
  - Error codes: `feed_unavailable` (503), `bad_cursor` (422).

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_feed.py`:

```python
"""
Feed: outbox -> ClickHouse shipping, at-least-once without duplicates, outages, pagination, stats, request log.
This work made by Anfinogentov Nikita
"""
import asyncio
import uuid
from datetime import timedelta

from sqlalchemy import func, select, update

from modernsi.core.db import utcnow
from modernsi.feed.models import Outbox
from modernsi.feed.outbox import emit
from modernsi.feed.shipper import purge_old, ship_outbox
from tests.helpers import login_as, make_user


async def emit_now(hub, kind="idea_created", **fields):
    async with hub.sessions() as db:
        emit(db, kind, **fields)
        await db.commit()


async def test_outbox_reaches_feed(client, hub):
    await emit_now(hub, campus_label="Almaty", data={"actor_name": "Aru", "idea_title": "Food festival"})
    assert await ship_outbox(hub) == 1
    assert await ship_outbox(hub) == 0
    items = (await client.get("/api/feed")).json()["items"]
    assert len(items) == 1
    assert items[0]["kind"] == "idea_created"
    assert items[0]["campus_label"] == "Almaty"
    assert items[0]["data"] == {"actor_name": "Aru", "idea_title": "Food festival"}
    assert items[0]["at"].endswith("Z") or items[0]["at"].endswith("+00:00")


async def test_shipping_twice_does_not_duplicate(client, hub):
    await emit_now(hub)
    await ship_outbox(hub)
    async with hub.sessions() as db:
        await db.execute(update(Outbox).values(shipped_at=None))
        await db.commit()
    assert await ship_outbox(hub) == 1
    assert len((await client.get("/api/feed")).json()["items"]) == 1


async def test_clickhouse_outage_keeps_rows(client, hub, monkeypatch):
    await emit_now(hub)

    async def unreachable():
        return None

    monkeypatch.setattr(hub, "get_clickhouse", unreachable)
    assert await ship_outbox(hub) == 0
    response = await client.get("/api/feed")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "feed_unavailable"
    assert (await client.get("/api/stats")).status_code == 503
    monkeypatch.undo()
    assert await ship_outbox(hub) == 1


async def test_failed_insert_rolls_back_and_reconnects(hub, monkeypatch):
    await emit_now(hub)
    client = await hub.get_clickhouse()

    async def broken_insert(*args, **kwargs):
        raise ConnectionError("clickhouse went away")

    monkeypatch.setattr(client, "insert", broken_insert)
    assert await ship_outbox(hub) == 0
    assert hub.clickhouse is None
    async with hub.sessions() as db:
        assert (await db.execute(select(func.count()).select_from(Outbox).where(Outbox.shipped_at.is_(None)))).scalar() == 1
    monkeypatch.undo()
    hub.clickhouse_tried_at = float("-inf")
    assert await ship_outbox(hub) == 1


async def test_pagination(client, hub):
    for number in range(3):
        await emit_now(hub, data={"n": number})
        # ClickHouse keeps milliseconds; I keep the rows apart so the order is unambiguous
        await asyncio.sleep(0.005)
    await ship_outbox(hub)
    first = (await client.get("/api/feed", params={"limit": 2})).json()
    assert [item["data"]["n"] for item in first["items"]] == [2, 1]
    assert first["next_cursor"]
    second = (await client.get("/api/feed", params={"limit": 2, "cursor": first["next_cursor"]})).json()
    assert [item["data"]["n"] for item in second["items"]] == [0]
    assert second["next_cursor"] is None


async def test_bad_cursor(client):
    response = await client.get("/api/feed", params={"cursor": "nonsense"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "bad_cursor"


async def test_mine_needs_login_and_filters(client, hub):
    assert (await client.get("/api/feed", params={"mine": "true"})).status_code == 401
    user = await make_user(hub)
    await emit_now(hub, actor_id=user.id, data={"n": "mine"})
    await emit_now(hub, actor_id=uuid.uuid4(), data={"n": "other"})
    await ship_outbox(hub)
    await login_as(client, hub, user)
    items = (await client.get("/api/feed", params={"mine": "true"})).json()["items"]
    assert [item["data"]["n"] for item in items] == ["mine"]


async def test_stats(client, hub, settings, monkeypatch):
    await emit_now(hub, "user_verified", actor_id=uuid.uuid4(), campus_label="Almaty")
    await emit_now(hub, "user_verified", actor_id=uuid.uuid4(), campus_label="Tbilisi")
    await emit_now(hub, "event_published", idea_id=uuid.uuid4(), event_id=uuid.uuid4())
    await emit_now(hub, "event_published", event_id=uuid.uuid4())
    await ship_outbox(hub)
    assert (await client.get("/api/stats")).json() == {"students": 2, "campuses": 2, "ideas_to_events": 1, "show_counters": False}
    monkeypatch.setattr(settings, "stats_min_students", 2)
    assert (await client.get("/api/stats")).json()["show_counters"] is True


async def test_request_log_reaches_clickhouse(client, app, hub):
    await client.get("/api/health")
    await app.state.request_log.flush()
    clickhouse = await hub.get_clickhouse()
    count = await clickhouse.command("SELECT count() FROM http_requests WHERE route = '/api/health' AND status = 200")
    assert count >= 1


async def test_purge_old_rows(hub):
    await emit_now(hub)
    async with hub.sessions() as db:
        await db.execute(update(Outbox).values(shipped_at=utcnow() - timedelta(days=8)))
        await db.commit()
    await purge_old(hub)
    async with hub.sessions() as db:
        assert (await db.execute(select(func.count()).select_from(Outbox))).scalar() == 0
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && uv run pytest tests/test_feed.py -v`
Expected: `ModuleNotFoundError: No module named 'modernsi.feed.shipper'`.

- [ ] **Step 3: Implement**

`backend/src/modernsi/feed/shipper.py`:

```python
"""
Moves outbox rows into ClickHouse. At-least-once: a row may be sent twice, ReplacingMergeTree folds the copies.
This work made by Anfinogentov Nikita
"""
import json
import logging
from datetime import timedelta

from sqlalchemy import delete, select

from modernsi.core.db import utcnow
from modernsi.feed.models import Outbox
from modernsi.feed.schema import ACTIVITY_COLUMNS
from modernsi.mail.models import MailQueue

log = logging.getLogger("modernsi.feed")


def activity_row(row):
    data = json.dumps(row.data or {}, ensure_ascii=False)
    return [row.uid, row.kind, row.created_at, row.actor_id, row.idea_id, row.event_id, row.campus_label or "", data]


async def ship_outbox(hub, limit=500):
    client = await hub.get_clickhouse()
    if client is None:
        return 0
    async with hub.sessions() as db:
        rows = (await db.execute(
            select(Outbox).where(Outbox.shipped_at.is_(None)).order_by(Outbox.id).limit(limit).with_for_update(skip_locked=True)
        )).scalars().all()
        if not rows:
            return 0
        try:
            await client.insert("activity", [activity_row(row) for row in rows], column_names=ACTIVITY_COLUMNS)
        except Exception as exc:
            log.warning("outbox shipping failed: %r", exc)
            hub.drop_clickhouse()
            await db.rollback()
            return 0
        now = utcnow()
        for row in rows:
            row.shipped_at = now
        await db.commit()
        return len(rows)


async def purge_old(hub):
    async with hub.sessions() as db:
        await db.execute(delete(Outbox).where(Outbox.shipped_at < utcnow() - timedelta(days=7)))
        await db.execute(delete(MailQueue).where(MailQueue.sent_at < utcnow() - timedelta(days=30)))
        await db.commit()
```

`backend/src/modernsi/feed/requestlog.py`:

```python
"""
HTTP request log: a middleware fills an in-memory buffer, a background task flushes it to ClickHouse.
Losing a few log lines on a crash is fine; slowing requests down is not.
This work made by Anfinogentov Nikita
"""
import asyncio
import hashlib
import logging
import time

from modernsi.core.db import utcnow
from modernsi.feed.schema import HTTP_COLUMNS

log = logging.getLogger("modernsi.requests")
max_buffer = 10_000


class request_log:
    def __init__(self, salt):
        self.salt = salt
        self.hub = None
        self.rows = []

    def add(self, method, route, status, duration_ms, user_id):
        user_hash = hashlib.sha256((self.salt + str(user_id)).encode()).hexdigest()[:16] if user_id else ""
        self.rows.append([utcnow(), method, route, status, duration_ms, user_hash])
        if len(self.rows) > max_buffer:
            del self.rows[: len(self.rows) - max_buffer]

    async def flush(self):
        if not self.rows or self.hub is None:
            return 0
        client = await self.hub.get_clickhouse()
        if client is None:
            return 0
        rows, self.rows = self.rows, []
        try:
            await client.insert("http_requests", rows, column_names=HTTP_COLUMNS)
        except Exception as exc:
            log.warning("request log flush failed: %r", exc)
            self.hub.drop_clickhouse()
            self.rows = (rows + self.rows)[-max_buffer:]
            return 0
        return len(rows)

    async def run(self, every=2.0):
        while True:
            await asyncio.sleep(every)
            await self.flush()


def install_request_log(app, request_log_buffer):
    @app.middleware("http")
    async def log_requests(request, call_next):
        started = time.perf_counter()
        response = await call_next(request)
        route = request.scope.get("route")
        request_log_buffer.add(
            request.method, getattr(route, "path", "unmatched"), response.status_code,
            (time.perf_counter() - started) * 1000, getattr(request.state, "user_id", None),
        )
        return response
```

`backend/src/modernsi/feed/schemas.py`:

```python
"""
Shapes of the feed module.
This work made by Anfinogentov Nikita
"""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class FeedItem(BaseModel):
    id: UUID
    kind: str
    at: datetime
    actor_id: UUID | None
    idea_id: UUID | None
    event_id: UUID | None
    campus_label: str | None
    data: dict


class FeedPage(BaseModel):
    items: list[FeedItem]
    next_cursor: str | None


class StatsOut(BaseModel):
    students: int
    campuses: int
    ideas_to_events: int
    show_counters: bool
```

`backend/src/modernsi/feed/service.py`:

```python
"""
Reading the activity feed and the homepage counters from ClickHouse.
This work made by Anfinogentov Nikita
"""
import json
import logging
import uuid
from datetime import UTC, datetime

from modernsi.core.errors import api_error

log = logging.getLogger("modernsi.feed")


def parse_cursor(cursor):
    # cursor = "<ISO time>|<uuid>" of the last item on the previous page
    try:
        at_text, id_text = cursor.split("|")
        return datetime.fromisoformat(at_text), uuid.UUID(id_text)
    except ValueError:
        raise api_error(422, "bad_cursor", "This page link is broken, start from the top")


async def query_clickhouse(hub, sql, parameters):
    client = await hub.get_clickhouse()
    if client is None:
        raise api_error(503, "feed_unavailable", "The activity feed is unavailable right now")
    try:
        return (await client.query(sql, parameters=parameters)).result_rows
    except Exception as exc:
        log.warning("clickhouse query failed: %r", exc)
        hub.drop_clickhouse()
        raise api_error(503, "feed_unavailable", "The activity feed is unavailable right now")


def feed_item(row):
    return {
        "id": row[0], "kind": row[1], "at": row[2].replace(tzinfo=UTC), "actor_id": row[3], "idea_id": row[4],
        "event_id": row[5], "campus_label": row[6] or None, "data": json.loads(row[7] or "{}"),
    }


async def list_feed(hub, db, cursor=None, limit=20, actor_id=None):
    conditions = []
    parameters = {"limit": limit + 1}
    if cursor:
        at, row_id = parse_cursor(cursor)
        conditions.append("(at, id) < ({at:DateTime64(3)}, {id:UUID})")
        parameters.update(at=at, id=row_id)
    if actor_id is not None:
        conditions.append("actor_id = {actor:UUID}")
        parameters["actor"] = actor_id
    where = (" WHERE " + " AND ".join(conditions)) if conditions else ""
    sql = (
        "SELECT id, kind, at, actor_id, idea_id, event_id, campus_label, data FROM activity FINAL"
        + where + " ORDER BY at DESC, id DESC LIMIT {limit:UInt32}"
    )
    rows = await query_clickhouse(hub, sql, parameters)
    items = [feed_item(row) for row in rows[:limit]]
    next_cursor = None
    if len(rows) > limit and items:
        next_cursor = f"{items[-1]['at'].isoformat()}|{items[-1]['id']}"
    return {"items": items, "next_cursor": next_cursor}


async def stats(hub, settings):
    sql = (
        "SELECT uniqExactIf(actor_id, kind = 'user_verified'), "
        "uniqExactIf(campus_label, kind = 'user_verified' AND campus_label != ''), "
        "uniqExactIf(event_id, kind = 'event_published' AND idea_id IS NOT NULL) "
        "FROM activity FINAL"
    )
    students, campuses, ideas_to_events = (await query_clickhouse(hub, sql, {}))[0]
    return {
        "students": students, "campuses": campuses, "ideas_to_events": ideas_to_events,
        "show_counters": students >= settings.stats_min_students,
    }
```

`backend/src/modernsi/feed/router.py`:

```python
"""
HTTP endpoints of the feed module.
This work made by Anfinogentov Nikita
"""
from fastapi import APIRouter, Depends, Query

from modernsi.auth.deps import optional_user
from modernsi.core.db import get_db
from modernsi.core.deps import get_config, get_hub
from modernsi.core.errors import api_error
from modernsi.feed import service
from modernsi.feed.schemas import FeedPage, StatsOut

router = APIRouter(prefix="/api", tags=["feed"])


@router.get("/feed", response_model=FeedPage)
async def feed(cursor: str | None = None, limit: int = Query(20, ge=1, le=50), mine: bool = False, user=Depends(optional_user), db=Depends(get_db), hub=Depends(get_hub)):
    if mine and user is None:
        raise api_error(401, "not_authenticated", "Please log in first")
    return await service.list_feed(hub, db, cursor, limit, actor_id=user.id if mine else None)


@router.get("/stats", response_model=StatsOut)
async def stats(hub=Depends(get_hub), settings=Depends(get_config)):
    return await service.stats(hub, settings)
```

Replace `backend/src/modernsi/app.py` entirely with:

```python
"""
Builds the FastAPI application: stores on startup, middleware, error handlers and every module router.
This work made by Anfinogentov Nikita
"""
import asyncio
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI

from modernsi.admin.router import router as admin_router
from modernsi.auth.router import router as auth_router
from modernsi.campuses.router import router as campuses_router
from modernsi.core.config import get_settings
from modernsi.core.errors import install_error_handlers
from modernsi.core.health import router as health_router
from modernsi.core.security import install_origin_check
from modernsi.core.stores import stores
from modernsi.feed.requestlog import install_request_log, request_log
from modernsi.feed.router import router as feed_router
from modernsi.feed.schema import ensure_schema
from modernsi.profiles.router import router as profiles_router


def routers():
    # There I keep every module router in one list; each module task appends its own line
    return [health_router, campuses_router, auth_router, admin_router, profiles_router, feed_router]


def create_app(settings=None):
    settings = settings or get_settings()
    log_buffer = request_log(settings.log_salt)

    @asynccontextmanager
    async def lifespan(app):
        hub = stores(settings)
        client = await hub.get_clickhouse()
        if client is not None:
            await ensure_schema(client)
        app.state.stores = hub
        log_buffer.hub = hub
        flusher = asyncio.create_task(log_buffer.run())
        yield
        flusher.cancel()
        with suppress(asyncio.CancelledError):
            await flusher
        await log_buffer.flush()
        await hub.close()

    app = FastAPI(title="ModernSI API", lifespan=lifespan, docs_url="/api/docs", openapi_url="/api/openapi.json", redoc_url=None)
    app.state.settings = settings
    app.state.request_log = log_buffer
    install_error_handlers(app)
    install_origin_check(app, settings)
    # added last, so it is the outermost middleware and also logs requests the origin check refused
    install_request_log(app, log_buffer)
    for router in routers():
        app.include_router(router)
    return app
```

- [ ] **Step 4: Run tests**

Run: `cd backend && uv run pytest -v`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend
git commit -m "Add outbox shipping to ClickHouse, request log, feed and stats endpoints"
```

---

### Task B11: Ideas — create, list, read, edit, safe Markdown

**Files:**
- Create: `backend/src/modernsi/core/markdown.py`
- Create: `backend/src/modernsi/ideas/__init__.py`, `ideas/models.py`, `ideas/schemas.py`, `ideas/service.py`, `ideas/router.py`
- Modify: `backend/src/modernsi/models.py`, `backend/src/modernsi/app.py` (`routers()`)
- Create: `backend/migrations/versions/<generated>_ideas.py`
- Test: `backend/tests/test_markdown.py`, `backend/tests/test_ideas.py`

**Interfaces:**
- Consumes: B6 `optional_user`, `active_user`, `author_out`, `User`; B4 `emit`; B2 `hit`.
- Produces:
  - `render_markdown(text) -> str`.
  - ORM `Idea`, `IdeaVote(idea_id, user_id, created_at)`, `IdeaTeamMember(idea_id, user_id, joined_at)`, `IdeaReport(id, idea_id, reporter_id, reason, created_at, resolved_at)`; `statuses`, `categories`.
  - Service:
    - `idea_card(idea, settings)`;
    - `await load_idea(db, idea_id, viewer=None)` (404 `idea_not_found`, hidden ideas only for author/admin);
    - `await lock_idea(db, idea_id)` (`SELECT … FOR UPDATE OF ideas`, hidden → 404);
    - `await get_detail(db, settings, idea_id, viewer)`;
    - `await list_ideas(db, settings, viewer, status=None, categories=None, scope=None, mine=None, sort="new", cursor=None, limit=20)`;
    - `await create_idea(db, settings, user, data)`;
    - `await update_idea(db, settings, user, idea_id, data)`.
  - Endpoints:
    - `GET /api/ideas?status=&category=&scope=&mine=authored|voted|team&sort=new|trending|closest&cursor=&limit=` → `IdeaPage`;
    - `POST /api/ideas` → 201 `IdeaDetail`;
    - `GET /api/ideas/{id}` → `IdeaDetail`;
    - `PATCH /api/ideas/{id}` → `IdeaDetail`.
  - Shapes:
    - `IdeaCard = {id, title, summary, category, scope, campus_label, status, vote_count, vote_threshold, team_size, team_min, author: {id, display_name, campus_label}, created_at, expires_at}`;
    - `IdeaDetail = IdeaCard + {body_md, body_html, review_note, is_hidden, my_vote, in_team, is_author, can_edit, team: [author]}`.
  - Error codes: `idea_not_found` (404), `not_author` (403), `idea_locked` (409), `category_locked` (409), `bad_cursor` (422).
  - Feed kind `idea_created` with `data={"actor_name", "idea_title", "category"}`.

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_markdown.py`:

```python
"""
Markdown from users must never turn into live HTML, scripts or tracking images.
This work made by Anfinogentov Nikita
"""
from modernsi.core.markdown import render_markdown


async def test_raw_html_is_escaped():
    html = render_markdown("<script>alert(1)</script> <b>bold</b>")
    assert "<script>" not in html
    assert "&lt;script&gt;" in html
    assert "<b>" not in html


async def test_javascript_links_are_not_links():
    html = render_markdown("[click](javascript:alert(1))")
    assert "href" not in html


async def test_links_get_safe_rel():
    html = render_markdown("[site](https://example.org)")
    assert 'href="https://example.org"' in html
    assert 'rel="nofollow ugc noopener"' in html
    assert 'target="_blank"' in html


async def test_images_are_not_rendered():
    html = render_markdown("![pixel](https://tracker.example/p.gif)")
    assert "<img" not in html


async def test_basic_formatting_survives():
    html = render_markdown("**Plan**\n\n- cook\n- share")
    assert "<strong>Plan</strong>" in html
    assert "<li>cook</li>" in html
```

`backend/tests/test_ideas.py`:

```python
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
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && uv run pytest tests/test_markdown.py tests/test_ideas.py -v`
Expected: `ModuleNotFoundError: No module named 'modernsi.core.markdown'`.

- [ ] **Step 3: Implement**

`backend/src/modernsi/core/markdown.py`:

```python
"""
Safe Markdown for user texts: no raw HTML, no images, links open in a new tab with rel=nofollow ugc noopener.
markdown-it already refuses javascript:, vbscript:, file: and data: links.
This work made by Anfinogentov Nikita
"""
from markdown_it import MarkdownIt

md = MarkdownIt("commonmark", {"html": False, "linkify": False, "typographer": False}).enable("strikethrough").disable("image")


def render_link_open(self, tokens, index, options, env):
    tokens[index].attrSet("rel", "nofollow ugc noopener")
    tokens[index].attrSet("target", "_blank")
    return self.renderToken(tokens, index, options, env)


md.add_render_rule("link_open", render_link_open)


def render_markdown(text):
    return md.render(text or "")
```

`backend/src/modernsi/ideas/__init__.py`: docstring `"""Ideas: proposals, votes, Student Government review, teams and reports.\nThis work made by Anfinogentov Nikita\n"""`.

`backend/src/modernsi/ideas/models.py`:

```python
"""
Tables of the ideas module.
This work made by Anfinogentov Nikita
"""
import uuid

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import mapped_column, relationship

from modernsi.auth.models import User
from modernsi.core.db import Base, utcnow

statuses = ("open", "in_review", "needs_changes", "rejected", "forming_team", "live", "done", "expired")
categories = ("event", "academic", "club", "research", "volunteering", "campus_life")


class Idea(Base):
    __tablename__ = "ideas"

    id = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    author_id = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    title = mapped_column(String(120), nullable=False)
    summary = mapped_column(String(280), nullable=False)
    body_md = mapped_column(Text, nullable=False, default="")
    category = mapped_column(String(20), nullable=False, index=True)
    scope = mapped_column(String(10), nullable=False, default="network")
    campus_label = mapped_column(String(80), nullable=True)
    status = mapped_column(String(20), nullable=False, default="open", index=True)
    vote_count = mapped_column(Integer, nullable=False, default=0)
    team_size = mapped_column(Integer, nullable=False, default=0)
    is_hidden = mapped_column(Boolean, nullable=False, default=False)
    review_note = mapped_column(Text, nullable=True)
    created_at = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow, index=True)
    updated_at = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    review_started_at = mapped_column(DateTime(timezone=True), nullable=True)
    decided_at = mapped_column(DateTime(timezone=True), nullable=True)
    team_formed_at = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at = mapped_column(DateTime(timezone=True), nullable=False)

    author = relationship(User, lazy="joined")


class IdeaVote(Base):
    __tablename__ = "idea_votes"

    idea_id = mapped_column(ForeignKey("ideas.id", ondelete="CASCADE"), primary_key=True)
    user_id = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True)
    created_at = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow, index=True)


class IdeaTeamMember(Base):
    __tablename__ = "idea_team_members"

    idea_id = mapped_column(ForeignKey("ideas.id", ondelete="CASCADE"), primary_key=True)
    user_id = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True)
    joined_at = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


class IdeaReport(Base):
    __tablename__ = "idea_reports"
    __table_args__ = (UniqueConstraint("idea_id", "reporter_id", name="uq_idea_reports_idea_reporter"),)

    id = mapped_column(Integer, primary_key=True)
    idea_id = mapped_column(ForeignKey("ideas.id", ondelete="CASCADE"), nullable=False, index=True)
    reporter_id = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reason = mapped_column(String(500), nullable=False)
    created_at = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    resolved_at = mapped_column(DateTime(timezone=True), nullable=True)
```

`backend/src/modernsi/ideas/schemas.py`:

```python
"""
Shapes of the ideas module.
This work made by Anfinogentov Nikita
"""
from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, Field, StringConstraints

from modernsi.auth.schemas import AuthorOut

Category = Literal["event", "academic", "club", "research", "volunteering", "campus_life"]
Scope = Literal["campus", "network"]
Status = Literal["open", "in_review", "needs_changes", "rejected", "forming_team", "live", "done", "expired"]
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=120)]
Summary = Annotated[str, StringConstraints(strip_whitespace=True, min_length=10, max_length=280)]


class IdeaCreate(BaseModel):
    title: Title
    summary: Summary
    body_md: str = Field(default="", max_length=10_000)
    category: Category
    scope: Scope = "network"


class IdeaUpdate(BaseModel):
    title: Title | None = None
    summary: Summary | None = None
    body_md: str | None = Field(default=None, max_length=10_000)
    category: Category | None = None
    scope: Scope | None = None


class IdeaCard(BaseModel):
    id: UUID
    title: str
    summary: str
    category: str
    scope: str
    campus_label: str | None
    status: str
    vote_count: int
    vote_threshold: int
    team_size: int
    team_min: int
    author: AuthorOut
    created_at: datetime
    expires_at: datetime


class IdeaDetail(IdeaCard):
    body_md: str
    body_html: str
    review_note: str | None
    is_hidden: bool
    my_vote: bool
    in_team: bool
    is_author: bool
    can_edit: bool
    team: list[AuthorOut]


class IdeaPage(BaseModel):
    items: list[IdeaCard]
    next_cursor: str | None
```

`backend/src/modernsi/ideas/service.py`:

```python
"""
Idea logic: creating, listing, reading and editing. Votes, review and teams come in the next tasks.
This work made by Anfinogentov Nikita
"""
from datetime import timedelta

from sqlalchemy import func, select

from modernsi.auth.models import User
from modernsi.auth.service import author_out
from modernsi.core.db import utcnow
from modernsi.core.errors import api_error
from modernsi.core.markdown import render_markdown
from modernsi.feed.outbox import emit
from modernsi.ideas.models import Idea, IdeaTeamMember, IdeaVote

editable = ("open", "needs_changes")


def idea_card(idea, settings):
    return {
        "id": idea.id, "title": idea.title, "summary": idea.summary, "category": idea.category, "scope": idea.scope,
        "campus_label": idea.campus_label, "status": idea.status, "vote_count": idea.vote_count,
        "vote_threshold": settings.vote_threshold, "team_size": idea.team_size, "team_min": settings.team_min,
        "author": author_out(idea.author), "created_at": idea.created_at, "expires_at": idea.expires_at,
    }


def can_see_hidden(idea, viewer):
    return viewer is not None and (viewer.id == idea.author_id or viewer.role == "admin")


def not_found():
    return api_error(404, "idea_not_found", "There is no such idea")


async def load_idea(db, idea_id, viewer=None):
    idea = (await db.execute(select(Idea).where(Idea.id == idea_id))).scalar_one_or_none()
    if idea is None or (idea.is_hidden and not can_see_hidden(idea, viewer)):
        raise not_found()
    return idea


async def lock_idea(db, idea_id):
    # FOR UPDATE OF ideas: the joined author rows are not locked, only the idea itself
    idea = (await db.execute(select(Idea).where(Idea.id == idea_id).with_for_update(of=Idea))).scalar_one_or_none()
    if idea is None or idea.is_hidden:
        raise not_found()
    return idea


async def team_of(db, idea_id):
    return (await db.execute(
        select(User).join(IdeaTeamMember, IdeaTeamMember.user_id == User.id)
        .where(IdeaTeamMember.idea_id == idea_id).order_by(IdeaTeamMember.joined_at)
    )).scalars().all()


async def get_detail(db, settings, idea_id, viewer):
    idea = await load_idea(db, idea_id, viewer)
    team = await team_of(db, idea.id)
    my_vote = viewer is not None and await db.get(IdeaVote, (idea.id, viewer.id)) is not None
    is_author = viewer is not None and viewer.id == idea.author_id
    return {
        **idea_card(idea, settings),
        "body_md": idea.body_md, "body_html": render_markdown(idea.body_md), "review_note": idea.review_note,
        "is_hidden": idea.is_hidden, "my_vote": my_vote,
        "in_team": viewer is not None and any(member.id == viewer.id for member in team),
        "is_author": is_author, "can_edit": is_author and idea.status in editable,
        "team": [author_out(member) for member in team],
    }


def parse_offset(cursor):
    if not cursor:
        return 0
    if not cursor.isdigit():
        raise api_error(422, "bad_cursor", "This page link is broken, start from the top")
    return int(cursor)


async def list_ideas(db, settings, viewer, status=None, categories=None, scope=None, mine=None, sort="new", cursor=None, limit=20):
    statement = select(Idea).where(Idea.is_hidden.is_(False))
    if status:
        statement = statement.where(Idea.status.in_(status))
    if categories:
        statement = statement.where(Idea.category.in_(categories))
    if scope:
        statement = statement.where(Idea.scope == scope)
    if mine:
        if viewer is None:
            raise api_error(401, "not_authenticated", "Please log in first")
        if mine == "authored":
            statement = statement.where(Idea.author_id == viewer.id)
        elif mine == "voted":
            statement = statement.where(Idea.id.in_(select(IdeaVote.idea_id).where(IdeaVote.user_id == viewer.id)))
        elif mine == "team":
            statement = statement.where(Idea.id.in_(select(IdeaTeamMember.idea_id).where(IdeaTeamMember.user_id == viewer.id)))
    if sort == "closest":
        # every idea has the same threshold, so "closest to it" is simply "most votes"
        statement = statement.where(Idea.status == "open").order_by(Idea.vote_count.desc(), Idea.created_at.asc())
    elif sort == "trending":
        recent = (
            select(IdeaVote.idea_id, func.count().label("recent"))
            .where(IdeaVote.created_at > utcnow() - timedelta(days=7))
            .group_by(IdeaVote.idea_id).subquery()
        )
        statement = statement.outerjoin(recent, recent.c.idea_id == Idea.id).order_by(
            func.coalesce(recent.c.recent, 0).desc(), Idea.vote_count.desc(), Idea.created_at.desc()
        )
    else:
        statement = statement.order_by(Idea.created_at.desc(), Idea.id.desc())
    offset = parse_offset(cursor)
    rows = (await db.execute(statement.offset(offset).limit(limit + 1))).scalars().all()
    return {
        "items": [idea_card(idea, settings) for idea in rows[:limit]],
        "next_cursor": str(offset + limit) if len(rows) > limit else None,
    }


async def create_idea(db, settings, user, data):
    idea = Idea(
        author_id=user.id, title=data.title, summary=data.summary, body_md=data.body_md, category=data.category,
        scope=data.scope, campus_label=user.campus_label, expires_at=utcnow() + timedelta(days=settings.idea_ttl_days),
    )
    db.add(idea)
    await db.flush()
    emit(db, "idea_created", actor_id=user.id, idea_id=idea.id, campus_label=user.campus_label,
         data={"actor_name": user.display_name, "idea_title": idea.title, "category": idea.category})
    await db.commit()
    return await get_detail(db, settings, idea.id, user)


async def update_idea(db, settings, user, idea_id, data):
    idea = await lock_idea(db, idea_id)
    if idea.author_id != user.id:
        raise api_error(403, "not_author", "Only the author can edit this idea")
    if idea.status not in editable:
        raise api_error(409, "idea_locked", "This idea can no longer be edited")
    changes = data.model_dump(exclude_unset=True, exclude_none=True)
    if idea.status == "open" and changes.get("category", idea.category) != idea.category:
        raise api_error(409, "category_locked", "The category cannot change while people are voting")
    for field, value in changes.items():
        setattr(idea, field, value)
    idea.updated_at = utcnow()
    await db.commit()
    return await get_detail(db, settings, idea.id, user)
```

`backend/src/modernsi/ideas/router.py`:

```python
"""
HTTP endpoints of the ideas module.
This work made by Anfinogentov Nikita
"""
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from modernsi.auth.deps import active_user, optional_user
from modernsi.core.db import get_db
from modernsi.core.deps import get_config, get_hub
from modernsi.core.ratelimit import hit
from modernsi.ideas import service
from modernsi.ideas.schemas import Category, IdeaCreate, IdeaDetail, IdeaPage, IdeaUpdate, Scope, Status

router = APIRouter(prefix="/api/ideas", tags=["ideas"])


@router.get("", response_model=IdeaPage)
async def ideas(
    status: list[Status] | None = Query(None),
    category: list[Category] | None = Query(None),
    scope: Scope | None = None,
    mine: Literal["authored", "voted", "team"] | None = None,
    sort: Literal["new", "trending", "closest"] = "new",
    cursor: str | None = None,
    limit: int = Query(20, ge=1, le=50),
    viewer=Depends(optional_user),
    db=Depends(get_db),
    settings=Depends(get_config),
):
    return await service.list_ideas(db, settings, viewer, status, category, scope, mine, sort, cursor, limit)


@router.post("", status_code=201, response_model=IdeaDetail)
async def create(data: IdeaCreate, user=Depends(active_user), db=Depends(get_db), hub=Depends(get_hub), settings=Depends(get_config)):
    await hit(hub.redis, f"ideas:{user.id}", settings.rl_ideas_per_day, 86400)
    return await service.create_idea(db, settings, user, data)


@router.get("/{idea_id}", response_model=IdeaDetail)
async def read(idea_id: UUID, viewer=Depends(optional_user), db=Depends(get_db), settings=Depends(get_config)):
    return await service.get_detail(db, settings, idea_id, viewer)


@router.patch("/{idea_id}", response_model=IdeaDetail)
async def edit(idea_id: UUID, data: IdeaUpdate, user=Depends(active_user), db=Depends(get_db), settings=Depends(get_config)):
    return await service.update_idea(db, settings, user, idea_id, data)
```

Modify `backend/src/modernsi/models.py` — append `from modernsi.ideas import models as ideas_models  # noqa: F401,E402`.
Modify `backend/src/modernsi/app.py` — add `from modernsi.ideas.router import router as ideas_router`; append `ideas_router` to `routers()`.

- [ ] **Step 4: Generate and apply the migration**

Run: `cd backend && uv run alembic revision --autogenerate -m "ideas" && uv run alembic upgrade head`
Expected: new revision with `create_table` for `ideas`, `idea_votes`, `idea_team_members`, `idea_reports`.

- [ ] **Step 5: Run tests**

Run: `cd backend && uv run pytest -v`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add backend
git commit -m "Add ideas: create, list with sorting, read, edit, safe Markdown"
```

---

### Task B12: Voting and the move to review

**Files:**
- Modify: `backend/src/modernsi/ideas/service.py` (append `vote`, `unvote`), `ideas/schemas.py` (append `VoteOut`), `ideas/router.py` (two endpoints)
- Test: `backend/tests/test_votes.py`

**Interfaces:**
- Consumes: B11 `lock_idea`, `Idea`, `IdeaVote`; B4 `emit`, `enqueue`, `templates.idea_in_review`.
- Produces:
  - `POST /api/ideas/{id}/vote` and `DELETE /api/ideas/{id}/vote` → `{"vote_count", "status", "my_vote"}`.
  - Reaching `settings.vote_threshold` moves the idea to `in_review` in the same transaction, emits `idea_reached_review` (`data={"idea_title"}`) and queues mail to the author.
  - Error codes: `voting_closed` (409), `own_idea` (409).

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_votes.py`:

```python
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
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && uv run pytest tests/test_votes.py -v`
Expected: failures with `405`/`404` (vote route missing).

- [ ] **Step 3: Implement**

Append to `backend/src/modernsi/ideas/schemas.py`:

```python


class VoteOut(BaseModel):
    vote_count: int
    status: str
    my_vote: bool
```

Append to `backend/src/modernsi/ideas/service.py` (add imports `from modernsi.mail import templates` and `from modernsi.mail.queue import enqueue`):

```python


def idea_url(settings, idea):
    return f"{settings.site_url}/ideas/{idea.id}"


async def vote(db, settings, user, idea_id):
    idea = await lock_idea(db, idea_id)
    if idea.status != "open":
        raise api_error(409, "voting_closed", "This idea is not collecting votes now")
    if idea.author_id == user.id:
        raise api_error(409, "own_idea", "You cannot vote for your own idea")
    if await db.get(IdeaVote, (idea.id, user.id)) is None:
        db.add(IdeaVote(idea_id=idea.id, user_id=user.id))
        idea.vote_count += 1
        if idea.vote_count >= settings.vote_threshold:
            # the row lock above makes this branch run exactly once, whatever the concurrency
            idea.status = "in_review"
            idea.review_started_at = utcnow()
            emit(db, "idea_reached_review", idea_id=idea.id, campus_label=idea.campus_label, data={"idea_title": idea.title})
            enqueue(db, idea.author.email, *templates.idea_in_review(idea.title, idea_url(settings, idea)))
    await db.commit()
    return {"vote_count": idea.vote_count, "status": idea.status, "my_vote": True}


async def unvote(db, user, idea_id):
    idea = await lock_idea(db, idea_id)
    if idea.status != "open":
        raise api_error(409, "voting_closed", "This idea is not collecting votes now")
    existing = await db.get(IdeaVote, (idea.id, user.id))
    if existing is not None:
        await db.delete(existing)
        idea.vote_count -= 1
    await db.commit()
    return {"vote_count": idea.vote_count, "status": idea.status, "my_vote": False}
```

Append to `backend/src/modernsi/ideas/router.py` (add `VoteOut` to the schemas import):

```python


@router.post("/{idea_id}/vote", response_model=VoteOut)
async def vote(idea_id: UUID, user=Depends(active_user), db=Depends(get_db), hub=Depends(get_hub), settings=Depends(get_config)):
    await hit(hub.redis, f"votes:{user.id}", settings.rl_votes_per_minute, 60)
    return await service.vote(db, settings, user, idea_id)


@router.delete("/{idea_id}/vote", response_model=VoteOut)
async def unvote(idea_id: UUID, user=Depends(active_user), db=Depends(get_db), hub=Depends(get_hub), settings=Depends(get_config)):
    await hit(hub.redis, f"votes:{user.id}", settings.rl_votes_per_minute, 60)
    return await service.unvote(db, user, idea_id)
```

- [ ] **Step 4: Run tests**

Run: `cd backend && uv run pytest -v`
Expected: all pass, including `test_race_at_threshold_moves_once` (run it 5 times to be sure: `uv run pytest tests/test_votes.py::test_race_at_threshold_moves_once --count 5` is not available; instead run `for i in 1 2 3 4 5; do uv run pytest -q tests/test_votes.py::test_race_at_threshold_moves_once || break; done`).

- [ ] **Step 5: Commit**

```bash
git add backend
git commit -m "Add voting with row lock and the threshold move to review"
```

---

### Task B13: Review decisions, resubmission, teams, reports, hiding

**Files:**
- Modify: `backend/src/modernsi/ideas/service.py` (append), `ideas/schemas.py` (append), `ideas/router.py` (append)
- Modify: `backend/src/modernsi/admin/router.py` (append reports and hide), `admin/schemas.py` (append `ReportOut`, `HiddenOut`)
- Modify: `backend/src/modernsi/feed/service.py` (drop hidden ideas from the feed)
- Test: `backend/tests/test_review_team.py`

**Interfaces:**
- Consumes: B11/B12 ideas service; B4 `emit`, `enqueue`, `templates`; B6 `require_roles`.
- Produces:
  - Service:
    - `await decide(db, settings, reviewer, idea_id, decision, note)`;
    - `await resubmit(db, settings, user, idea_id)`;
    - `await join_team(db, settings, user, idea_id)`, `await leave_team(db, user, idea_id)`;
    - `await report_idea(db, user, idea_id, reason)`;
    - `await set_hidden(db, idea_id, hidden)`;
    - `await list_reports(db)`, `await resolve_report(db, report_id)`;
    - `await hidden_idea_ids(db, idea_ids) -> set`;
    - `await team_of(db, idea_id)` (already in B11);
    - `idea_url(settings, idea)`.
  - Idea endpoints:
    - `POST /api/ideas/{id}/decision` `{decision: approve|reject|needs_changes, note?}` (student_gov, admin) → `IdeaDetail`;
    - `POST /api/ideas/{id}/resubmit` (author) → `IdeaDetail`;
    - `POST|DELETE /api/ideas/{id}/team` → `{"team_size", "in_team", "status"}`;
    - `POST /api/ideas/{id}/report` `{reason}` → 201 `{}`.
  - Admin endpoints:
    - `GET /api/admin/reports` → `[{"id", "idea_id", "idea_title", "reason", "created_at"}]`;
    - `POST /api/admin/reports/{id}/resolve`;
    - `POST /api/admin/ideas/{id}/hide`, `POST /api/admin/ideas/{id}/unhide` → `{"id", "is_hidden"}`.
  - Feed kinds: `idea_decided` (`data={"idea_title", "decision"}`), `team_formed` (`data={"idea_title"}`), emitted once per idea.
  - Error codes: `not_in_review` (409), `note_required` (422), `not_needs_changes` (409), `team_closed` (409), `author_cannot_leave` (409), `already_reported` (409), `report_not_found` (404).

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_review_team.py`:

```python
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
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && uv run pytest tests/test_review_team.py -v`
Expected: failures with 404/405 (routes missing).

- [ ] **Step 3: Implement the ideas side**

Append to `backend/src/modernsi/ideas/schemas.py`:

```python


class DecisionIn(BaseModel):
    decision: Literal["approve", "reject", "needs_changes"]
    note: str | None = Field(default=None, max_length=1000)


class TeamOut(BaseModel):
    team_size: int
    in_team: bool
    status: str


class ReportIn(BaseModel):
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=500)]
```

Append to `backend/src/modernsi/ideas/service.py` (add `IdeaReport` to the models import and `from sqlalchemy.exc import IntegrityError`):

```python


async def after_team_change(db, settings, idea):
    # the "team is ready" moment fires once, even if people leave and join again later
    if idea.team_size >= settings.team_min and idea.team_formed_at is None:
        idea.team_formed_at = utcnow()
        emit(db, "team_formed", idea_id=idea.id, campus_label=idea.campus_label, data={"idea_title": idea.title})
        enqueue(db, idea.author.email, *templates.team_formed(idea.title, idea_url(settings, idea)))


async def decide(db, settings, reviewer, idea_id, decision, note):
    idea = await lock_idea(db, idea_id)
    if idea.status != "in_review":
        raise api_error(409, "not_in_review", "This idea is not waiting for review")
    note = (note or "").strip() or None
    if decision in ("reject", "needs_changes") and note is None:
        raise api_error(422, "note_required", "Explain the decision in a short note")
    idea.decided_at = utcnow()
    idea.review_note = note
    if decision == "approve":
        idea.status = "forming_team"
        db.add(IdeaTeamMember(idea_id=idea.id, user_id=idea.author_id))
        idea.team_size = 1
        await after_team_change(db, settings, idea)
    else:
        idea.status = "rejected" if decision == "reject" else "needs_changes"
    emit(db, "idea_decided", actor_id=reviewer.id, idea_id=idea.id, campus_label=idea.campus_label,
         data={"idea_title": idea.title, "decision": decision})
    enqueue(db, idea.author.email, *templates.idea_decided(idea.title, decision, note, idea_url(settings, idea)))
    await db.commit()
    return await get_detail(db, settings, idea.id, reviewer)


async def resubmit(db, settings, user, idea_id):
    idea = await lock_idea(db, idea_id)
    if idea.author_id != user.id:
        raise api_error(403, "not_author", "Only the author can send this idea back")
    if idea.status != "needs_changes":
        raise api_error(409, "not_needs_changes", "This idea is not waiting for changes")
    # the threshold was already reached once, so it goes straight back to review
    idea.status = "in_review"
    idea.review_started_at = utcnow()
    idea.review_note = None
    await db.commit()
    return await get_detail(db, settings, idea.id, user)


async def join_team(db, settings, user, idea_id):
    idea = await lock_idea(db, idea_id)
    if idea.status != "forming_team":
        raise api_error(409, "team_closed", "This idea is not gathering a team now")
    if await db.get(IdeaTeamMember, (idea.id, user.id)) is None:
        db.add(IdeaTeamMember(idea_id=idea.id, user_id=user.id))
        idea.team_size += 1
        await after_team_change(db, settings, idea)
    await db.commit()
    return {"team_size": idea.team_size, "in_team": True, "status": idea.status}


async def leave_team(db, user, idea_id):
    idea = await lock_idea(db, idea_id)
    if idea.status != "forming_team":
        raise api_error(409, "team_closed", "This idea is not gathering a team now")
    if idea.author_id == user.id:
        raise api_error(409, "author_cannot_leave", "The author stays in the team")
    member = await db.get(IdeaTeamMember, (idea.id, user.id))
    if member is not None:
        await db.delete(member)
        idea.team_size -= 1
    await db.commit()
    return {"team_size": idea.team_size, "in_team": False, "status": idea.status}


async def report_idea(db, user, idea_id, reason):
    idea = await load_idea(db, idea_id, user)
    db.add(IdeaReport(idea_id=idea.id, reporter_id=user.id, reason=reason))
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise api_error(409, "already_reported", "You have already reported this idea")


async def set_hidden(db, idea_id, hidden):
    idea = await db.get(Idea, idea_id)
    if idea is None:
        raise not_found()
    idea.is_hidden = hidden
    await db.commit()
    return {"id": idea.id, "is_hidden": idea.is_hidden}


async def list_reports(db):
    rows = await db.execute(
        select(IdeaReport, Idea.title).join(Idea, Idea.id == IdeaReport.idea_id)
        .where(IdeaReport.resolved_at.is_(None)).order_by(IdeaReport.created_at)
    )
    return [
        {"id": report.id, "idea_id": report.idea_id, "idea_title": title, "reason": report.reason, "created_at": report.created_at}
        for report, title in rows.all()
    ]


async def resolve_report(db, report_id):
    report = await db.get(IdeaReport, report_id)
    if report is None:
        raise api_error(404, "report_not_found", "There is no such report")
    report.resolved_at = utcnow()
    await db.commit()
    return {"id": report.id}


async def hidden_idea_ids(db, idea_ids):
    if not idea_ids:
        return set()
    rows = await db.execute(select(Idea.id).where(Idea.id.in_(idea_ids), Idea.is_hidden.is_(True)))
    return set(rows.scalars().all())
```

Append to `backend/src/modernsi/ideas/router.py` (extend imports: `from modernsi.auth.deps import active_user, optional_user, require_roles` and `DecisionIn, ReportIn, TeamOut` from schemas):

```python


@router.post("/{idea_id}/decision", response_model=IdeaDetail)
async def decision(idea_id: UUID, data: DecisionIn, reviewer=Depends(require_roles("student_gov", "admin")), db=Depends(get_db), settings=Depends(get_config)):
    return await service.decide(db, settings, reviewer, idea_id, data.decision, data.note)


@router.post("/{idea_id}/resubmit", response_model=IdeaDetail)
async def resubmit(idea_id: UUID, user=Depends(active_user), db=Depends(get_db), settings=Depends(get_config)):
    return await service.resubmit(db, settings, user, idea_id)


@router.post("/{idea_id}/team", response_model=TeamOut)
async def join_team(idea_id: UUID, user=Depends(active_user), db=Depends(get_db), settings=Depends(get_config)):
    return await service.join_team(db, settings, user, idea_id)


@router.delete("/{idea_id}/team", response_model=TeamOut)
async def leave_team(idea_id: UUID, user=Depends(active_user), db=Depends(get_db)):
    return await service.leave_team(db, user, idea_id)


@router.post("/{idea_id}/report", status_code=201)
async def report(idea_id: UUID, data: ReportIn, user=Depends(active_user), db=Depends(get_db)):
    await service.report_idea(db, user, idea_id, data.reason)
    return {}
```

- [ ] **Step 4: Implement the admin side and the feed filter**

Append to `backend/src/modernsi/admin/schemas.py`:

```python


class ReportOut(BaseModel):
    id: int
    idea_id: UUID
    idea_title: str
    reason: str
    created_at: datetime


class HiddenOut(BaseModel):
    id: UUID
    is_hidden: bool
```

Append to `backend/src/modernsi/admin/router.py` (add `HiddenOut, ReportOut` to the schemas import and `from modernsi.ideas import service as ideas_service`):

```python


@router.get("/reports", response_model=list[ReportOut])
async def reports(db=Depends(get_db)):
    return await ideas_service.list_reports(db)


@router.post("/reports/{report_id}/resolve")
async def resolve_report(report_id: int, db=Depends(get_db)):
    return await ideas_service.resolve_report(db, report_id)


@router.post("/ideas/{idea_id}/hide", response_model=HiddenOut)
async def hide_idea(idea_id: UUID, db=Depends(get_db)):
    return await ideas_service.set_hidden(db, idea_id, True)


@router.post("/ideas/{idea_id}/unhide", response_model=HiddenOut)
async def unhide_idea(idea_id: UUID, db=Depends(get_db)):
    return await ideas_service.set_hidden(db, idea_id, False)
```

In `backend/src/modernsi/feed/service.py`, replace the end of `list_feed` — the block

```python
    rows = await query_clickhouse(hub, sql, parameters)
    items = [feed_item(row) for row in rows[:limit]]
    next_cursor = None
    if len(rows) > limit and items:
        next_cursor = f"{items[-1]['at'].isoformat()}|{items[-1]['id']}"
    return {"items": items, "next_cursor": next_cursor}
```

with

```python
    rows = await query_clickhouse(hub, sql, parameters)
    items = [feed_item(row) for row in rows[:limit]]
    next_cursor = None
    if len(rows) > limit and items:
        # the cursor comes from the unfiltered page, so hiding never makes pagination skip rows
        next_cursor = f"{items[-1]['at'].isoformat()}|{items[-1]['id']}"
    # imported here: ideas imports feed (emit), so a top-level import would be circular
    from modernsi.ideas.service import hidden_idea_ids

    hidden = await hidden_idea_ids(db, {item["idea_id"] for item in items if item["idea_id"]})
    return {"items": [item for item in items if item["idea_id"] not in hidden], "next_cursor": next_cursor}
```

- [ ] **Step 5: Run tests**

Run: `cd backend && uv run pytest -v`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add backend
git commit -m "Add review decisions, resubmission, teams, reports and hiding"
```

---

### Task B14: Events, RSVPs, the worker

**Files:**
- Create: `backend/src/modernsi/events/__init__.py`, `events/models.py`, `events/schemas.py`, `events/service.py`, `events/router.py`
- Create: `backend/src/modernsi/worker.py`
- Modify: `backend/src/modernsi/ideas/service.py` (append `expire_ideas`, `mark_done`), `models.py`, `app.py` (`routers()`), `cli.py` (`worker`)
- Create: `backend/migrations/versions/<generated>_events.py`
- Test: `backend/tests/test_events.py`, `backend/tests/test_worker.py`

**Interfaces:**
- Consumes: B11–B13 (`lock_idea`, `team_of`, `can_see_hidden`, `Idea`); B10 `ship_outbox`, `purge_old`; B4 `send_pending`, `enqueue`, `templates.event_published`, `emit`.
- Produces:
  - ORM `Event`, `EventRsvp`.
  - `POST /api/events` (`EventCreate`) → 201 `EventOut`; `GET /api/events?when=upcoming|past&category=&network_only=&going=&idea=&cursor=&limit=` → `{"items": [EventOut], "next_cursor"}`; `GET /api/events/{id}` → `EventOut`; `POST|DELETE /api/events/{id}/rsvp` → `{"going_count", "i_am_going"}`.
  - `EventOut = {id, title, description_md, description_html, starts_at, ends_at, location_text, online_url, campus_label, going_count, idea_id, idea_title, created_by: author, i_am_going, is_past}`.
  - Creating an event from an idea moves the idea to `live`.
  - Worker: `await run_once(hub, periodic=False) -> {"shipped", "sent", "expired", "done"}`, `await run_worker(hub)`; ideas `await expire_ideas(db) -> int`, `await mark_done(db, idea_ids) -> int`; events `await finish_events(db) -> int`.
  - CLI `modernsi worker`.
  - Error codes: `location_required`, `bad_time_range`, `starts_in_past` (422), `idea_not_ready`, `team_too_small`, `event_over` (409), `event_not_found` (404).

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_events.py`:

```python
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
    assert (await stranger.post("/api/events", json=event_body(idea_id=str(idea_id)))).status_code == 403
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
```

`backend/tests/test_worker.py`:

```python
"""
Worker round: ships the outbox, sends mail, expires stale ideas, closes ideas whose event is over.
This work made by Anfinogentov Nikita
"""
from datetime import timedelta

from modernsi.core.db import utcnow
from modernsi.events.models import Event
from modernsi.feed.outbox import emit
from modernsi.ideas.models import Idea
from modernsi.mail.queue import enqueue
from modernsi.worker import run_once
from tests.helpers import last_mail, make_user


async def test_worker_round(hub):
    author = await make_user(hub)
    async with hub.sessions() as db:
        stale = Idea(author_id=author.id, title="Stale idea here", summary="Nobody voted for this one.", category="club",
                     scope="network", status="open", expires_at=utcnow() - timedelta(minutes=1))
        fresh = Idea(author_id=author.id, title="Fresh idea here", summary="Still collecting votes now.", category="club",
                     scope="network", status="open", expires_at=utcnow() + timedelta(days=10))
        finished = Idea(author_id=author.id, title="Finished idea here", summary="Its event already happened.", category="event",
                        scope="network", status="live", expires_at=utcnow() + timedelta(days=10))
        db.add_all([stale, fresh, finished])
        await db.flush()
        db.add(Event(idea_id=finished.id, created_by=author.id, title="Done event", starts_at=utcnow() - timedelta(days=2),
                     ends_at=utcnow() - timedelta(days=1), location_text="Hall"))
        emit(db, "user_verified", actor_id=author.id, data={"display_name": "Aru"})
        enqueue(db, "aru@uni.edu", "Worker says hi", "Body")
        await db.commit()
        ids = (stale.id, fresh.id, finished.id)

    quick = await run_once(hub)
    assert quick == {"shipped": 1, "sent": 1, "expired": 0, "done": 0}
    assert (await last_mail("aru@uni.edu", "Worker says hi"))["text"].startswith("Body")

    full = await run_once(hub, periodic=True)
    assert full["expired"] == 1 and full["done"] == 1
    async with hub.sessions() as db:
        statuses = [(await db.get(Idea, idea_id)).status for idea_id in ids]
    assert statuses == ["expired", "open", "done"]
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && uv run pytest tests/test_events.py tests/test_worker.py -v`
Expected: `ModuleNotFoundError: No module named 'modernsi.events'`.

- [ ] **Step 3: Implement events**

`backend/src/modernsi/events/__init__.py`: docstring `"""Events on the Hub: grown from approved ideas or published by curators.\nThis work made by Anfinogentov Nikita\n"""`.

`backend/src/modernsi/events/models.py`:

```python
"""
Tables of the events module.
This work made by Anfinogentov Nikita
"""
import uuid

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import mapped_column, relationship

from modernsi.auth.models import User
from modernsi.core.db import Base, utcnow
from modernsi.ideas.models import Idea


class Event(Base):
    __tablename__ = "events"

    id = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    # one idea grows into at most one event; curator events have no idea
    idea_id = mapped_column(ForeignKey("ideas.id"), nullable=True, unique=True)
    created_by = mapped_column(ForeignKey("users.id"), nullable=False)
    title = mapped_column(String(120), nullable=False)
    description_md = mapped_column(Text, nullable=False, default="")
    starts_at = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    ends_at = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    location_text = mapped_column(String(200), nullable=True)
    online_url = mapped_column(String(500), nullable=True)
    campus_label = mapped_column(String(80), nullable=True)
    going_count = mapped_column(Integer, nullable=False, default=0)
    created_at = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    creator = relationship(User, lazy="joined")
    idea = relationship(Idea, lazy="joined")


class EventRsvp(Base):
    __tablename__ = "event_rsvps"

    event_id = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), primary_key=True)
    user_id = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True)
    created_at = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
```

`backend/src/modernsi/events/schemas.py`:

```python
"""
Shapes of the events module. Times must carry a timezone: a naive time is a 422, never a guess.
This work made by Anfinogentov Nikita
"""
from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, Field, HttpUrl, StringConstraints

from modernsi.auth.schemas import AuthorOut

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=120)]
Place = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]


class EventCreate(BaseModel):
    title: Title
    description_md: str = Field(default="", max_length=5000)
    starts_at: AwareDatetime
    ends_at: AwareDatetime
    location_text: Place | None = None
    online_url: HttpUrl | None = None
    idea_id: UUID | None = None
    scope: Literal["campus", "network"] = "network"


class EventOut(BaseModel):
    id: UUID
    title: str
    description_md: str
    description_html: str
    starts_at: datetime
    ends_at: datetime
    location_text: str | None
    online_url: str | None
    campus_label: str | None
    going_count: int
    idea_id: UUID | None
    idea_title: str | None
    created_by: AuthorOut
    i_am_going: bool
    is_past: bool


class EventPage(BaseModel):
    items: list[EventOut]
    next_cursor: str | None


class RsvpOut(BaseModel):
    going_count: int
    i_am_going: bool
```

`backend/src/modernsi/events/service.py`:

```python
"""
Event logic: publishing (from a ready idea or by a curator), listing, RSVPs, closing finished ideas.
This work made by Anfinogentov Nikita
"""
from sqlalchemy import or_, select

from modernsi.auth.service import author_out
from modernsi.core.db import utcnow
from modernsi.core.errors import api_error
from modernsi.core.markdown import render_markdown
from modernsi.events.models import Event, EventRsvp
from modernsi.feed.outbox import emit
from modernsi.ideas.models import Idea
from modernsi.ideas.service import can_see_hidden, lock_idea, mark_done, parse_offset, team_of
from modernsi.mail import templates
from modernsi.mail.queue import enqueue

curators = ("curator", "admin")


def event_out(event, going=False):
    return {
        "id": event.id, "title": event.title, "description_md": event.description_md,
        "description_html": render_markdown(event.description_md), "starts_at": event.starts_at, "ends_at": event.ends_at,
        "location_text": event.location_text, "online_url": event.online_url, "campus_label": event.campus_label,
        "going_count": event.going_count, "idea_id": event.idea_id, "idea_title": event.idea.title if event.idea else None,
        "created_by": author_out(event.creator), "i_am_going": going, "is_past": event.ends_at <= utcnow(),
    }


def check_times_and_place(data):
    if not data.location_text and data.online_url is None:
        raise api_error(422, "location_required", "Add a place or an online link")
    if data.ends_at <= data.starts_at:
        raise api_error(422, "bad_time_range", "The event must end after it starts")
    if data.starts_at <= utcnow():
        raise api_error(422, "starts_in_past", "The event must start in the future")


async def create_event(db, settings, user, data):
    check_times_and_place(data)
    idea = None
    if data.idea_id is not None:
        idea = await lock_idea(db, data.idea_id)
        if idea.author_id != user.id and user.role not in curators:
            raise api_error(403, "forbidden", "Only the author or a curator can put this idea on the Hub")
        if idea.status != "forming_team":
            raise api_error(409, "idea_not_ready", "This idea is not ready for an event")
        if idea.team_size < settings.team_min:
            raise api_error(409, "team_too_small", f"The team needs at least {settings.team_min} people")
        campus_label = idea.campus_label if idea.scope == "campus" else None
    else:
        if user.role not in curators:
            raise api_error(403, "forbidden", "Only curators can publish events without an idea")
        campus_label = user.campus_label if data.scope == "campus" else None
    event = Event(
        idea_id=idea.id if idea else None, created_by=user.id, title=data.title, description_md=data.description_md,
        starts_at=data.starts_at, ends_at=data.ends_at, location_text=data.location_text or None,
        online_url=str(data.online_url) if data.online_url else None, campus_label=campus_label,
    )
    db.add(event)
    await db.flush()
    if idea is not None:
        idea.status = "live"
        url = f"{settings.site_url}/events/{event.id}"
        for member in await team_of(db, idea.id):
            if member.id != user.id:
                enqueue(db, member.email, *templates.event_published(idea.title, url))
    emit(db, "event_published", actor_id=user.id, idea_id=idea.id if idea else None, event_id=event.id, campus_label=campus_label,
         data={"event_title": event.title, "idea_title": idea.title if idea else None, "starts_at": data.starts_at.isoformat()})
    await db.commit()
    return await get_event(db, event.id, user)


async def load_event(db, event_id, viewer=None, lock=False):
    statement = select(Event).where(Event.id == event_id)
    if lock:
        statement = statement.with_for_update(of=Event)
    event = (await db.execute(statement)).scalar_one_or_none()
    if event is None or (event.idea is not None and event.idea.is_hidden and not can_see_hidden(event.idea, viewer)):
        raise api_error(404, "event_not_found", "There is no such event")
    return event


async def is_going(db, event_id, viewer):
    return viewer is not None and await db.get(EventRsvp, (event_id, viewer.id)) is not None


async def get_event(db, event_id, viewer):
    event = await load_event(db, event_id, viewer)
    return event_out(event, await is_going(db, event.id, viewer))


async def list_events(db, viewer, when="upcoming", categories=None, network_only=False, going=False, idea_id=None, cursor=None, limit=20):
    now = utcnow()
    statement = select(Event).outerjoin(Idea, Event.idea_id == Idea.id).where(or_(Event.idea_id.is_(None), Idea.is_hidden.is_(False)))
    if when == "past":
        statement = statement.where(Event.ends_at <= now).order_by(Event.starts_at.desc())
    else:
        statement = statement.where(Event.ends_at > now).order_by(Event.starts_at.asc())
    if categories:
        statement = statement.where(Idea.category.in_(categories))
    if network_only:
        statement = statement.where(Event.campus_label.is_(None))
    if going:
        if viewer is None:
            raise api_error(401, "not_authenticated", "Please log in first")
        statement = statement.where(Event.id.in_(select(EventRsvp.event_id).where(EventRsvp.user_id == viewer.id)))
    if idea_id is not None:
        statement = statement.where(Event.idea_id == idea_id)
    offset = parse_offset(cursor)
    rows = (await db.execute(statement.offset(offset).limit(limit + 1))).scalars().all()
    page = rows[:limit]
    mine = set()
    if viewer is not None and page:
        mine = set((await db.execute(
            select(EventRsvp.event_id).where(EventRsvp.user_id == viewer.id, EventRsvp.event_id.in_([event.id for event in page]))
        )).scalars().all())
    return {
        "items": [event_out(event, event.id in mine) for event in page],
        "next_cursor": str(offset + limit) if len(rows) > limit else None,
    }


async def set_rsvp(db, user, event_id, going):
    event = await load_event(db, event_id, user, lock=True)
    if event.ends_at <= utcnow():
        raise api_error(409, "event_over", "This event is already over")
    existing = await db.get(EventRsvp, (event.id, user.id))
    if going and existing is None:
        db.add(EventRsvp(event_id=event.id, user_id=user.id))
        event.going_count += 1
    elif not going and existing is not None:
        await db.delete(existing)
        event.going_count -= 1
    await db.commit()
    return {"going_count": event.going_count, "i_am_going": going}


async def finish_events(db):
    ended = select(Event.idea_id).where(Event.idea_id.is_not(None), Event.ends_at < utcnow())
    idea_ids = set((await db.execute(ended)).scalars().all())
    return await mark_done(db, idea_ids)
```

Append to `backend/src/modernsi/ideas/service.py` (add `update` to the `sqlalchemy` import):

```python


async def expire_ideas(db):
    result = await db.execute(update(Idea).where(Idea.status == "open", Idea.expires_at < utcnow()).values(status="expired"))
    await db.commit()
    return result.rowcount


async def mark_done(db, idea_ids):
    if not idea_ids:
        return 0
    result = await db.execute(update(Idea).where(Idea.id.in_(idea_ids), Idea.status == "live").values(status="done"))
    await db.commit()
    return result.rowcount
```

`backend/src/modernsi/events/router.py`:

```python
"""
HTTP endpoints of the events module.
This work made by Anfinogentov Nikita
"""
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from modernsi.auth.deps import active_user, optional_user
from modernsi.core.db import get_db
from modernsi.core.deps import get_config
from modernsi.events import service
from modernsi.events.schemas import EventCreate, EventOut, EventPage, RsvpOut
from modernsi.ideas.schemas import Category

router = APIRouter(prefix="/api/events", tags=["events"])


@router.get("", response_model=EventPage)
async def events(
    when: Literal["upcoming", "past"] = "upcoming",
    category: list[Category] | None = Query(None),
    network_only: bool = False,
    going: bool = False,
    idea: UUID | None = None,
    cursor: str | None = None,
    limit: int = Query(20, ge=1, le=50),
    viewer=Depends(optional_user),
    db=Depends(get_db),
):
    return await service.list_events(db, viewer, when, category, network_only, going, idea, cursor, limit)


@router.post("", status_code=201, response_model=EventOut)
async def create(data: EventCreate, user=Depends(active_user), db=Depends(get_db), settings=Depends(get_config)):
    return await service.create_event(db, settings, user, data)


@router.get("/{event_id}", response_model=EventOut)
async def read(event_id: UUID, viewer=Depends(optional_user), db=Depends(get_db)):
    return await service.get_event(db, event_id, viewer)


@router.post("/{event_id}/rsvp", response_model=RsvpOut)
async def rsvp(event_id: UUID, user=Depends(active_user), db=Depends(get_db)):
    return await service.set_rsvp(db, user, event_id, True)


@router.delete("/{event_id}/rsvp", response_model=RsvpOut)
async def cancel_rsvp(event_id: UUID, user=Depends(active_user), db=Depends(get_db)):
    return await service.set_rsvp(db, user, event_id, False)
```

Modify `backend/src/modernsi/models.py` — append `from modernsi.events import models as events_models  # noqa: F401,E402`.
Modify `backend/src/modernsi/app.py` — add `from modernsi.events.router import router as events_router`; append `events_router` to `routers()`.

- [ ] **Step 4: Implement the worker**

`backend/src/modernsi/worker.py`:

```python
"""
Background worker: every 2 s ships the outbox and sends queued mail; every 10 min expires stale ideas,
closes ideas whose event is over and purges old rows.
This work made by Anfinogentov Nikita
"""
import asyncio
import logging
import time

from modernsi.events.service import finish_events
from modernsi.feed.shipper import purge_old, ship_outbox
from modernsi.ideas.service import expire_ideas
from modernsi.mail.queue import send_pending

log = logging.getLogger("modernsi.worker")


async def run_once(hub, periodic=False):
    result = {"shipped": await ship_outbox(hub), "sent": await send_pending(hub), "expired": 0, "done": 0}
    if periodic:
        async with hub.sessions() as db:
            result["expired"] = await expire_ideas(db)
            result["done"] = await finish_events(db)
        await purge_old(hub)
    return result


async def run_worker(hub, every=2.0, periodic_every=600):
    last_periodic = float("-inf")
    while True:
        periodic = time.monotonic() - last_periodic >= periodic_every
        try:
            result = await run_once(hub, periodic)
            if periodic:
                last_periodic = time.monotonic()
            if any(result.values()):
                log.info("worker round: %s", result)
        except Exception:
            # one bad round must not kill the worker; the next round retries
            log.exception("worker round failed")
        await asyncio.sleep(every)
```

Append to `backend/src/modernsi/cli.py`:

```python


@cli.command()
def worker():
    """Run the background worker (outbox, mail, periodic transitions)."""
    import logging

    from modernsi.worker import run_worker

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
    run_with_hub(run_worker)
```

- [ ] **Step 5: Generate and apply the migration**

Run: `cd backend && uv run alembic revision --autogenerate -m "events" && uv run alembic upgrade head`
Expected: new revision with `create_table('events'` (unique on `idea_id`) and `create_table('event_rsvps'`.

- [ ] **Step 6: Run tests**

Run: `cd backend && uv run pytest -v`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add backend
git commit -m "Add events with RSVPs, idea-to-event step and the background worker"
```

---

### Task B15: README, migration drift check, end-to-end smoke

**Files:**
- Create: `backend/README.md`, `README.md` (repo root)
- Test: `backend/tests/test_migrations.py`

**Interfaces:**
- Consumes: everything above.
- Produces: documented start-from-zero procedure; a test that fails when models and migrations drift apart.

- [ ] **Step 1: Write the failing drift test**

`backend/tests/test_migrations.py`:

```python
"""
Models and Alembic migrations must describe the same schema.
This work made by Anfinogentov Nikita
"""
import os
import subprocess
from pathlib import Path

backend_dir = Path(__file__).resolve().parents[1]


def test_no_pending_model_changes(settings):
    result = subprocess.run(["uv", "run", "alembic", "check"], cwd=backend_dir, env=os.environ.copy(), capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr
```

- [ ] **Step 2: Run it**

Run: `cd backend && uv run pytest tests/test_migrations.py -v`
Expected: PASS (`No new upgrade operations detected`). If it fails, the output names the drift: generate a migration for it (`uv run alembic revision --autogenerate -m "sync"`), re-run.

- [ ] **Step 3: Write the READMEs**

`backend/README.md`:

````markdown
# ModernSI — backend

FastAPI modular monolith. PostgreSQL (core data), Redis (sessions, codes, rate limits),
MongoDB (profiles, avatars), ClickHouse (activity feed, request logs). Mailpit catches e-mail in development.

## Start from zero

```bash
docker compose -f ../infra/docker-compose.yml up -d --wait
cp .env.example .env
uv sync
uv run modernsi migrate
uv run modernsi add-domain uni.edu --label Almaty --country KZ
uv run modernsi create-admin --email you@uni.edu --name "Your Name"
uv run modernsi dev          # API on http://localhost:8040, docs at /api/docs
uv run modernsi worker       # in a second terminal: feed shipping, mail, periodic jobs
```

Mail sent in development: http://localhost:18025

## Tests

```bash
docker compose -f ../infra/docker-compose.test.yml up -d --wait
uv run pytest
```

Tests use real stores on separate ports and wipe them before every test.

## Settings

All settings are `MSI_*` environment variables (see `.env.example` and `src/modernsi/core/config.py`).
Thresholds: `MSI_VOTE_THRESHOLD` (50), `MSI_IDEA_TTL_DAYS` (60), `MSI_TEAM_MIN` (3), `MSI_STATS_MIN_STUDENTS` (25).
````

`README.md` (repo root):

````markdown
# ModernSI

An independent international student network: ideas that become campus events, sections for
academic, international, community and personal life, and (next stages) a forum and chat.

ModernSI is an independent student project and is not affiliated with, endorsed by, or sponsored by any university.

- `backend/` — FastAPI API and worker, see `backend/README.md`
- `frontend/` — Next.js site, see `frontend/README.md`
- `infra/` — Docker Compose files for the stores
- `docs/` — specs and implementation plans
````

- [ ] **Step 4: End-to-end smoke against the dev stores**

Run (three terminals or background jobs):
```bash
cd backend && uv run modernsi migrate && uv run modernsi add-domain uni.edu --label Almaty --country KZ
uv run modernsi dev &
uv run modernsi worker &
sleep 3
curl -s localhost:8040/api/health
curl -s -X POST localhost:8040/api/auth/register -H 'Origin: http://localhost:3000' -H 'Content-Type: application/json' \
  -d '{"email":"smoke@uni.edu","password":"correct horse battery","display_name":"Smoke"}'
curl -s localhost:8040/api/campuses
kill %1 %2
```
Expected:
- `/api/health` returns `{"status":"ok", ...}` with all four stores `true`;
- register returns 201 JSON with `"status":"pending"`;
- the code e-mail is visible at http://localhost:18025;
- `/api/campuses` lists Almaty.

- [ ] **Step 5: Full suite**

Run: `cd backend && uv run pytest -q`
Expected: every test passes; note the count in the commit message body.

- [ ] **Step 6: Commit**

```bash
git add README.md backend
git commit -m "Add READMEs and a model/migration drift test"
```
