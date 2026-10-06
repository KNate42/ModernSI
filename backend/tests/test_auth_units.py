"""
Units of the auth module: password hashing, Redis sessions and one-time codes.
This work made by Anfinogentov Nikita
"""
import uuid

import pytest

from modernsi.auth.codes import check_code, issue_code
from modernsi.auth.passwords import hash_password, verify_password
from modernsi.auth.sessions import create_session, drop_all_sessions, drop_session, resolve_session
from modernsi.core.errors import api_error


async def test_password_roundtrip():
    stored = hash_password("correct horse battery")
    assert stored.startswith("$argon2id$")
    assert verify_password(stored, "correct horse battery")
    assert not verify_password(stored, "wrong horse battery")
    assert not verify_password("garbage", "anything")


async def test_session_lifecycle(hub):
    user_id = uuid.uuid4()
    token = await create_session(hub.redis, user_id, 30)
    assert await resolve_session(hub.redis, token, 30) == str(user_id)
    await drop_session(hub.redis, token)
    assert await resolve_session(hub.redis, token, 30) is None


async def test_session_token_is_not_stored_in_clear(hub):
    token = await create_session(hub.redis, uuid.uuid4(), 30)
    keys = await hub.redis.keys("session:*")
    assert keys and all(token not in key for key in keys)


async def test_drop_all_sessions(hub):
    user_id = uuid.uuid4()
    first = await create_session(hub.redis, user_id, 30)
    second = await create_session(hub.redis, user_id, 30)
    await drop_all_sessions(hub.redis, user_id)
    assert await resolve_session(hub.redis, first, 30) is None
    assert await resolve_session(hub.redis, second, 30) is None


async def test_code_accepts_right_code_once(hub):
    user_id = uuid.uuid4()
    code = await issue_code(hub.redis, "verify", user_id, 10)
    assert len(code) == 6 and code.isdigit()
    await check_code(hub.redis, "verify", user_id, code)
    with pytest.raises(api_error) as caught:
        await check_code(hub.redis, "verify", user_id, code)
    assert caught.value.code == "code_expired"


async def test_code_wrong_then_locked_after_five(hub):
    user_id = uuid.uuid4()
    code = await issue_code(hub.redis, "verify", user_id, 10)
    wrong = "000000" if code != "000000" else "111111"
    for _ in range(5):
        with pytest.raises(api_error) as caught:
            await check_code(hub.redis, "verify", user_id, wrong)
        assert caught.value.code == "invalid_code"
    with pytest.raises(api_error) as caught:
        await check_code(hub.redis, "verify", user_id, code)
    assert caught.value.code == "too_many_attempts"


async def test_code_resend_cooldown_and_daily_limit(hub):
    user_id = uuid.uuid4()
    await issue_code(hub.redis, "verify", user_id, 2)
    with pytest.raises(api_error) as caught:
        await issue_code(hub.redis, "verify", user_id, 2)
    assert caught.value.code == "code_cooldown"
    await hub.redis.delete(f"code_cooldown:verify:{user_id}")
    await issue_code(hub.redis, "verify", user_id, 2)
    await hub.redis.delete(f"code_cooldown:verify:{user_id}")
    with pytest.raises(api_error) as caught:
        await issue_code(hub.redis, "verify", user_id, 2)
    assert caught.value.code == "code_daily_limit"
