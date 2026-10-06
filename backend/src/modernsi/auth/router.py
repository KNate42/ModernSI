"""
HTTP endpoints of the auth module.
This work made by Anfinogentov Nikita
"""
from fastapi import APIRouter, Depends, Request, Response

from modernsi.auth import service
from modernsi.auth.deps import clear_session_cookie, current_user, session_cookie, set_session_cookie
from modernsi.auth.schemas import EmailIn, LoginIn, MeOut, RegisterIn, ResetIn, VerifyIn
from modernsi.auth.sessions import create_session, drop_all_sessions, drop_session
from modernsi.core.db import get_db
from modernsi.core.deps import get_config, get_hub
from modernsi.core.ratelimit import hit
from modernsi.core.security import client_ip

router = APIRouter(prefix="/api/auth", tags=["auth"])


def me_out(user):
    return {
        "id": user.id, "email": user.email, "display_name": user.display_name,
        "campus_label": user.campus_label, "role": user.role, "status": user.status,
    }


@router.post("/register", status_code=201, response_model=MeOut)
async def register(data: RegisterIn, request: Request, response: Response, db=Depends(get_db), hub=Depends(get_hub), settings=Depends(get_config)):
    await hit(hub.redis, "register:" + client_ip(request, settings), settings.rl_register_per_hour, 3600)
    user = await service.register(db, hub, settings, data)
    set_session_cookie(response, await create_session(hub.redis, user.id, settings.session_days), settings)
    return me_out(user)


@router.post("/verify", response_model=MeOut)
async def verify(data: VerifyIn, user=Depends(current_user), db=Depends(get_db), hub=Depends(get_hub)):
    return me_out(await service.verify(db, hub, user, data.code))


@router.post("/verify/resend", status_code=204)
async def resend(user=Depends(current_user), hub=Depends(get_hub), settings=Depends(get_config)):
    await service.resend_verification(hub, settings, user)


@router.post("/login", response_model=MeOut)
async def login(data: LoginIn, request: Request, response: Response, db=Depends(get_db), hub=Depends(get_hub), settings=Depends(get_config)):
    user = await service.login(db, hub, settings, data, client_ip(request, settings))
    set_session_cookie(response, await create_session(hub.redis, user.id, settings.session_days), settings)
    return me_out(user)


@router.post("/logout", status_code=204)
async def logout(request: Request, response: Response, hub=Depends(get_hub), settings=Depends(get_config)):
    token = request.cookies.get(session_cookie)
    if token:
        await drop_session(hub.redis, token)
    clear_session_cookie(response, settings)


@router.post("/logout-all", status_code=204)
async def logout_all(response: Response, user=Depends(current_user), hub=Depends(get_hub), settings=Depends(get_config)):
    await drop_all_sessions(hub.redis, user.id)
    clear_session_cookie(response, settings)


@router.get("/me", response_model=MeOut)
async def me(user=Depends(current_user)):
    return me_out(user)


@router.post("/password/forgot", status_code=202)
async def forgot(data: EmailIn, request: Request, db=Depends(get_db), hub=Depends(get_hub), settings=Depends(get_config)):
    await hit(hub.redis, "forgot:" + client_ip(request, settings), settings.rl_login_per_15min, 900)
    await service.forgot_password(db, hub, settings, data.email)
    return {}


@router.post("/password/reset", status_code=204)
async def reset(data: ResetIn, request: Request, db=Depends(get_db), hub=Depends(get_hub), settings=Depends(get_config)):
    await hit(hub.redis, "reset:" + client_ip(request, settings), settings.rl_login_per_15min, 900)
    await service.reset_password(db, hub, data)
