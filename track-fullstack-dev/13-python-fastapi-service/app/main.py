"""Application factory."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy.ext.asyncio import AsyncEngine

from app.config import Settings
from app.db import Base, make_engine, make_sessionmaker
from app.errors import install_error_handlers
from app.logging_conf import configure_logging
from app.routers import campaigns, reports
from app.telemetry import TelemetryMiddleware


def create_app(settings: Settings | None = None, engine: AsyncEngine | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    engine = engine or make_engine(settings.database_url)
    configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        if settings.database_url.startswith("sqlite"):
            # Dev convenience only; PostgreSQL deployments run `alembic upgrade head`.
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
        yield
        await engine.dispose()

    app = FastAPI(
        title="AdFlow Ads Reporting Service",
        version="1.0.0",
        description="Fictional AdFlow platform; synthetic data only.",
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.sessionmaker = make_sessionmaker(engine)
    app.add_middleware(TelemetryMiddleware)
    install_error_handlers(app)
    app.include_router(campaigns.router)
    app.include_router(reports.router)

    @app.get("/healthz", tags=["ops"])
    async def healthz() -> dict[str, str]:
        return {"status": "UP"}

    return app


def app_factory() -> FastAPI:
    """uvicorn --factory entry point."""
    return create_app()
