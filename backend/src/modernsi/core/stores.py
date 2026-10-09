"""
Connections to every store the backend uses. I open them once at startup and keep them on app.state.
This work made by Anfinogentov Nikita
"""
import asyncio
import time

import clickhouse_connect
from pymongo import AsyncMongoClient
from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine


async def close_quietly(client):
    try:
        await client.close()
    except Exception:
        pass


class stores:
    def __init__(self, settings):
        self.settings = settings
        self.engine = create_async_engine(
            settings.postgres_dsn,
            pool_pre_ping=True,
            pool_size=settings.db_pool_size,
            max_overflow=settings.db_max_overflow,
            pool_recycle=settings.db_pool_recycle,
        )
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)
        self.redis = Redis.from_url(settings.redis_url, decode_responses=True, socket_timeout=3)
        self.mongo_client = AsyncMongoClient(settings.mongo_url, serverSelectionTimeoutMS=2000)
        self.mongo = self.mongo_client[settings.mongo_db]
        self.clickhouse = None
        self.clickhouse_tried_at = float("-inf")
        self.closing = set()

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
        # Called after a failed query, so the next call reconnects instead of reusing a broken client;
        # I close the old one in the background so its HTTP session does not leak
        client, self.clickhouse = self.clickhouse, None
        if client is not None:
            task = asyncio.get_running_loop().create_task(close_quietly(client))
            self.closing.add(task)
            task.add_done_callback(self.closing.discard)

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
