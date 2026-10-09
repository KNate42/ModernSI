"""
Auth logic: sign-up limited to allowed university domains, confirmation codes, login and account lookups.
This work made by Anfinogentov Nikita
"""
import logging

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError

from modernsi.auth.codes import check_code, clear_cooldown, issue_code
from modernsi.auth.models import User
from modernsi.auth.passwords import hash_password, hash_password_async, verify_password_async
from modernsi.auth.sessions import drop_all_sessions
from modernsi.campuses.service import find_domain
from modernsi.core.db import utcnow
from modernsi.core.errors import api_error
from modernsi.core.ratelimit import hit
from modernsi.feed.outbox import emit
from modernsi.mail import templates
from modernsi.mail.sender import send_now

log = logging.getLogger("modernsi.auth")
# I verify against this hash when the e-mail is unknown, so both answers take the same time. There I keep it
# as a fixed string made once with the hasher's parameters (passwords.py), instead of hashing on import: argon2
# takes 64 MB for every hash, and the worker and init import this module without ever logging anybody in.
# Made with: hash_password("this is not anybody's password"); remake it if the hasher's parameters change.
dummy_hash = "$argon2id$v=19$m=65536,t=3,p=4$BcqC7gRtjfu/paWhvXB2vA$Z/uNjtj2ZOiM95eweWhfdmqzGseB89+6Z2hiyMFwTWQ"


def normalise_email(email):
    return email.strip().lower()


def author_out(user):
    return {"id": user.id, "display_name": user.display_name, "campus_label": user.campus_label}


async def find_user_by_email(db, email):
    return (await db.execute(select(User).where(User.email == normalise_email(email)))).scalar_one_or_none()


async def send_code(hub, settings, user, purpose):
    code = await issue_code(hub.redis, purpose, user.id, settings.rl_codes_per_day)
    subject, body = templates.verify_code(code) if purpose == "verify" else templates.reset_code(code)
    try:
        await send_now(settings, user.email, subject, body)
    except Exception as exc:
        log.warning("could not send %s code to %s: %r", purpose, user.email, exc)
        await clear_cooldown(hub.redis, purpose, user.id)
        raise api_error(503, "mail_unavailable", "We could not send the e-mail, try again in a minute")


async def register(db, hub, settings, data):
    email = normalise_email(data.email)
    domain = await find_domain(db, email)
    if domain is None:
        raise api_error(422, "domain_not_allowed", "Your university e-mail domain is not on the list yet")
    if await find_user_by_email(db, email) is not None:
        raise api_error(409, "email_taken", "An account with this e-mail already exists")
    user = User(email=email, password_hash=await hash_password_async(data.password), display_name=data.display_name)
    user.domain = domain
    db.add(user)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise api_error(409, "email_taken", "An account with this e-mail already exists")
    try:
        await send_code(hub, settings, user, "verify")
    except api_error:
        # the account exists and the user is logged in; the confirm page offers "send again"
        pass
    return user


async def verify(db, hub, user, code):
    if user.status == "active":
        return user
    await check_code(hub.redis, "verify", user.id, code)
    user.status = "active"
    user.verified_at = utcnow()
    emit(db, "user_verified", actor_id=user.id, campus_label=user.campus_label, data={"display_name": user.display_name})
    await db.commit()
    return user


async def resend_verification(hub, settings, user):
    if user.status == "active":
        raise api_error(409, "already_verified", "Your e-mail is already confirmed")
    await send_code(hub, settings, user, "verify")


async def login(db, hub, settings, data, ip):
    email = normalise_email(data.email)
    await hit(hub.redis, f"login:{ip}:{email}", settings.rl_login_per_15min, 900)
    user = await find_user_by_email(db, email)
    if user is None:
        await verify_password_async(dummy_hash, data.password)
        raise api_error(401, "invalid_credentials", "Wrong e-mail or password")
    if not await verify_password_async(user.password_hash, data.password):
        raise api_error(401, "invalid_credentials", "Wrong e-mail or password")
    if user.status == "blocked":
        raise api_error(403, "account_blocked", "This account is blocked")
    return user


async def forgot_password(db, hub, settings, email):
    # the answer never tells whether the address exists
    user = await find_user_by_email(db, email)
    if user is None or user.status == "blocked":
        return
    try:
        await send_code(hub, settings, user, "reset")
    except api_error as exc:
        log.info("reset code not sent to %s: %s", user.email, exc.code)


async def reset_password(db, hub, data):
    user = await find_user_by_email(db, data.email)
    if user is None:
        raise api_error(400, "invalid_code", "This code is not right")
    await check_code(hub.redis, "reset", user.id, data.code)
    user.password_hash = await hash_password_async(data.password)
    await db.commit()
    await drop_all_sessions(hub.redis, user.id)


async def active_users_by_domain(db):
    rows = await db.execute(
        select(User.email_domain_id, func.count()).where(User.status == "active").group_by(User.email_domain_id)
    )
    return {domain_id: count for domain_id, count in rows.all()}


async def get_user(db, user_id):
    user = await db.get(User, user_id)
    if user is None:
        raise api_error(404, "user_not_found", "There is no such user")
    return user


async def get_public_user(db, user_id):
    user = await db.get(User, user_id)
    if user is None or user.status != "active":
        raise api_error(404, "user_not_found", "There is no such user")
    return user


async def set_role(db, user_id, role):
    user = await get_user(db, user_id)
    user.role = role
    await db.commit()
    return user


async def block_user(db, hub, admin, user_id):
    if admin.id == user_id:
        raise api_error(409, "cannot_block_self", "You cannot block yourself")
    user = await get_user(db, user_id)
    user.status = "blocked"
    await db.commit()
    await drop_all_sessions(hub.redis, user.id)
    return user


async def unblock_user(db, user_id):
    user = await get_user(db, user_id)
    user.status = "active" if user.verified_at is not None else "pending"
    await db.commit()
    return user


async def search_users(db, query, limit=50):
    statement = select(User).order_by(User.created_at.desc()).limit(limit)
    if query:
        pattern = f"%{query.strip().lower()}%"
        statement = statement.where(or_(User.email.like(pattern), func.lower(User.display_name).like(pattern)))
    return (await db.execute(statement)).scalars().all()


async def create_admin(db, email, name, password):
    email = normalise_email(email)
    if await find_user_by_email(db, email) is not None:
        raise api_error(409, "user_exists", "This e-mail already has an account")
    user = User(email=email, password_hash=hash_password(password), display_name=name.strip(), role="admin", status="active", verified_at=utcnow())
    user.domain = await find_domain(db, email)
    db.add(user)
    await db.commit()
    return user
