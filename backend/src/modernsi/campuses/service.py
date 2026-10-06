"""
Campus logic: which e-mail domains may sign up and what campus label they carry.
This work made by Anfinogentov Nikita
"""
import re

from sqlalchemy import select

from modernsi.campuses.models import DomainRequest, EmailDomain
from modernsi.core.errors import api_error
from modernsi.mail import templates
from modernsi.mail.queue import enqueue

domain_pattern = re.compile(r"^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$")


def domain_of(email):
    return email.strip().lower().rsplit("@", 1)[-1]


def candidate_domains(domain):
    # student.uni.edu -> student.uni.edu, uni.edu (never the bare TLD)
    parts = domain.split(".")
    return [".".join(parts[i:]) for i in range(len(parts) - 1)]


async def find_domain(db, email):
    candidates = candidate_domains(domain_of(email))
    rows = (await db.execute(
        select(EmailDomain).where(EmailDomain.domain.in_(candidates), EmailDomain.is_active.is_(True))
    )).scalars().all()
    if not rows:
        return None
    return max(rows, key=lambda row: len(row.domain))


async def add_domain(db, domain, campus_label, country_code):
    domain = domain.strip().lower()
    if not domain_pattern.match(domain):
        raise api_error(422, "invalid_domain", "This does not look like a domain")
    row = (await db.execute(select(EmailDomain).where(EmailDomain.domain == domain))).scalar_one_or_none()
    if row is None:
        row = EmailDomain(domain=domain, campus_label=campus_label.strip(), country_code=country_code.strip().upper())
        db.add(row)
    else:
        row.campus_label = campus_label.strip()
        row.country_code = country_code.strip().upper()
        row.is_active = True
    await db.commit()
    return row


async def create_request(db, data):
    domain = data.domain.strip().lower()
    if not domain_pattern.match(domain):
        raise api_error(422, "invalid_domain", "This does not look like a domain")
    email = data.requester_email.strip().lower()
    email_domain = domain_of(email)
    if email_domain != domain and not email_domain.endswith("." + domain):
        raise api_error(422, "email_domain_mismatch", "Use an e-mail address on the domain you are requesting")
    if await find_domain(db, email) is not None:
        raise api_error(409, "domain_already_allowed", "This domain is already allowed, you can sign up")
    existing = (await db.execute(select(DomainRequest).where(
        DomainRequest.domain == domain, DomainRequest.requester_email == email, DomainRequest.status == "pending"
    ))).scalar_one_or_none()
    if existing is not None:
        return existing
    row = DomainRequest(domain=domain, university_name=data.university_name, requester_email=email)
    db.add(row)
    await db.commit()
    return row


async def list_domains(db):
    return (await db.execute(select(EmailDomain).order_by(EmailDomain.domain))).scalars().all()


async def patch_domain(db, domain_id, data):
    row = await db.get(EmailDomain, domain_id)
    if row is None:
        raise api_error(404, "domain_not_found", "There is no such domain")
    if data.campus_label is not None:
        row.campus_label = data.campus_label.strip()
    if data.country_code is not None:
        row.country_code = data.country_code.upper()
    if data.is_active is not None:
        row.is_active = data.is_active
    await db.commit()
    return row


async def list_requests(db, status):
    return (await db.execute(
        select(DomainRequest).where(DomainRequest.status == status).order_by(DomainRequest.created_at)
    )).scalars().all()


async def get_request(db, request_id):
    row = await db.get(DomainRequest, request_id)
    if row is None:
        raise api_error(404, "request_not_found", "There is no such request")
    return row


async def approve_request(db, settings, request_id, campus_label, country_code):
    row = await get_request(db, request_id)
    await add_domain(db, row.domain, campus_label, country_code)
    # everyone who asked for the same domain gets the good news at once
    waiting = (await db.execute(select(DomainRequest).where(
        DomainRequest.domain == row.domain, DomainRequest.status == "pending"
    ))).scalars().all()
    subject, body = templates.domain_approved(row.domain, settings.site_url)
    for item in waiting:
        item.status = "approved"
        enqueue(db, item.requester_email, subject, body)
    await db.commit()
    return row


async def reject_request(db, request_id):
    row = await get_request(db, request_id)
    row.status = "rejected"
    await db.commit()
    return row


async def list_campuses(db):
    # imported here: auth depends on campuses, so a top-level import would be circular
    from modernsi.auth.service import active_users_by_domain

    counts = await active_users_by_domain(db)
    grouped = {}
    for row in await list_domains(db):
        if not row.is_active:
            continue
        key = (row.campus_label, row.country_code)
        grouped[key] = grouped.get(key, 0) + counts.get(row.id, 0)
    campuses = [{"campus_label": label, "country_code": country, "students": students} for (label, country), students in grouped.items()]
    return sorted(campuses, key=lambda item: (-item["students"], item["campus_label"]))
