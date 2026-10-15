"""Validation layer: raw JSONL lines in, valid events plus quarantined rows out."""

from __future__ import annotations

import json
from collections.abc import Iterable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from .models import CONTRACT_FIELDS, KNOWN_FIELDS, AdEvent


@dataclass(frozen=True)
class QuarantineRecord:
    line_no: int
    reason: str
    raw: str


@dataclass
class ValidationReport:
    raw_count: int = 0
    valid: list[AdEvent] = field(default_factory=list)
    quarantined: list[QuarantineRecord] = field(default_factory=list)
    unknown_fields: set[str] = field(default_factory=set)
    # Raw records that were JSON objects, and per-contract-field missing/null counts.
    object_count: int = 0
    null_counts: dict[str, int] = field(default_factory=lambda: dict.fromkeys(CONTRACT_FIELDS, 0))

    def stats(self) -> dict[str, Any]:
        return {
            "raw_count": self.raw_count,
            "valid_count": len(self.valid),
            "quarantined_count": len(self.quarantined),
            "object_count": self.object_count,
            "unknown_fields": sorted(self.unknown_fields),
            "null_counts": dict(self.null_counts),
        }


def _summarize(err: ValidationError) -> str:
    parts = [f"{'.'.join(str(p) for p in e['loc'])}: {e['msg']}" for e in err.errors()]
    return "; ".join(parts)


def validate_lines(lines: Iterable[str]) -> ValidationReport:
    """Validate every non-blank line; nothing is silently dropped."""
    report = ValidationReport()
    for line_no, line in enumerate(lines, start=1):
        text = line.strip()
        if not text:
            continue
        report.raw_count += 1
        try:
            payload = json.loads(text)
        except ValueError as exc:
            report.quarantined.append(QuarantineRecord(line_no, f"invalid JSON: {exc}", text))
            continue
        if not isinstance(payload, dict):
            report.quarantined.append(QuarantineRecord(line_no, "not a JSON object", text))
            continue
        report.object_count += 1
        report.unknown_fields.update(k for k in payload if k not in KNOWN_FIELDS)
        for name in CONTRACT_FIELDS:
            if payload.get(name) is None:
                report.null_counts[name] += 1
        try:
            report.valid.append(AdEvent.model_validate(payload))
        except ValidationError as exc:
            report.quarantined.append(QuarantineRecord(line_no, _summarize(exc), text))
    return report


def write_quarantine(records: Iterable[QuarantineRecord], path: Path) -> int:
    """Write the dead-letter file (JSONL), overwriting the previous batch. Returns row count."""
    path.parent.mkdir(parents=True, exist_ok=True)
    n = 0
    with path.open("w", encoding="utf-8") as fh:
        for rec in records:
            fh.write(
                json.dumps(
                    {"lineNo": rec.line_no, "reason": rec.reason, "raw": rec.raw}, sort_keys=True
                )
                + "\n"
            )
            n += 1
    return n
