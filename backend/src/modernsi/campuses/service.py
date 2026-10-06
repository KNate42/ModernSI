"""
Campus logic: which e-mail domains may sign up and what campus label they carry.
This work made by Anfinogentov Nikita
"""
import re

from sqlalchemy import select

from modernsi.campuses.models import DomainRequest, EmailDomain
from modernsi.core.errors import api_error

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
