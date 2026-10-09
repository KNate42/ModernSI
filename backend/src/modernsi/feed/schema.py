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
