"""
Helpers shared by tests: reading mail from Mailpit; later tasks add user helpers here.
This work made by Anfinogentov Nikita
"""
import asyncio

import httpx

MAILPIT = "http://localhost:28025"
ORIGIN = "http://localhost:3000"


async def last_mail(to, subject_contains=""):
    # Mailpit lists newest first; I poll briefly because SMTP delivery is not instant
    async with httpx.AsyncClient(base_url=MAILPIT) as http:
        for _ in range(30):
            data = (await http.get("/api/v1/messages")).json()
            for message in data["messages"]:
                to_match = any(item["Address"] == to for item in message["To"])
                if to_match and subject_contains in message["Subject"]:
                    full = (await http.get(f"/api/v1/message/{message['ID']}")).json()
                    return {"subject": message["Subject"], "text": full["Text"]}
            await asyncio.sleep(0.1)
    raise AssertionError(f"no mail to {to} with subject containing {subject_contains!r}")


async def mail_count():
    async with httpx.AsyncClient(base_url=MAILPIT) as http:
        return (await http.get("/api/v1/messages")).json()["total"]


async def make_user(hub, email="aru@uni.edu", name="Aru", role="student", status="active", label="Almaty", country="KZ", password="correct horse battery"):
    # imported here because conftest loads this file before the auth module exists in early tasks
    from modernsi.auth.models import User
    from modernsi.auth.passwords import hash_password
    from modernsi.campuses.service import add_domain, find_domain
    from modernsi.core.db import utcnow

    async with hub.sessions() as db:
        domain = await find_domain(db, email)
        if domain is None:
            domain = await add_domain(db, email.split("@")[1], label, country)
        user = User(
            email=email, password_hash=hash_password(password), display_name=name, email_domain_id=domain.id,
            role=role, status=status, verified_at=utcnow() if status == "active" else None,
        )
        user.domain = domain
        db.add(user)
        await db.commit()
        return user


async def login_as(client, hub, user):
    from modernsi.auth.sessions import create_session

    token = await create_session(hub.redis, user.id, 30)
    client.cookies.set("msi_session", token)
    return client
