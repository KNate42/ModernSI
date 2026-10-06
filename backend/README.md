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
