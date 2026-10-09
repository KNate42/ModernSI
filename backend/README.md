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

`uv run modernsi seed-demo` fills the dev stores with the made-up demo network (campuses on `demo.example`,
an account for every role with the password `MSI_DEMO_PASSWORD`, `modernsi-demo` by default, ideas, events, votes,
the feed) and prints the logins. It is safe to run again: later runs only move the demo events back around today
(and follow a changed demo password). `modernsi seed-demo --disable` closes the demo when a stack goes live: every
account on `*.demo.example` is blocked and logged out, and the demo domains stop accepting sign-ups.
`modernsi check-mail` fails when SMTP still points nowhere.

## Docker image

`Dockerfile` builds one image for the API (the default command), the worker (`modernsi worker`) and the one-shot
init (`modernsi migrate`, then `modernsi seed-demo` in demo mode, or `modernsi check-mail` and
`modernsi seed-demo --disable` in live mode). The worker runs with `--heartbeat /tmp/worker-alive`, which its
healthcheck reads. It installs exactly `uv.lock` and runs as a
non-root user. The root `compose.yml` uses it; see the root README.

## Tests

```bash
docker compose -f ../infra/docker-compose.test.yml up -d --wait
uv run pytest
```

Tests use real stores on separate ports and wipe them before every test.

## Settings

All settings are `MSI_*` environment variables (see `.env.example` and `src/modernsi/core/config.py`).
Thresholds: `MSI_VOTE_THRESHOLD` (50), `MSI_IDEA_TTL_DAYS` (60), `MSI_TEAM_MIN` (3), `MSI_STATS_MIN_STUDENTS` (25).
