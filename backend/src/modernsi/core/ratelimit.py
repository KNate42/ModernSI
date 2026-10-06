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
