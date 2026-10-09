"""
Settings of the whole backend, read from MSI_* environment variables or backend/.env.
This work made by Anfinogentov Nikita
"""
from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="MSI_", env_file=".env", extra="ignore")

    postgres_dsn: str = "postgresql+asyncpg://modernsi:modernsi@localhost:15432/modernsi"
    redis_url: str = "redis://localhost:16379/0"
    mongo_url: str = "mongodb://localhost:17017"
    mongo_db: str = "modernsi"
    clickhouse_host: str = "localhost"
    clickhouse_port: int = 18123
    clickhouse_user: str = "modernsi"
    clickhouse_password: str = "modernsi"
    clickhouse_db: str = "modernsi"

    smtp_host: str = "localhost"
    smtp_port: int = 11025
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_starttls: bool = False
    mail_from: str = "ModernSI <no-reply@modernsi.local>"

    site_url: str = "http://localhost:3000"
    allowed_origins: list[str] = ["http://localhost:3000"]
    # None means "follow site_url": Secure on https, off on plain http (localhost)
    cookie_secure: bool | None = None
    trust_forwarded_for: bool = False
    session_days: int = 30
    log_salt: str = "change-me"

    vote_threshold: int = 50
    idea_ttl_days: int = 60
    team_min: int = 3
    stats_min_students: int = 25

    # password of every demo account (modernsi seed-demo); scripts/new_env.py makes a random one for a public address
    demo_password: str = "modernsi-demo"

    rl_register_per_hour: int = 5
    rl_login_per_15min: int = 10
    rl_codes_per_day: int = 10
    rl_votes_per_minute: int = 60
    rl_ideas_per_day: int = 5

    @model_validator(mode="after")
    def derive_cookie_secure(self):
        if self.cookie_secure is None:
            self.cookie_secure = self.site_url.startswith("https://")
        return self


@lru_cache
def get_settings():
    return Settings()
