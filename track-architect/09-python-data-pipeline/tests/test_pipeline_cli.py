from __future__ import annotations

import json
from pathlib import Path

import duckdb
import polars as pl
from typer.testing import CliRunner

from adflow_pipeline.cli import app
from adflow_pipeline.generator import GeneratorConfig, generate, write_batch
from adflow_pipeline.pipeline import PipelineConfig, run_pipeline

TABLES = ["ad_events", "hourly_campaign_metrics", "daily_campaign_metrics"]


def snapshot(workdir: Path) -> dict[str, pl.DataFrame]:
    con = duckdb.connect(str(workdir / "warehouse.duckdb"), read_only=True)
    try:
        return {t: con.execute(f"SELECT * FROM {t} ORDER BY ALL").pl() for t in TABLES}
    finally:
        con.close()


def test_pipeline_twice_is_idempotent(workdir: Path) -> None:
    r1 = run_pipeline(PipelineConfig(workdir))
    assert r1.ok, r1
    s1 = snapshot(workdir)
    r2 = run_pipeline(PipelineConfig(workdir))
    assert r2.ok
    s2 = snapshot(workdir)
    for t in TABLES:
        assert s1[t].equals(s2[t]), t
    assert r2.summary["load"]["inserted"] == 0
    assert r2.summary["load"]["restated"] == 0
    assert (workdir / "report" / "report.md").exists()
    assert (workdir / "quarantine" / "rejected.jsonl").read_text()
    assert any(p.startswith("day=") for p in r1.summary["partitions"])


def ev(i: int, t: str, at: str, ing: str) -> str:
    return json.dumps(
        {
            "eventId": f"00000000-0000-4000-8000-{i:012d}",
            "type": t,
            "campaignId": "cmp-001",
            "costCents": 10,
            "occurredAt": at,
            "ingestedAt": ing,
        }
    )


def test_late_batch_restates_earlier_windows(tmp_path: Path) -> None:
    main = tmp_path / "main.jsonl"
    late = tmp_path / "late.jsonl"
    main.write_text(
        "\n".join(
            ev(i, "IMPRESSION", f"2026-09-01T{h:02d}:05:00Z", f"2026-09-01T{h:02d}:06:00Z")
            for i, h in enumerate(range(0, 24), start=1)
        )
        + "\n"
    )
    late.write_text(ev(100, "CLICK", "2026-09-01T03:30:00Z", "2026-09-01T23:50:00Z") + "\n")
    cfg = {"checks_text": "error: row_count >= 1\nerror: freshness_hours <= 10000"}
    from datetime import datetime

    as_of = datetime(2026, 9, 2)
    run_pipeline(PipelineConfig(tmp_path, main, as_of=as_of, **cfg))  # type: ignore[arg-type]
    before = (
        snapshot(tmp_path)["hourly_campaign_metrics"]
        .filter(pl.col("hour_of_day") == 3)
        .row(0, named=True)
    )
    r = run_pipeline(PipelineConfig(tmp_path, late, as_of=as_of, **cfg))  # type: ignore[arg-type]
    after = (
        snapshot(tmp_path)["hourly_campaign_metrics"]
        .filter(pl.col("hour_of_day") == 3)
        .row(0, named=True)
    )
    assert before["clicks"] == 0 and after["clicks"] == 1
    assert after["late_events"] == 1 and after["is_final"]
    assert r.summary["load"]["restated"] == 1


def test_dq_failure_fails_run_but_still_reports(tmp_path: Path) -> None:
    cfg = GeneratorConfig(impressions=2000, malformed_rate=0.4)
    write_batch(generate(cfg), tmp_path)
    r = run_pipeline(PipelineConfig(tmp_path))
    assert not r.ok and r.summary["dqPassed"] is False
    failed = [c["expr"] for c in r.summary["dq"] if not c["passed"]]
    assert any("quarantine_rate" in f for f in failed)
    assert (tmp_path / "report" / "report.html").exists()


def test_task_failure_skips_downstream(tmp_path: Path) -> None:
    r = run_pipeline(PipelineConfig(tmp_path, tmp_path / "missing.jsonl"))
    status = {t.name: t.status for t in r.tasks}
    assert status["validate"] == "failed" and status["report"] == "skipped" and not r.ok


def test_cli_end_to_end(tmp_path: Path) -> None:
    runner = CliRunner()
    out = str(tmp_path)
    res = runner.invoke(
        app, ["generate", "--out", out, "--impressions", "3000", "--campaigns", "3"]
    )
    assert res.exit_code == 0, res.output
    res = runner.invoke(app, ["run", "--workdir", out])
    assert res.exit_code == 0, res.output
    assert runner.invoke(app, ["check", "--workdir", out]).exit_code == 0
    checks = tmp_path / "strict.dq"
    checks.write_text("error: row_count >= 99999999\n")
    bad = runner.invoke(app, ["check", "--workdir", out, "--checks", str(checks)])
    assert bad.exit_code == 1
    (tmp_path / "report" / "report.md").unlink()
    assert runner.invoke(app, ["report", "--workdir", out]).exit_code == 0
    md = (tmp_path / "report" / "report.md").read_text()
    assert "Data quality checks" in md and "CTR baseline forecast" in md
    html_text = (tmp_path / "report" / "report.html").read_text()
    assert "<table>" in html_text


def test_cli_run_fails_with_exit_1_on_dq_failure(tmp_path: Path) -> None:
    runner = CliRunner()
    runner.invoke(app, ["generate", "--out", str(tmp_path), "--impressions", "1500", "--drift"])
    res = runner.invoke(app, ["run", "--workdir", str(tmp_path)])
    assert res.exit_code == 1  # schema drift and/or row count gate
