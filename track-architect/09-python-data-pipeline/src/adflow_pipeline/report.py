"""Render the run summary as Markdown and HTML from one section model."""

from __future__ import annotations

import html
from dataclasses import dataclass, field
from typing import Any

import polars as pl

Table = tuple[list[str], list[list[str]]]


@dataclass
class Section:
    title: str
    paragraphs: list[str] = field(default_factory=list)
    table: Table | None = None


def _fmt(v: Any) -> str:
    if v is None:
        return "-"
    if isinstance(v, float):
        return f"{v:.4f}"
    return str(v)


def _frame_table(df: pl.DataFrame, cols: list[str]) -> Table:
    return cols, [[_fmt(v) for v in row] for row in df.select(cols).iter_rows()]


def build_sections(summary: dict[str, Any], daily: pl.DataFrame) -> list[Section]:
    v, ld, fc = summary["validation"], summary["load"], summary["forecast"]
    sections = [
        Section(
            "Run summary",
            [
                f"Reference time (as of): {summary['asOf']}. Data quality gate: "
                f"**{'PASSED' if summary['dqPassed'] else 'FAILED'}**.",
                f"Raw rows {v['raw_count']}, valid {v['valid_count']}, quarantined "
                f"{v['quarantined_count']}. Loaded {ld['inserted']} new and {ld['updated']} "
                f"existing events ({ld['deduped_in_batch']} duplicates collapsed in the batch).",
            ],
        ),
        Section(
            "Late-arriving data",
            [
                f"Watermark: {ld['watermark']} (previous: {ld['previous_watermark']}). "
                f"Events inserted behind the previous watermark (restated windows): "
                f"{ld['restated']}. Aggregates are recomputed from the full table, so "
                "restated windows are corrected, not double-counted."
            ],
        ),
        Section(
            "Data quality checks",
            table=(
                ["check", "severity", "value", "result"],
                [
                    [c["expr"], c["severity"], _fmt(c["value"]), "pass" if c["passed"] else "FAIL"]
                    for c in summary["dq"]
                ],
            ),
        ),
    ]
    if not daily.is_empty():
        sections.append(
            Section(
                "Campaign performance by day",
                ["CTR = clicks / impressions. Spend in cents. Utilization = spend / daily budget."],
                _frame_table(
                    daily,
                    [
                        "campaign_id",
                        "day",
                        "impressions",
                        "clicks",
                        "ctr",
                        "spend_cents",
                        "budget_utilization",
                        "late_events",
                    ],
                ),
            )
        )
    if fc["status"] == "ok":
        skill = fc["skill"]
        paras = [
            f"Days used: {fc['days_used']}. Holdout MAE seasonal {_fmt(fc['mae_seasonal'])} vs "
            f"constant {_fmt(fc['mae_constant'])}; skill {_fmt(skill)}. "
            f"Interval half-width {_fmt(fc['interval_halfwidth'])}.",
            fc["note"],
        ]
        table: Table | None = (
            ["hour (UTC)", "CTR forecast", "low", "high"],
            [[str(h), _fmt(p), _fmt(lo), _fmt(hi)] for h, p, lo, hi in fc["next_day"]],
        )
    else:
        paras, table = [f"Forecast skipped: {fc['note']}"], None
    sections.append(Section("CTR baseline forecast (next day)", paras, table))
    return sections


def _md_table(table: Table) -> str:
    head, rows = table
    lines = ["| " + " | ".join(head) + " |", "|" + "|".join("---" for _ in head) + "|"]
    lines += ["| " + " | ".join(r) + " |" for r in rows]
    return "\n".join(lines)


def render_markdown(sections: list[Section]) -> str:
    out = ["# AdFlow pipeline report", "", "_Synthetic data. AdFlow is a fictional platform._", ""]
    for s in sections:
        out += [f"## {s.title}", ""]
        for p in s.paragraphs:
            out += [p, ""]
        if s.table:
            out += [_md_table(s.table), ""]
    return "\n".join(out)


def _bold(text: str) -> str:
    parts = html.escape(text).split("**")
    return "".join(f"<strong>{p}</strong>" if i % 2 else p for i, p in enumerate(parts))


def render_html(sections: list[Section]) -> str:
    body = [
        "<h1>AdFlow pipeline report</h1>",
        "<p><em>Synthetic data. Fictional platform.</em></p>",
    ]
    for s in sections:
        body.append(f"<h2>{html.escape(s.title)}</h2>")
        body += [f"<p>{_bold(p)}</p>" for p in s.paragraphs]
        if s.table:
            head, rows = s.table
            th = "".join(f"<th>{html.escape(h)}</th>" for h in head)
            trs = "".join(
                "<tr>" + "".join(f"<td>{html.escape(c)}</td>" for c in r) + "</tr>" for r in rows
            )
            body.append(f"<table><thead><tr>{th}</tr></thead><tbody>{trs}</tbody></table>")
    style = (
        "body{font:14px system-ui;max-width:960px;margin:2rem auto;padding:0 1rem}"
        "table{border-collapse:collapse;margin:1rem 0}"
        "td,th{border:1px solid #ccc;padding:.25rem .6rem;text-align:left}"
    )
    return (
        '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        f"<title>AdFlow pipeline report</title><style>{style}</style></head>"
        f"<body>{''.join(body)}</body></html>\n"
    )
