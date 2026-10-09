"""
Alembic environment: takes the DSN from Settings and the tables from modernsi.models.
This work made by Anfinogentov Nikita
"""
import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

from modernsi import models
from modernsi.core.config import get_settings

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)
target_metadata = models.Base.metadata


def run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


async def run_online():
    engine = create_async_engine(get_settings().postgres_dsn)
    async with engine.connect() as connection:
        await connection.run_sync(run_migrations)
    await engine.dispose()


if context.is_offline_mode():
    context.configure(url=get_settings().postgres_dsn, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()
else:
    asyncio.run(run_online())
