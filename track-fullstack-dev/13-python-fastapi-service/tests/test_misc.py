from __future__ import annotations

import json
import logging
import sqlite3
from pathlib import Path

import pytest
from alembic.config import Config

from alembic import command
from app.config import Settings
from app.logging_conf import JsonFormatter, configure_logging, request_id_var
from app.main import app_factory


def test_alembic_upgrade_and_downgrade(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    db = tmp_path / "m.db"
    cfg = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    cfg.set_main_option("script_location", str(Path(__file__).resolve().parents[1] / "alembic"))
    cfg.set_main_option("sqlalchemy.url", f"sqlite+aiosqlite:///{db}")
    command.upgrade(cfg, "head")
    tables = {r[0] for r in sqlite3.connect(db).execute("select name from sqlite_master")}
    assert {"campaigns", "usage_events", "report_aggregates"} <= tables
    command.downgrade(cfg, "base")
    tables = {r[0] for r in sqlite3.connect(db).execute("select name from sqlite_master")}
    assert "campaigns" not in tables


def test_alembic_offline_sql(capsys: pytest.CaptureFixture[str]) -> None:
    cfg = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    cfg.set_main_option("script_location", str(Path(__file__).resolve().parents[1] / "alembic"))
    cfg.set_main_option("sqlalchemy.url", "sqlite+aiosqlite:///offline.db")
    command.upgrade(cfg, "head", sql=True)
    assert "CREATE TABLE campaigns" in capsys.readouterr().out


def test_settings_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://u:p@db/adflow")
    monkeypatch.setenv("JWT_ISSUER", "other")
    s = Settings.from_env()
    assert s.database_url.startswith("postgresql+asyncpg")
    assert s.jwt_issuer == "other"


def test_json_formatter_includes_context_and_extras() -> None:
    request_id_var.set("rid-1")
    try:
        raise ValueError("bad")
    except ValueError:
        import sys

        record = logging.LogRecord("t", logging.ERROR, "f", 1, "hello %s", ("x",), sys.exc_info())
    record.custom = 42
    out = json.loads(JsonFormatter().format(record))
    assert out["msg"] == "hello x"
    assert out["request_id"] == "rid-1"
    assert out["custom"] == 42
    assert "ValueError" in out["exc"]


def test_configure_logging_installs_json_handler() -> None:
    configure_logging("WARNING")
    assert isinstance(logging.getLogger().handlers[0].formatter, JsonFormatter)


def test_app_factory_builds_app(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
    assert app_factory().title == "AdFlow Ads Reporting Service"


async def test_lifespan_creates_schema() -> None:
    from app.main import create_app

    app = create_app(Settings(database_url="sqlite+aiosqlite:///:memory:"))
    async with app.router.lifespan_context(app), app.state.sessionmaker() as session:
        from sqlalchemy import text

        assert (await session.execute(text("select count(*) from campaigns"))).scalar() == 0
