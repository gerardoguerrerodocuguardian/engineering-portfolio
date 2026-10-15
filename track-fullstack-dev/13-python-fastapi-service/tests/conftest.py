from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine

from app.config import Settings
from app.db import Base, make_engine
from app.main import create_app
from app.security import issue_token

SETTINGS = Settings(database_url="sqlite+aiosqlite:///:memory:", log_level="WARNING")
ALL_SCOPES = ["campaigns:read", "campaigns:write", "usage:write", "reports:read"]


@pytest.fixture
async def engine() -> AsyncIterator[AsyncEngine]:
    eng = make_engine(SETTINGS.database_url)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()


@pytest.fixture
async def client(engine: AsyncEngine) -> AsyncIterator[AsyncClient]:
    app = create_app(SETTINGS, engine)
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Authorization": f"Bearer {token()}"},
    ) as c:
        yield c


def token(scopes: list[str] | None = None, ttl_s: int = 3600) -> str:
    return issue_token(SETTINGS, "tester", ALL_SCOPES if scopes is None else scopes, ttl_s)


def auth(scopes: list[str]) -> dict[str, str]:
    return {"Authorization": f"Bearer {token(scopes)}"}


async def make_campaign(client: AsyncClient, name: str = "Spring launch") -> str:
    r = await client.post(
        "/v1/campaigns",
        json={"name": name, "dailyBudgetCents": 10_000, "maxBidCents": 150, "keywords": ["shoes"]},
    )
    assert r.status_code == 201, r.text
    return str(r.json()["id"])
