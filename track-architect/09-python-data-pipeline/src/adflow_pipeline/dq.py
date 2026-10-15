"""Data-quality checks with a tiny declarative DSL.

One check per line::

    [error|warn:] metric[(arg)] <op> number      # comment

Examples: ``row_count >= 1000``, ``warn: late_rate <= 0.10``, ``null_rate(campaignId) <= 0.02``.
Metrics: row_count, raw_count, quarantine_rate, duplicate_rate, null_rate(field),
late_rate, freshness_hours, schema_drift.
"""

from __future__ import annotations

import operator
import re
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import duckdb

from .models import CONTRACT_FIELDS

DEFAULT_CHECKS = """
# volume
error: row_count >= 1000
# validation outcome
error: quarantine_rate <= 0.05
error: null_rate(campaignId) <= 0.05
error: duplicate_rate <= 0.10
warn:  late_rate <= 0.10
# timeliness and contract
error: freshness_hours <= 48
error: schema_drift == 0
"""

_LINE = re.compile(
    r"^(?:(?P<sev>error|warn)\s*:\s*)?(?P<metric>[a-z_]+)(?:\((?P<arg>\w+)\))?"
    r"\s*(?P<op>>=|<=|==|!=|>|<)\s*(?P<num>-?\d+(?:\.\d+)?)$"
)
_OPS: dict[str, Callable[[float, float], bool]] = {
    ">=": operator.ge,
    "<=": operator.le,
    "==": operator.eq,
    "!=": operator.ne,
    ">": operator.gt,
    "<": operator.lt,
}
METRICS = {
    "row_count",
    "raw_count",
    "quarantine_rate",
    "duplicate_rate",
    "null_rate",
    "late_rate",
    "freshness_hours",
    "schema_drift",
}


class CheckSyntaxError(ValueError):
    pass


@dataclass(frozen=True)
class Check:
    expr: str
    severity: str
    metric: str
    arg: str | None
    op: str
    threshold: float


@dataclass(frozen=True)
class CheckResult:
    check: Check
    value: float
    passed: bool


def parse_checks(text: str) -> list[Check]:
    checks: list[Check] = []
    for no, raw in enumerate(text.splitlines(), start=1):
        line = raw.split("#", 1)[0].strip()
        if not line:
            continue
        m = _LINE.match(line)
        if not m:
            raise CheckSyntaxError(f"line {no}: cannot parse {line!r}")
        metric, arg = m["metric"], m["arg"]
        if metric not in METRICS:
            raise CheckSyntaxError(f"line {no}: unknown metric {metric!r}")
        if (metric == "null_rate") != (arg is not None):
            raise CheckSyntaxError(f"line {no}: only null_rate takes a field argument")
        if arg is not None and arg not in CONTRACT_FIELDS:
            raise CheckSyntaxError(f"line {no}: unknown field {arg!r}")
        checks.append(Check(line, m["sev"] or "error", metric, arg, m["op"], float(m["num"])))
    return checks


@dataclass(frozen=True)
class DQContext:
    """Everything the metrics need: the warehouse plus validation statistics."""

    con: duckdb.DuckDBPyConnection
    validation: dict[str, Any]
    duplicate_count: int
    as_of: datetime
    lateness_hours: int = 2


def _scalar(ctx: DQContext, sql: str) -> Any:
    row = ctx.con.execute(sql).fetchone()
    return row[0] if row else None


def _ratio(num: float, den: float) -> float:
    return num / den if den else 0.0


def compute_metric(ctx: DQContext, metric: str, arg: str | None) -> float:
    v = ctx.validation
    if metric == "row_count":
        return float(_scalar(ctx, "SELECT count(*) FROM ad_events"))
    if metric == "raw_count":
        return float(v["raw_count"])
    if metric == "quarantine_rate":
        return _ratio(v["quarantined_count"], v["raw_count"])
    if metric == "duplicate_rate":
        return _ratio(ctx.duplicate_count, v["valid_count"])
    if metric == "null_rate":
        assert arg is not None
        return _ratio(v["null_counts"][arg], v["object_count"])
    if metric == "late_rate":
        late = _scalar(
            ctx,
            f"SELECT count(*) FROM ad_events "
            f"WHERE ingested_at - occurred_at > INTERVAL {int(ctx.lateness_hours)} HOUR",
        )
        total = _scalar(ctx, "SELECT count(*) FROM ad_events")
        return _ratio(late, total)
    if metric == "freshness_hours":
        latest = _scalar(ctx, "SELECT max(occurred_at) FROM ad_events")
        if latest is None:
            return float("inf")
        return float((ctx.as_of - latest).total_seconds() / 3600)
    if metric == "schema_drift":
        return float(len(v["unknown_fields"]))
    raise CheckSyntaxError(f"unknown metric {metric!r}")  # pragma: no cover


def run_checks(ctx: DQContext, checks: list[Check]) -> list[CheckResult]:
    results = []
    for c in checks:
        value = compute_metric(ctx, c.metric, c.arg)
        results.append(CheckResult(c, value, _OPS[c.op](value, c.threshold)))
    return results


def gate_passed(results: list[CheckResult]) -> bool:
    """Only failed `error` checks block; `warn` failures are reported."""
    return all(r.passed or r.check.severity == "warn" for r in results)
