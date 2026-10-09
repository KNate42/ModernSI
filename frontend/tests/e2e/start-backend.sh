#!/bin/sh
# Starts the API and the worker on the test stores for Playwright.
# Small thresholds (2 votes, team of 2) let one test walk an idea all the way to an event.
# This work made by Anfinogentov Nikita
set -e
cd "$(dirname "$0")/../../../backend"
export MSI_POSTGRES_DSN="postgresql+asyncpg://modernsi:modernsi@localhost:25432/modernsi"
export MSI_REDIS_URL="redis://localhost:26379/0"
export MSI_MONGO_URL="mongodb://localhost:27117"
export MSI_MONGO_DB="modernsi_e2e"
export MSI_CLICKHOUSE_PORT=28123
export MSI_SMTP_PORT=21025
export MSI_SITE_URL="http://localhost:3100"
export MSI_ALLOWED_ORIGINS='["http://localhost:3100"]'
export MSI_TRUST_FORWARDED_FOR=true
export MSI_VOTE_THRESHOLD=2
export MSI_TEAM_MIN=2
export MSI_STATS_MIN_STUDENTS=1
export MSI_RL_REGISTER_PER_HOUR=1000
export MSI_RL_LOGIN_PER_15MIN=1000
export MSI_RL_IDEAS_PER_DAY=1000
uv run alembic upgrade head
uv run python -m tests.e2e_seed
uv run modernsi worker &
worker=$!
trap 'kill $worker 2>/dev/null' EXIT INT TERM
uv run uvicorn modernsi.app:create_app --factory --port 8100
