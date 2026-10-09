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
