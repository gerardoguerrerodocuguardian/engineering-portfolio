"""Deterministic synthetic event generator with injected duplicates, late and bad rows."""

from __future__ import annotations

import json
import math
import random
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from uuid import UUID

LATE_MIN_HOURS = 3.0
LATE_MAX_HOURS = 30.0


@dataclass(frozen=True)
class GeneratorConfig:
    seed: int = 42
    impressions: int = 20_000
    campaigns: int = 5
    days: int = 3
    start_date: date = date(2026, 9, 1)
    duplicate_rate: float = 0.03
    late_rate: float = 0.04
    malformed_rate: float = 0.02
    drift: bool = False


@dataclass(frozen=True)
class GeneratedBatch:
    lines: list[str]
    as_of: datetime
    config: GeneratorConfig


def _iso(dt: datetime) -> str:
    return dt.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def campaign_ids(n: int) -> list[str]:
    return [f"cmp-{i:03d}" for i in range(1, n + 1)]


def _hour_weight(hour: int) -> float:
    """Diurnal traffic curve, peak in the evening."""
    return 1.0 + 0.8 * math.sin((hour - 14) / 24 * 2 * math.pi)


def _malformed(rng: random.Random, good: dict[str, object]) -> str:
    kind = rng.randrange(8)
    bad = dict(good)
    if kind == 0:
        del bad["campaignId"]
    elif kind == 1:
        bad["costCents"] = -5
    elif kind == 2:
        bad["eventId"] = "not-a-uuid"
    elif kind == 3:
        bad["type"] = "VIEW"
    elif kind == 4:
        bad["costCents"] = "12"
    elif kind == 5:
        bad["occurredAt"] = "2026-09-01T10:00:00"  # no timezone
    elif kind == 6:
        return '{"eventId": "truncated'
    else:
        return "[1, 2, 3]"
    return json.dumps(bad, sort_keys=True)


def generate(cfg: GeneratorConfig) -> GeneratedBatch:
    """Produce JSONL lines in arrival order. Same config, same bytes."""
    rng = random.Random(cfg.seed)
    start = datetime(cfg.start_date.year, cfg.start_date.month, cfg.start_date.day, tzinfo=UTC)
    end = start + timedelta(days=cfg.days)
    as_of = end + timedelta(hours=1)
    camps = campaign_ids(cfg.campaigns)
    base_ctr = {c: 0.02 + 0.04 * rng.random() for c in camps}
    hours = [h for _ in range(cfg.days) for h in range(24)]
    weights = [_hour_weight(h) for h in hours]

    def new_id() -> str:
        return str(UUID(int=rng.getrandbits(128), version=4))

    rows: list[tuple[datetime, str]] = []

    def emit(
        etype: str, camp: str, cost: int, occurred: datetime
    ) -> tuple[dict[str, object], datetime]:
        delay = timedelta(seconds=rng.uniform(0, 30))
        if rng.random() < cfg.late_rate and occurred <= as_of - timedelta(hours=LATE_MIN_HOURS):
            cap = min(LATE_MAX_HOURS, (as_of - occurred).total_seconds() / 3600)
            delay = timedelta(hours=rng.uniform(LATE_MIN_HOURS, cap))
        ingested = min(occurred + delay, as_of)
        payload: dict[str, object] = {
            "eventId": new_id(),
            "type": etype,
            "campaignId": camp,
            "costCents": cost,
            "occurredAt": _iso(occurred),
            "ingestedAt": _iso(ingested),
        }
        if cfg.drift and rng.random() < 0.05:
            payload["userAgent"] = "synthetic/1.0"  # an upstream field the contract lacks
        return payload, ingested

    for _ in range(cfg.impressions):
        slot = rng.choices(range(len(hours)), weights=weights)[0]
        occurred = start + timedelta(hours=slot, seconds=rng.uniform(0, 3600))
        camp = rng.choice(camps)
        events = [("IMPRESSION", rng.randint(1, 6), occurred)]
        ctr = base_ctr[camp] * (0.7 + 0.6 * _hour_weight(hours[slot]) / 1.8)
        if rng.random() < ctr:
            events.append(
                ("CLICK", rng.randint(20, 80), occurred + timedelta(seconds=rng.randint(1, 90)))
            )
        for etype, cost, when in events:
            if when >= end:
                continue
            payload, ingested = emit(etype, camp, cost, when)
            line = json.dumps(payload, sort_keys=True)
            rows.append((ingested, line))
            if rng.random() < cfg.duplicate_rate:
                dup_at = min(ingested + timedelta(seconds=rng.uniform(1, 300)), as_of)
                dup = dict(payload, ingestedAt=_iso(dup_at))
                rows.append((dup_at, json.dumps(dup, sort_keys=True)))
            if rng.random() < cfg.malformed_rate:
                rows.append((ingested, _malformed(rng, payload)))

    rows.sort(key=lambda r: (r[0], r[1]))
    return GeneratedBatch([line for _, line in rows], as_of, cfg)


def write_batch(batch: GeneratedBatch, out_dir: Path) -> Path:
    raw = out_dir / "raw"
    raw.mkdir(parents=True, exist_ok=True)
    path = raw / "events.jsonl"
    path.write_text("\n".join(batch.lines) + "\n", encoding="utf-8")
    c = batch.config
    manifest = {
        "seed": c.seed,
        "impressions": c.impressions,
        "campaigns": c.campaigns,
        "days": c.days,
        "startDate": c.start_date.isoformat(),
        "asOf": _iso(batch.as_of),
        "driftInjected": c.drift,
        "lines": len(batch.lines),
    }
    (raw / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    return path
