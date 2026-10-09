"""
Seeds the test stores for the Playwright run: wipes them, allows uni.edu, creates the staff accounts.
Never point this at real data: it truncates every table.
This work made by Anfinogentov Nikita
"""
import asyncio

import httpx
from sqlalchemy import text

from modernsi import models
from modernsi.auth.models import User
from modernsi.auth.passwords import hash_password
from modernsi.campuses.service import add_domain
from modernsi.core.config import get_settings
from modernsi.core.db import utcnow
from modernsi.core.stores import stores
from modernsi.feed.schema import CLICKHOUSE_TABLES, ensure_schema

staff = [
    ("gov@uni.edu", "Gov Member", "student_gov"),
    ("curator@uni.edu", "Campus Curator", "curator"),
    ("admin@uni.edu", "Network Admin", "admin"),
]
password = "e2e password 123"


async def main():
    settings = get_settings()
    if "25432" not in settings.postgres_dsn:
        raise SystemExit("Ooops.. e2e_seed only runs against the test stores (port 25432)")
    hub = stores(settings)
    try:
        tables = ", ".join(table.name for table in models.Base.metadata.sorted_tables)
        async with hub.engine.begin() as conn:
            await conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
        await hub.redis.flushdb()
        await hub.mongo_client.drop_database(settings.mongo_db)
        client = await hub.get_clickhouse()
        await ensure_schema(client)
        for table in CLICKHOUSE_TABLES:
            await client.command(f"TRUNCATE TABLE IF EXISTS {table}")
        async with httpx.AsyncClient() as http:
            await http.delete("http://localhost:28025/api/v1/messages")
        async with hub.sessions() as db:
            domain = await add_domain(db, "uni.edu", "Almaty", "KZ")
            for email, name, role in staff:
                user = User(email=email, password_hash=hash_password(password), display_name=name, role=role, status="active", verified_at=utcnow())
                user.domain = domain
                db.add(user)
            await db.commit()
    finally:
        await hub.close()


asyncio.run(main())
