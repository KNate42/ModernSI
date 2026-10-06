"""
Imports every ORM module so Alembic autogenerate and the tests see all tables.
This work made by Anfinogentov Nikita
"""
from modernsi.core.db import Base  # noqa: F401
