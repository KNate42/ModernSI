"""
Who is calling: session cookie -> user, plus guards for confirmed users and roles.
This work made by Anfinogentov Nikita
"""
import uuid

from fastapi import Depends, Request

from modernsi.auth.models import User
from modernsi.auth.sessions import resolve_session
from modernsi.core.db import get_db
from modernsi.core.errors import api_error

session_cookie = "msi_session"


async def optional_user(request: Request, db=Depends(get_db)):
    token = request.cookies.get(session_cookie)
    if not token:
        return None
    hub = request.app.state.stores
    user_id = await resolve_session(hub.redis, token, request.app.state.settings.session_days)
    if user_id is None:
        return None
    user = await db.get(User, uuid.UUID(user_id))
    if user is None or user.status == "blocked":
        return None
    # the request log reads this to store an anonymised user hash
    request.state.user_id = user.id
    return user


async def current_user(user=Depends(optional_user)):
    if user is None:
        raise api_error(401, "not_authenticated", "Please log in first")
    return user


async def active_user(user=Depends(current_user)):
    if user.status != "active":
        raise api_error(403, "email_not_verified", "Confirm your e-mail first")
    return user


def require_roles(*allowed):
    async def checker(user=Depends(active_user)):
        if user.role not in allowed:
            raise api_error(403, "forbidden", "You do not have access to this")
        return user

    return checker


def set_session_cookie(response, token, settings):
    response.set_cookie(
        session_cookie, token, max_age=settings.session_days * 86400,
        httponly=True, secure=settings.cookie_secure, samesite="lax", path="/",
    )


def clear_session_cookie(response, settings):
    response.delete_cookie(session_cookie, path="/", httponly=True, secure=settings.cookie_secure, samesite="lax")
