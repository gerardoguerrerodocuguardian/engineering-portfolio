"""README scoring against the sections every project README in a portfolio should have."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from archkit.common import glob_match, read_text, rel, walk_files
from archkit.config import Config, ConfigError

_HEADING = re.compile(r"^#{2,3}\s+(.+?)\s*$")


@dataclass(frozen=True)
class Check:
    name: str
    any_of: tuple[str, ...]  # heading prefixes / substrings (case-insensitive)
    required: bool = True


DEFAULT_CHECKS = (
    Check("purpose", ("what this is",)),
    Check("experience", ("experience this project reflects",)),
    Check("architecture", ("architecture", "context", "rendering", "testing strategy")),
    Check("run", ("how to run", "how to use", "how to test")),
    Check("tradeoffs", ("trade-off", "trade off", "not verified", "validated", "honest", "limits")),
)


@dataclass
class Score:
    path: str
    passed: list[str]
    missing: list[str]  # required and not waived
    waived: list[str]
    percent: int


def load_checks(cfg: Config) -> tuple[Check, ...]:
    raw = cfg.section("readme").get("check")
    if raw is None:
        return DEFAULT_CHECKS
    checks = []
    for c in raw:
        try:
            checks.append(
                Check(
                    str(c["name"]),
                    tuple(s.lower() for s in c["any_of"]),
                    bool(c.get("required", True)),
                )
            )
        except KeyError as exc:
            raise ConfigError(f"[[readme.check]] missing key {exc}") from exc
    return tuple(checks)


def headings(text: str) -> list[str]:
    out: list[str] = []
    fence = False
    for line in text.splitlines():
        if line.lstrip().startswith("```"):
            fence = not fence
        elif not fence:
            m = _HEADING.match(line)
            if m:
                out.append(m.group(1).lower())
    return out


def score_text(path: str, text: str, checks: tuple[Check, ...], waived: set[str]) -> Score:
    heads = headings(text)
    passed, missing, waived_hit = [], [], []
    for c in checks:
        if any(any(k in h for k in c.any_of) for h in heads):
            passed.append(c.name)
        elif c.name in waived:
            waived_hit.append(c.name)
        elif c.required:
            missing.append(c.name)
    total = len(checks) - len(waived_hit)
    percent = 100 if total <= 0 else round(100 * len(passed) / total)
    return Score(path, passed, missing, waived_hit, percent)


def find_readmes(cfg: Config) -> list[Path]:
    globs = cfg.section("readme").get("paths", ["track-*/*/README.md"])
    return [
        f
        for f in walk_files(cfg.root)
        if f.name == "README.md" and any(glob_match(rel(f, cfg.root), g) for g in globs)
    ]


def score_all(cfg: Config) -> list[Score]:
    checks = load_checks(cfg)
    waivers = cfg.section("readme").get("waive", [])
    scores = []
    for f in sorted(find_readmes(cfg)):
        rp = rel(f, cfg.root)
        waived = {n for w in waivers if glob_match(rp, str(w["path"])) for n in w.get("checks", [])}
        scores.append(score_text(rp, read_text(f), checks, waived))
    return scores
