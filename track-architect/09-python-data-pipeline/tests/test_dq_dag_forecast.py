from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal

import polars as pl
import pytest
from hypothesis import given
from hypothesis import strategies as st

from adflow_pipeline import dq, store
from adflow_pipeline.dag import DAG, CycleError
from adflow_pipeline.forecast import forecast_ctr
from adflow_pipeline.models import AdEvent


def test_parse_checks_ok_and_defaults() -> None:
    cs = dq.parse_checks(dq.DEFAULT_CHECKS)
    assert any(c.severity == "warn" for c in cs) and len(cs) >= 7
    c = dq.parse_checks("null_rate(costCents) <= 0.5  # comment")[0]
    assert (c.metric, c.arg, c.op, c.threshold, c.severity) == (
        "null_rate",
        "costCents",
        "<=",
        0.5,
        "error",
    )


@pytest.mark.parametrize(
    "bad",
    [
        "row_count ~ 3",
        "bogus >= 1",
        "null_rate >= 1",
        "row_count(x) >= 1",
        "null_rate(nope) <= 1",
        "row_count >=",
    ],
)
def test_parse_checks_rejects(bad: str) -> None:
    with pytest.raises(dq.CheckSyntaxError):
        dq.parse_checks(bad)


@given(st.sampled_from([">=", "<=", "==", "!=", ">", "<"]), st.decimals(0, 1000, places=3))
def test_parse_roundtrip(op: str, num: Decimal) -> None:
    c = dq.parse_checks(f"warn: row_count {op} {num:f}")[0]
    assert (c.op, c.severity) == (op, "warn") and c.threshold == float(num)


def _ctx(unknown: list[str] | None = None, quarantined: int = 0) -> dq.DQContext:
    con = store.connect(":memory:")
    e = AdEvent.model_validate({
        "eventId": "00000000-0000-4000-8000-000000000001", "type": "CLICK", "campaignId": "c",
        "costCents": 1, "occurredAt": "2026-09-01T00:00:00Z", "ingestedAt": "2026-09-01T09:00:00Z",
    })  # fmt: skip
    store.load_events(con, [e], timedelta(hours=2))
    v = {"raw_count": 10, "valid_count": 10 - quarantined, "quarantined_count": quarantined,
         "object_count": 10, "unknown_fields": unknown or [], "null_counts": dict.fromkeys(
             ("eventId", "type", "campaignId", "costCents", "occurredAt"), 0)}  # fmt: skip
    return dq.DQContext(con, v, 2, datetime(2026, 9, 1, 10))


def test_metrics() -> None:
    ctx = _ctx(["x"], quarantined=2)
    names = [
        "row_count",
        "quarantine_rate",
        "duplicate_rate",
        "late_rate",
        "freshness_hours",
        "schema_drift",
    ]
    m = {k: dq.compute_metric(ctx, k, None) for k in names}
    assert m["row_count"] == 1 and m["quarantine_rate"] == 0.2 and m["duplicate_rate"] == 0.25
    assert m["late_rate"] == 1.0 and m["freshness_hours"] == 10.0 and m["schema_drift"] == 1.0
    assert dq.compute_metric(ctx, "null_rate", "campaignId") == 0.0


def test_dq_failure_blocks_only_on_error_severity() -> None:
    ctx = _ctx(["userAgent"])
    res = dq.run_checks(ctx, dq.parse_checks("error: schema_drift == 0\nwarn: late_rate <= 0.1"))
    assert [r.passed for r in res] == [False, False]
    assert not dq.gate_passed(res)
    assert dq.gate_passed(dq.run_checks(ctx, dq.parse_checks("warn: late_rate <= 0.1")))


def _boom(_: list[str]) -> None:
    raise RuntimeError("boom")


def test_dag_order_failure_and_cycles() -> None:
    log: list[str] = []
    dag: DAG[list[str]] = DAG("t")
    dag.add("c", lambda c: c.append("c"), ("a", "b"))
    dag.add("b", _boom, ("a",))
    dag.add("a", lambda c: c.append("a"))
    dag.add("d", lambda c: c.append("d"))
    assert dag.order() == ["a", "b", "c", "d"]
    runs = {r.name: r.status for r in dag.run(log)}
    assert runs == {"a": "success", "b": "failed", "c": "skipped", "d": "success"}
    assert log == ["a", "d"]
    with pytest.raises(ValueError):
        dag.add("a", lambda c: None)
    cyc: DAG[None] = DAG("cyc")
    cyc.add("x", lambda c: None, ("y",))
    cyc.add("y", lambda c: None, ("x",))
    with pytest.raises(CycleError):
        cyc.order()
    unk: DAG[None] = DAG("u")
    unk.add("x", lambda c: None, ("zzz",))
    with pytest.raises(ValueError):
        unk.order()


def _hourly(days: int, ctr_by_hour: bool = True) -> pl.DataFrame:
    rows = []
    for d in range(days):
        for h in range(24):
            clicks = 5 + (h % 4 if ctr_by_hour else 0)
            rows.append({"day": datetime(2026, 9, 1 + d).date(), "hour_of_day": h,
                         "clicks": clicks, "impressions": 100, "is_final": True})  # fmt: skip
    return pl.DataFrame(rows)


def test_forecast_seasonal_beats_constant_on_seasonal_data() -> None:
    f = forecast_ctr(_hourly(4))
    assert f.status == "ok" and f.days_used == 4 and len(f.next_day) == 24
    assert f.skill is not None and f.skill > 0.5
    assert "better than" in f.note


def test_forecast_flat_data_has_no_skill_claim() -> None:
    f = forecast_ctr(_hourly(4, ctr_by_hour=False))
    assert f.status == "ok" and "no better than" in f.note


def test_forecast_insufficient_data() -> None:
    assert forecast_ctr(_hourly(2)).status == "insufficient_data"
    assert (
        forecast_ctr(_hourly(3).with_columns(is_final=pl.lit(False))).status == "insufficient_data"
    )
