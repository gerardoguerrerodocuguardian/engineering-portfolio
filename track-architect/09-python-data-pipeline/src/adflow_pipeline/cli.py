"""Typer CLI: generate, run, check, report."""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import Annotated

import polars as pl
import typer

from . import dq, store
from .generator import GeneratorConfig, generate, write_batch
from .pipeline import (
    Paths,
    PipelineConfig,
    evaluate_dq,
    read_as_of,
    run_pipeline,
    write_reports,
)

app = typer.Typer(add_completion=False, help="AdFlow ad-event batch pipeline (synthetic data).")

WorkDir = Annotated[Path, typer.Option("--workdir", help="Pipeline working directory.")]


def _read_checks(path: Path | None) -> str:
    return path.read_text(encoding="utf-8") if path else dq.DEFAULT_CHECKS


@app.command("generate")
def generate_cmd(
    out: Annotated[Path, typer.Option(help="Output directory.")] = Path("out"),
    seed: int = 42,
    impressions: int = 20_000,
    campaigns: int = 5,
    days: int = 3,
    start_date: Annotated[str, typer.Option(help="YYYY-MM-DD")] = "2026-09-01",
    malformed_rate: float = 0.02,
    late_rate: float = 0.04,
    duplicate_rate: float = 0.03,
    drift: Annotated[bool, typer.Option(help="Inject an unknown field.")] = False,
) -> None:
    """Write deterministic synthetic events (with duplicates, late and malformed rows)."""
    cfg = GeneratorConfig(
        seed, impressions, campaigns, days, date.fromisoformat(start_date),
        duplicate_rate, late_rate, malformed_rate, drift,
    )  # fmt: skip
    path = write_batch(generate(cfg), out)
    typer.echo(f"wrote {path}")


@app.command("run")
def run_cmd(
    workdir: WorkDir = Path("out"),
    input_path: Annotated[Path | None, typer.Option("--input", help="JSONL file.")] = None,
    checks: Annotated[Path | None, typer.Option(help="DQ check file.")] = None,
) -> None:
    """Run validate, load, export, transform, DQ, forecast and report."""
    result = run_pipeline(PipelineConfig(workdir, input_path, checks_text=_read_checks(checks)))
    for t in result.tasks:
        typer.echo(f"{t.name:<16}{t.status:<9}{t.seconds:6.2f}s {t.error or ''}")
    if result.summary:
        for c in result.summary["dq"]:
            typer.echo(
                f"  [{'ok' if c['passed'] else c['severity']}] {c['expr']} -> {c['value']:.4f}"
            )
    if not result.ok:
        typer.echo("pipeline FAILED (task error or data-quality gate)", err=True)
        raise typer.Exit(1)
    typer.echo(f"reports in {Paths(workdir).report_md.parent}")


@app.command("check")
def check_cmd(
    workdir: WorkDir = Path("out"),
    checks: Annotated[Path | None, typer.Option(help="DQ check file.")] = None,
) -> None:
    """Re-evaluate data-quality checks against the warehouse of the last run."""
    paths = Paths(workdir)
    summary = json.loads(paths.summary.read_text())
    con = store.connect(paths.warehouse)
    try:
        results = evaluate_dq(
            con,
            summary["validation"],
            summary["load"]["deduped_in_batch"],
            read_as_of(paths),
            _read_checks(checks),
            2,
        )
    finally:
        con.close()
    for r in results:
        typer.echo(f"[{'ok' if r.passed else r.check.severity}] {r.check.expr} -> {r.value:.4f}")
    if not dq.gate_passed(results):
        raise typer.Exit(1)


@app.command("report")
def report_cmd(workdir: WorkDir = Path("out")) -> None:
    """Re-render the Markdown and HTML report from the stored summary and warehouse."""
    paths = Paths(workdir)
    summary = json.loads(paths.summary.read_text())
    con = store.connect(paths.warehouse)
    try:
        daily: pl.DataFrame = store.read_table(con, "SELECT * FROM daily_campaign_metrics")
    finally:
        con.close()
    write_reports(paths, summary, daily)
    typer.echo(f"wrote {paths.report_md} and {paths.report_html}")
