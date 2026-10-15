"""Pipeline wiring: the DAG, its tasks, and the shared run context."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import duckdb
import polars as pl

from . import dq, store, transform
from .dag import DAG, TaskRun
from .forecast import ForecastResult, forecast_ctr
from .report import build_sections, render_html, render_markdown
from .store import LoadResult
from .validate import ValidationReport, validate_lines, write_quarantine


@dataclass(frozen=True)
class Paths:
    workdir: Path

    @property
    def raw(self) -> Path:
        return self.workdir / "raw" / "events.jsonl"

    @property
    def manifest(self) -> Path:
        return self.workdir / "raw" / "manifest.json"

    @property
    def quarantine(self) -> Path:
        return self.workdir / "quarantine" / "rejected.jsonl"

    @property
    def warehouse(self) -> Path:
        return self.workdir / "warehouse.duckdb"

    @property
    def parquet(self) -> Path:
        return self.workdir / "parquet" / "ad_events"

    @property
    def summary(self) -> Path:
        return self.workdir / "report" / "summary.json"

    @property
    def report_md(self) -> Path:
        return self.workdir / "report" / "report.md"

    @property
    def report_html(self) -> Path:
        return self.workdir / "report" / "report.html"


@dataclass
class PipelineConfig:
    workdir: Path
    input_path: Path | None = None
    allowed_lateness_hours: int = 2
    checks_text: str = dq.DEFAULT_CHECKS
    as_of: datetime | None = None


@dataclass
class Context:
    config: PipelineConfig
    paths: Paths
    con: duckdb.DuckDBPyConnection
    as_of: datetime
    validation: ValidationReport = field(default_factory=ValidationReport)
    load: LoadResult | None = None
    partitions: list[str] = field(default_factory=list)
    hourly: pl.DataFrame = field(default_factory=pl.DataFrame)
    daily: pl.DataFrame = field(default_factory=pl.DataFrame)
    dq_results: list[dq.CheckResult] = field(default_factory=list)
    forecast: ForecastResult = field(default_factory=lambda: ForecastResult("insufficient_data"))
    summary: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class RunResult:
    tasks: list[TaskRun]
    summary: dict[str, Any]

    @property
    def ok(self) -> bool:
        return all(t.status == "success" for t in self.tasks) and bool(self.summary.get("dqPassed"))


def read_as_of(paths: Paths) -> datetime:
    """Reference time for freshness: the batch manifest (synthetic), else the wall clock."""
    if paths.manifest.exists():
        text = json.loads(paths.manifest.read_text())["asOf"]
        return datetime.fromisoformat(text.replace("Z", "+00:00")).replace(tzinfo=None)
    return datetime.utcnow()


def _lateness(ctx: Context) -> timedelta:
    return timedelta(hours=ctx.config.allowed_lateness_hours)


def t_validate(ctx: Context) -> None:
    src = ctx.config.input_path or ctx.paths.raw
    with src.open(encoding="utf-8") as fh:
        ctx.validation = validate_lines(fh)
    write_quarantine(ctx.validation.quarantined, ctx.paths.quarantine)


def t_load(ctx: Context) -> None:
    ctx.load = store.load_events(ctx.con, ctx.validation.valid, _lateness(ctx))


def t_export(ctx: Context) -> None:
    ctx.partitions = store.export_parquet(ctx.con, ctx.paths.parquet)


def t_transform(ctx: Context) -> None:
    ctx.hourly = transform.hourly_metrics(
        ctx.con, store.get_watermark(ctx.con), ctx.config.allowed_lateness_hours
    )
    ctx.daily = transform.daily_metrics(ctx.hourly)
    store.save_table(ctx.con, "hourly_campaign_metrics", ctx.hourly)
    store.save_table(ctx.con, "daily_campaign_metrics", ctx.daily)


def t_dq(ctx: Context) -> None:
    ctx.dq_results = evaluate_dq(
        ctx.con,
        ctx.validation.stats(),
        ctx.load.deduped_in_batch if ctx.load else 0,
        ctx.as_of,
        ctx.config.checks_text,
        ctx.config.allowed_lateness_hours,
    )


def evaluate_dq(
    con: duckdb.DuckDBPyConnection,
    validation: dict[str, Any],
    duplicate_count: int,
    as_of: datetime,
    checks_text: str,
    lateness_hours: int,
) -> list[dq.CheckResult]:
    ctx = dq.DQContext(con, validation, duplicate_count, as_of, lateness_hours)
    return dq.run_checks(ctx, dq.parse_checks(checks_text))


def t_forecast(ctx: Context) -> None:
    ctx.forecast = forecast_ctr(ctx.hourly)


def summarize(ctx: Context) -> dict[str, Any]:
    assert ctx.load is not None
    load = asdict(ctx.load)
    return {
        "asOf": ctx.as_of.isoformat(),
        "validation": ctx.validation.stats(),
        "load": load,
        "partitions": ctx.partitions,
        "dq": [
            {
                "expr": r.check.expr,
                "severity": r.check.severity,
                "value": r.value,
                "passed": r.passed,
            }
            for r in ctx.dq_results
        ],
        "dqPassed": dq.gate_passed(ctx.dq_results),
        "forecast": asdict(ctx.forecast),
    }


def write_reports(paths: Paths, summary: dict[str, Any], daily: pl.DataFrame) -> None:
    paths.summary.parent.mkdir(parents=True, exist_ok=True)
    paths.summary.write_text(json.dumps(summary, indent=2, default=str) + "\n")
    sections = build_sections(summary, daily)
    paths.report_md.write_text(render_markdown(sections), encoding="utf-8")
    paths.report_html.write_text(render_html(sections), encoding="utf-8")


def t_report(ctx: Context) -> None:
    ctx.summary = summarize(ctx)
    write_reports(ctx.paths, ctx.summary, ctx.daily)


def build_dag() -> DAG[Context]:
    dag: DAG[Context] = DAG("adflow_ad_events_batch")
    dag.add("validate", t_validate)
    dag.add("load", t_load, ("validate",))
    dag.add("export_parquet", t_export, ("load",))
    dag.add("transform", t_transform, ("load",))
    dag.add("dq_checks", t_dq, ("transform",))
    dag.add("forecast", t_forecast, ("transform",))
    dag.add("report", t_report, ("export_parquet", "dq_checks", "forecast"))
    return dag


def run_pipeline(config: PipelineConfig) -> RunResult:
    paths = Paths(config.workdir)
    con = store.connect(paths.warehouse)
    try:
        ctx = Context(config, paths, con, config.as_of or read_as_of(paths))
        runs = build_dag().run(ctx)
    finally:
        con.close()
    return RunResult(runs, ctx.summary)
