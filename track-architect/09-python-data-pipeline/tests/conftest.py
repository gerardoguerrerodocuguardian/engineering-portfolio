from __future__ import annotations

from datetime import date
from pathlib import Path

import pytest

from adflow_pipeline.generator import GeneratedBatch, GeneratorConfig, generate, write_batch


@pytest.fixture(scope="session")
def small_cfg() -> GeneratorConfig:
    return GeneratorConfig(
        seed=7, impressions=3000, campaigns=3, days=3, start_date=date(2026, 9, 1)
    )


@pytest.fixture(scope="session")
def small_batch(small_cfg: GeneratorConfig) -> GeneratedBatch:
    return generate(small_cfg)


@pytest.fixture
def workdir(tmp_path: Path, small_batch: GeneratedBatch) -> Path:
    write_batch(small_batch, tmp_path)
    return tmp_path
