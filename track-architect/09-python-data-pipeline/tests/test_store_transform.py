from __future__ import annotations

import random
from datetime import datetime, timedelta

import duckdb
import polars as pl
from hypothesis import given, settings
from hypothesis import strategies as st

from adflow_pipeline import store, transform
from adflow_pipeline.models import AdEvent
from adflow_pipeline.validate import validate_lines

LATENESS = timedelta(hours=2)


def ev(
    n: int,
    etype: str = "IMPRESSION",
    cost: int = 3,
    at: str = "2026-09-01T10:15:00Z",
    ingested: str | None = None,
    camp: str = "cmp-001",
) -> AdEvent:
    d: dict[str, object] = {
        "eventId": f"00000000-0000-4000-8000-{n:012d}",
        "type": etype, "campaignId": camp, "costCents": cost, "occurredAt": at,
    }  # fmt: skip
    if ingested:
        d["ingestedAt"] = ingested
    return AdEvent.model_validate(d)


def table(con: duckdb.DuckDBPyConnection) -> list[tuple[object, ...]]:
    rows: list[tuple[object, ...]] = con.execute(
        "SELECT * FROM ad_events ORDER BY event_id"
    ).fetchall()
    return rows


def test_upsert_is_idempotent_and_keeps_earliest_arrival() -> None:
    con = store.connect(":memory:")
    first = ev(1, ingested="2026-09-01T10:16:00Z")
    r1 = store.load_events(con, [first], LATENESS)
    later = ev(1, ingested="2026-09-01T12:00:00Z")
    r2 = store.load_events(con, [later, first], LATENESS)
    assert (r1.inserted, r2.inserted, r2.updated, r2.deduped_in_batch) == (1, 0, 1, 1)
    rows = table(con)
    assert len(rows) == 1 and rows[0][5] == datetime(2026, 9, 1, 10, 16)


def test_late_event_restates_window_and_watermark_is_monotonic() -> None:
    con = store.connect(":memory:")
    store.load_events(
        con, [ev(1, at="2026-09-01T10:15:00Z"), ev(2, at="2026-09-01T20:00:00Z")], LATENESS
    )
    wm1 = store.get_watermark(con)
    assert wm1 == datetime(2026, 9, 1, 18)
    late = ev(3, "CLICK", 50, at="2026-09-01T10:30:00Z", ingested="2026-09-01T21:00:00Z")
    res = store.load_events(con, [late], LATENESS)
    assert res.restated == 1 and res.previous_watermark == wm1
    assert store.get_watermark(con) == wm1  # never moves backwards
    hourly = transform.hourly_metrics(con, store.get_watermark(con))
    h10 = hourly.filter(pl.col("hour_start") == datetime(2026, 9, 1, 10)).row(0, named=True)
    assert (h10["impressions"], h10["clicks"], h10["spend_cents"]) == (1, 1, 53)
    assert h10["is_final"] and h10["late_events"] == 1 and h10["ctr"] == 1.0
    h20 = hourly.filter(pl.col("hour_start") == datetime(2026, 9, 1, 20)).row(0, named=True)
    assert not h20["is_final"]


def test_pacing_and_daily_rollup() -> None:
    con = store.connect(":memory:")
    store.load_events(
        con, [ev(i, cost=100, at=f"2026-09-01T0{i}:10:00Z") for i in range(3)], LATENESS
    )
    hourly = transform.hourly_metrics(con, None)
    assert hourly["cum_spend_cents"].to_list() == [100, 200, 300]
    budget = transform.daily_budget_cents("cmp-001")
    assert abs(hourly["pacing_ratio"][2] - 300 / (budget * 3 / 24)) < 1e-9
    daily = transform.daily_metrics(hourly)
    assert daily.row(0, named=True)["spend_cents"] == 300


def test_empty_inputs() -> None:
    con = store.connect(":memory:")
    res = store.load_events(con, [], LATENESS)
    assert res.watermark is None
    hourly = transform.hourly_metrics(con, None)
    assert hourly.is_empty() and transform.daily_metrics(hourly).is_empty()


def test_parquet_export_partitioned_by_day(tmp_path: object) -> None:
    from pathlib import Path

    con = store.connect(":memory:")
    store.load_events(con, [ev(1), ev(2, at="2026-09-02T01:00:00Z")], LATENESS)
    parts = store.export_parquet(con, Path(str(tmp_path)) / "lake")
    assert parts == ["day=2026-09-01", "day=2026-09-02"]


@settings(deadline=None, max_examples=40)
@given(st.lists(st.integers(1, 12), min_size=1, max_size=30), st.integers(0, 10_000))
def test_load_order_and_repetition_do_not_change_result(ids: list[int], seed: int) -> None:
    events = [ev(i, cost=i, at=f"2026-09-01T{i:02d}:00:00Z") for i in ids]
    shuffled = events[:]
    random.Random(seed).shuffle(shuffled)
    a, b = store.connect(":memory:"), store.connect(":memory:")
    store.load_events(a, events, LATENESS)
    store.load_events(b, shuffled + events[:3], LATENESS)
    store.load_events(b, shuffled, LATENESS)
    assert table(a) == table(b)


def test_dedupe_helper_on_validated_lines() -> None:
    import json

    payload = {
        "eventId": "00000000-0000-4000-8000-000000000001",
        "type": "CLICK",
        "campaignId": "c",
        "costCents": 1,
        "occurredAt": "2026-09-01T00:00:00Z",
    }
    line = json.dumps(payload)
    assert len(store.dedupe(validate_lines([line, line]).valid)) == 1
