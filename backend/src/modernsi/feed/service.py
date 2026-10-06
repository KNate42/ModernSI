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
        # the cursor comes from the unfiltered page, so hiding never makes pagination skip rows
        next_cursor = f"{items[-1]['at'].isoformat()}|{items[-1]['id']}"
    # imported here: ideas imports feed (emit), so a top-level import would be circular
    from modernsi.ideas.service import hidden_idea_ids

    hidden = await hidden_idea_ids(db, {item["idea_id"] for item in items if item["idea_id"]})
    return {"items": [item for item in items if item["idea_id"] not in hidden], "next_cursor": next_cursor}


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
