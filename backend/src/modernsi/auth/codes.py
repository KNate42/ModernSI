"""
Six-digit one-time codes for e-mail confirmation and password reset: 15 minutes, 5 attempts,
one resend per minute and a daily cap.
This work made by Anfinogentov Nikita
"""
import hashlib
import hmac
import secrets

from modernsi.core.errors import api_error

code_ttl = 15 * 60
max_attempts = 5


def digest(code):
    return hashlib.sha256(code.encode()).hexdigest()


def cooldown_key(purpose, user_id):
    return f"code_cooldown:{purpose}:{user_id}"


async def issue_code(redis, purpose, user_id, daily_limit):
    if not await redis.set(cooldown_key(purpose, user_id), "1", ex=60, nx=True):
        raise api_error(429, "code_cooldown", "Wait a minute before asking for a new code")
    daily = f"code_daily:{purpose}:{user_id}"
    count = await redis.incr(daily)
    if count == 1:
        await redis.expire(daily, 86400)
    if count > daily_limit:
        raise api_error(429, "code_daily_limit", "Too many codes today, try again tomorrow")
    code = f"{secrets.randbelow(1_000_000):06d}"
    key = f"code:{purpose}:{user_id}"
    async with redis.pipeline(transaction=True) as pipe:
        pipe.delete(key)
        pipe.hset(key, mapping={"hash": digest(code), "attempts": 0})
        pipe.expire(key, code_ttl)
        await pipe.execute()
    return code


async def clear_cooldown(redis, purpose, user_id):
    # used when the e-mail could not be sent, so the user may retry at once
    await redis.delete(cooldown_key(purpose, user_id))


async def check_code(redis, purpose, user_id, code):
    key = f"code:{purpose}:{user_id}"
    stored = await redis.hget(key, "hash")
    if stored is None:
        raise api_error(400, "code_expired", "The code has expired, ask for a new one")
    attempts = await redis.hincrby(key, "attempts", 1)
    if attempts > max_attempts:
        await redis.delete(key)
        raise api_error(429, "too_many_attempts", "Too many wrong codes, ask for a new one")
    if not hmac.compare_digest(stored, digest(code)):
        raise api_error(400, "invalid_code", "This code is not right")
    await redis.delete(key)
