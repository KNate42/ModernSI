"""
Imports every ORM module so Alembic autogenerate and the tests see all tables.
This work made by Anfinogentov Nikita
"""
from modernsi.core.db import Base  # noqa: F401
from modernsi.campuses import models as campuses_models  # noqa: F401,E402
from modernsi.feed import models as feed_models  # noqa: F401,E402
from modernsi.mail import models as mail_models  # noqa: F401,E402
