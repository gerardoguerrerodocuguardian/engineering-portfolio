from __future__ import annotations

import json
from pathlib import Path

from hypothesis import given
from hypothesis import strategies as st

from adflow_pipeline.generator import GeneratedBatch, GeneratorConfig, generate
from adflow_pipeline.validate import validate_lines, write_quarantine

GOOD = {
    "eventId": "3f2b8c1e-9a64-4d0e-8f43-0c1d2e3f4a5b",
    "type": "CLICK",
    "campaignId": "cmp-001",
    "costCents": 40,
    "occurredAt": "2026-09-01T10:00:00Z",
}


def _line(**over: object) -> str:
    return json.dumps({**GOOD, **over})


def test_valid_event_is_accepted() -> None:
    r = validate_lines([_line()])
    assert len(r.valid) == 1 and not r.quarantined
    assert r.valid[0].ingested_utc == r.valid[0].occurred_utc


def test_bad_rows_are_quarantined_with_reason() -> None:
    lines = [
        _line(costCents=-1),
        _line(costCents="12"),
        _line(type="VIEW"),
        _line(eventId="nope"),
        _line(occurredAt="2026-09-01T10:00:00"),
        '{"eventId": "x',
        "[1]",
        json.dumps({k: v for k, v in GOOD.items() if k != "campaignId"}),
        "",
    ]
    r = validate_lines(lines)
    assert r.raw_count == 8
    assert len(r.quarantined) == 8 and not r.valid
    assert r.null_counts["campaignId"] == 1
    assert "invalid JSON" in r.quarantined[5].reason


def test_unknown_fields_detected_as_drift() -> None:
    r = validate_lines([_line(userAgent="x")])
    assert r.unknown_fields == {"userAgent"} and len(r.valid) == 1


def test_write_quarantine(tmp_path: Path) -> None:
    r = validate_lines(["oops"])
    out = tmp_path / "q" / "rejected.jsonl"
    assert write_quarantine(r.quarantined, out) == 1
    assert json.loads(out.read_text())["raw"] == "oops"


def test_generator_is_deterministic_and_injects_faults(small_batch: GeneratedBatch) -> None:
    again = generate(small_batch.config)
    assert again.lines == small_batch.lines
    other = generate(GeneratorConfig(seed=8, impressions=3000, campaigns=3))
    assert other.lines != small_batch.lines
    r = validate_lines(small_batch.lines)
    assert r.quarantined, "malformed rows expected"
    ids = [str(e.event_id) for e in r.valid]
    assert len(ids) > len(set(ids)), "duplicates expected"
    late = [e for e in r.valid if (e.ingested_utc - e.occurred_utc).total_seconds() > 3 * 3600]
    assert late, "late events expected"


def test_drift_flag_injects_unknown_field() -> None:
    b = generate(GeneratorConfig(impressions=500, drift=True))
    assert "userAgent" in validate_lines(b.lines).unknown_fields


@given(st.lists(st.text(max_size=80), max_size=30))
def test_validate_never_raises_and_accounts_for_every_row(lines: list[str]) -> None:
    r = validate_lines(lines)
    assert r.raw_count == len(r.valid) + len(r.quarantined)
    assert r.raw_count == sum(1 for x in lines if x.strip())


@given(
    st.sampled_from(["IMPRESSION", "CLICK"]),
    st.integers(min_value=0, max_value=10**9),
    st.from_regex(r"[A-Za-z0-9_-]{1,20}", fullmatch=True),
)
def test_well_formed_events_always_validate(etype: str, cost: int, camp: str) -> None:
    r = validate_lines([_line(type=etype, costCents=cost, campaignId=camp)])
    assert len(r.valid) == 1 and not r.quarantined


@given(st.integers(max_value=-1))
def test_negative_cost_never_validates(cost: int) -> None:
    assert validate_lines([_line(costCents=cost)]).quarantined
