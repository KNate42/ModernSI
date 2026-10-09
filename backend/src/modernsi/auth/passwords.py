"""
Password hashing with argon2id.
This work made by Anfinogentov Nikita
"""
import asyncio

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

hasher = PasswordHasher()
# There I let one hash run at a time and in a thread: each one takes 64 MB (argon2-cffi default), so several at
# once would push the API past its memory cap on a small server, and on the event loop itself every other request
# (health checks included) would wait behind it
one_at_a_time = asyncio.Semaphore(1)


def hash_password(password):
    return hasher.hash(password)


def verify_password(stored_hash, password):
    try:
        return hasher.verify(stored_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


async def hash_password_async(password):
    """hash_password for request handlers: off the event loop, one at a time."""
    async with one_at_a_time:
        return await asyncio.to_thread(hash_password, password)


async def verify_password_async(stored_hash, password):
    """verify_password for request handlers: off the event loop, one at a time."""
    async with one_at_a_time:
        return await asyncio.to_thread(verify_password, stored_hash, password)
