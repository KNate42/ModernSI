"""
User accounts. The campus label comes from the allowed e-mail domain the user signed up with.
This work made by Anfinogentov Nikita
"""
import uuid

from sqlalchemy import DateTime, ForeignKey, String, Uuid
from sqlalchemy.orm import mapped_column, relationship

from modernsi.campuses.models import EmailDomain
from modernsi.core.db import Base, utcnow

roles = ("student", "student_gov", "curator", "admin")


class User(Base):
    __tablename__ = "users"

    id = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email = mapped_column(String(320), unique=True, nullable=False)
    password_hash = mapped_column(String(255), nullable=False)
    display_name = mapped_column(String(60), nullable=False)
    # nullable only for admins created from the CLI with a non-university address
    email_domain_id = mapped_column(ForeignKey("email_domains.id"), nullable=True, index=True)
    role = mapped_column(String(20), nullable=False, default="student")
    status = mapped_column(String(10), nullable=False, default="pending", index=True)
    created_at = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    verified_at = mapped_column(DateTime(timezone=True), nullable=True)

    domain = relationship(EmailDomain, lazy="joined")

    @property
    def campus_label(self):
        return self.domain.campus_label if self.domain is not None else None
