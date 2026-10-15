"""JWT bearer authentication with OAuth2-style scopes (space separated `scope` claim)."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

import jwt
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import Settings
from app.errors import AuthError, ForbiddenError

bearer = HTTPBearer(auto_error=False, description="JWT with a space separated `scope` claim")


@dataclass(frozen=True)
class Principal:
    subject: str
    scopes: frozenset[str]


def issue_token(settings: Settings, subject: str, scopes: list[str], ttl_s: int = 3600) -> str:
    """Mint a token. Used by tests and local development only."""
    import time

    now = int(time.time())
    claims: dict[str, Any] = {
        "sub": subject,
        "scope": " ".join(scopes),
        "iss": settings.jwt_issuer,
        "iat": now,
        "exp": now + ttl_s,
    }
    return jwt.encode(claims, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def get_settings(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


def current_principal(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),  # noqa: B008
    settings: Settings = Depends(get_settings),  # noqa: B008
) -> Principal:
    if creds is None:
        raise AuthError("Missing bearer token")
    try:
        claims = jwt.decode(
            creds.credentials,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            issuer=settings.jwt_issuer,
            options={"require": ["exp", "sub", "iss"]},
        )
    except jwt.PyJWTError as exc:
        raise AuthError("Invalid or expired token") from exc
    return Principal(str(claims["sub"]), frozenset(str(claims.get("scope", "")).split()))


def require_scope(scope: str) -> Callable[..., Principal]:
    def dependency(principal: Principal = Depends(current_principal)) -> Principal:  # noqa: B008
        if scope not in principal.scopes:
            raise ForbiddenError(f"Missing required scope: {scope}")
        return principal

    return dependency
