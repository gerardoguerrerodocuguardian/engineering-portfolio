from pathlib import Path

import pytest

from archkit.config import Config


def write(root: Path, rel: str, text: str) -> Path:
    p = root / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")
    return p


@pytest.fixture
def cfg(tmp_path: Path) -> Config:
    return Config(root=tmp_path, data={})


GOOD_ADR = """# ADR {n:04d}: Title

Status: accepted

## Context
c
## Decision
d
## Consequences
e
"""
