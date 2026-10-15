"""Runtime settings, read from the environment (12-factor)."""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    database_url: str = "sqlite+aiosqlite:///./adflow.db"
    # Development-only default. Real deployments inject JWT_SECRET (or switch to RS256/JWKS).
    jwt_secret: str = "dev-only-signing-key-not-for-production-use-0123456789"  # noqa: S105
    jwt_algorithm: str = "HS256"
    jwt_issuer: str = "adflow-dev"
    log_level: str = "INFO"

    @classmethod
    def from_env(cls) -> Settings:
        d = cls()
        return cls(
            database_url=os.environ.get("DATABASE_URL", d.database_url),
            jwt_secret=os.environ.get("JWT_SECRET", d.jwt_secret),
            jwt_algorithm=os.environ.get("JWT_ALGORITHM", d.jwt_algorithm),
            jwt_issuer=os.environ.get("JWT_ISSUER", d.jwt_issuer),
            log_level=os.environ.get("LOG_LEVEL", d.log_level),
        )
