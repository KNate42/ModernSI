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
