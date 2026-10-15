"""DuckDB warehouse: idempotent upsert by eventId, watermark state, partitioned Parquet export."""

from __future__ import annotations

import shutil
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path

import duckdb
import polars as pl

from .models import AdEvent

SCHEMA = """
CREATE TABLE IF NOT EXISTS ad_events (
    event_id    VARCHAR PRIMARY KEY,
    event_type  VARCHAR   NOT NULL,
    campaign_id VARCHAR   NOT NULL,
    cost_cents  BIGINT    NOT NULL,
    occurred_at TIMESTAMP NOT NULL,   -- naive UTC
    ingested_at TIMESTAMP NOT NULL    -- naive UTC, earliest arrival wins
);
CREATE TABLE IF NOT EXISTS pipeline_state (
    key   VARCHAR PRIMARY KEY,
    value VARCHAR NOT NULL
);
"""

UPSERT = """
INSERT INTO ad_events
SELECT event_id, event_type, campaign_id, cost_cents, occurred_at, ingested_at FROM stg
ON CONFLICT (event_id) DO UPDATE SET
    event_type  = excluded.event_type,
    campaign_id = excluded.campaign_id,
    cost_cents  = excluded.cost_cents,
    occurred_at = excluded.occurred_at,
    ingested_at = LEAST(ad_events.ingested_at, excluded.ingested_at)
"""

_STAGE_SCHEMA: dict[str, pl.DataType | type[pl.DataType]] = {
    "event_id": pl.String,
    "event_type": pl.String,
    "campaign_id": pl.String,
    "cost_cents": pl.Int64,
    "occurred_at": pl.Datetime("us"),
    "ingested_at": pl.Datetime("us"),
}


@dataclass(frozen=True)
class LoadResult:
    batch_events: int
    deduped_in_batch: int
    inserted: int
    updated: int
    restated: int
    previous_watermark: datetime | None
    watermark: datetime | None


def connect(path: Path | str) -> duckdb.DuckDBPyConnection:
    if isinstance(path, Path):
        path.parent.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(str(path))
    con.execute(SCHEMA)
    return con


def dedupe(events: Iterable[AdEvent]) -> list[AdEvent]:
    """Collapse repeated eventIds to one canonical event, independent of input order."""
    best: dict[str, tuple[tuple[object, ...], AdEvent]] = {}
    for e in events:
        key = (e.ingested_utc, e.type, e.campaign_id, e.cost_cents, e.occurred_utc)
        cur = best.get(str(e.event_id))
        if cur is None or key < cur[0]:
            best[str(e.event_id)] = (key, e)
    return [best[k][1] for k in sorted(best)]


def get_watermark(con: duckdb.DuckDBPyConnection) -> datetime | None:
    row = con.execute("SELECT value FROM pipeline_state WHERE key = 'watermark'").fetchone()
    return datetime.fromisoformat(row[0]) if row else None


def _set_watermark(con: duckdb.DuckDBPyConnection, value: datetime) -> None:
    con.execute(
        "INSERT INTO pipeline_state VALUES ('watermark', ?) "
        "ON CONFLICT (key) DO UPDATE SET value = excluded.value",
        [value.isoformat()],
    )


def load_events(
    con: duckdb.DuckDBPyConnection, events: Iterable[AdEvent], allowed_lateness: timedelta
) -> LoadResult:
    """Upsert events and advance the event-time watermark (monotonic).

    watermark = max(previous, max(occurred_at) - allowed_lateness). Newly inserted events
    older than the *previous* watermark are "restated": they change windows already
    considered final, which the report surfaces instead of hiding.
    """
    raw = list(events)
    unique = dedupe(raw)
    prev = get_watermark(con)
    rows = [
        (
            str(e.event_id),
            e.type,
            e.campaign_id,
            e.cost_cents,
            e.occurred_utc,
            e.ingested_utc,
        )
        for e in unique
    ]
    stage = pl.DataFrame(rows, schema=_STAGE_SCHEMA, orient="row")
    con.register("stg", stage)
    try:
        existing = con.execute(
            "SELECT count(*) FROM stg WHERE event_id IN (SELECT event_id FROM ad_events)"
        ).fetchone()
        updated = int(existing[0]) if existing else 0
        restated = 0
        if prev is not None:
            r = con.execute(
                "SELECT count(*) FROM stg WHERE occurred_at < ? "
                "AND event_id NOT IN (SELECT event_id FROM ad_events)",
                [prev],
            ).fetchone()
            restated = int(r[0]) if r else 0
        con.execute(UPSERT)
    finally:
        con.unregister("stg")
    mx = con.execute("SELECT max(occurred_at) FROM ad_events").fetchone()
    new_wm = prev
    if mx and mx[0] is not None:
        candidate = mx[0] - allowed_lateness
        new_wm = candidate if prev is None else max(prev, candidate)
    if new_wm is not None:
        _set_watermark(con, new_wm)
    return LoadResult(
        batch_events=len(raw),
        deduped_in_batch=len(raw) - len(unique),
        inserted=len(unique) - updated,
        updated=updated,
        restated=restated,
        previous_watermark=prev,
        watermark=new_wm,
    )


def export_parquet(con: duckdb.DuckDBPyConnection, out_dir: Path) -> list[str]:
    """Rewrite the Parquet lake from the table, partitioned by event day (deterministic)."""
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)
    target = str(out_dir).replace("'", "''")
    con.execute(
        "COPY (SELECT *, CAST(occurred_at AS DATE) AS day FROM ad_events ORDER BY event_id) "
        f"TO '{target}' (FORMAT PARQUET, PARTITION_BY (day), OVERWRITE_OR_IGNORE)"
    )
    return sorted(p.name for p in out_dir.iterdir() if p.is_dir())


def save_table(con: duckdb.DuckDBPyConnection, name: str, df: pl.DataFrame) -> None:
    con.register("_df", df)
    try:
        con.execute(f"CREATE OR REPLACE TABLE {name} AS SELECT * FROM _df")
    finally:
        con.unregister("_df")


def read_table(con: duckdb.DuckDBPyConnection, query: str) -> pl.DataFrame:
    return con.execute(query).pl()
