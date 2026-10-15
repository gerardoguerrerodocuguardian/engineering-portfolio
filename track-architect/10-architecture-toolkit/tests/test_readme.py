from pathlib import Path

import pytest

from archkit import readme
from archkit.config import Config, ConfigError

from .conftest import write

FULL = "## What this is\n## Experience this project reflects\n## Architecture\n## How to run\n## Trade-offs\n"


def test_score_text() -> None:
    s = readme.score_text("p", FULL, readme.DEFAULT_CHECKS, set())
    assert s.percent == 100 and not s.missing
    s = readme.score_text(
        "p", "```\n## What this is\n```\n## Architecture\n", readme.DEFAULT_CHECKS, set()
    )
    assert s.percent == 20 and "purpose" in s.missing
    s = readme.score_text("p", "## Architecture\n", readme.DEFAULT_CHECKS, {"purpose", "run"})
    assert s.waived == ["purpose", "run"] and s.missing == ["experience", "tradeoffs"]
    assert readme.score_text("p", "", (), set()).percent == 100


def test_score_all_with_waivers(tmp_path: Path) -> None:
    write(tmp_path, "t/a/README.md", FULL)
    write(tmp_path, "t/b/README.md", "## Architecture\n")
    write(tmp_path, "elsewhere/README.md", "")
    cfg = Config(
        tmp_path,
        {
            "readme": {
                "paths": ["t/*/README.md"],
                "waive": [{"path": "t/b/*", "checks": ["purpose"]}],
            }
        },
    )
    scores = readme.score_all(cfg)
    assert [s.path for s in scores] == ["t/a/README.md", "t/b/README.md"]
    assert scores[1].waived == ["purpose"]


def test_custom_checks(tmp_path: Path) -> None:
    cfg = Config(
        tmp_path, {"readme": {"check": [{"name": "x", "any_of": ["Foo"], "required": False}]}}
    )
    assert readme.load_checks(cfg)[0].any_of == ("foo",)
    with pytest.raises(ConfigError):
        readme.load_checks(Config(tmp_path, {"readme": {"check": [{"name": "x"}]}}))
