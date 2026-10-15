from pathlib import Path

from archkit import adr
from archkit.config import Config

from .conftest import GOOD_ADR, write


def run(tmp_path: Path, data: dict[str, object] | None = None) -> list[str]:
    cfg = Config(root=tmp_path, data=data or {})
    findings, _ = adr.lint(cfg)
    return [f.render() for f in findings]


def test_clean(tmp_path: Path) -> None:
    write(tmp_path, "docs/adr/0001-a.md", GOOD_ADR.format(n=1))
    write(tmp_path, "docs/adr/0002-b.md", GOOD_ADR.format(n=2) + "[ok](0001-a.md#x) [w](http://x)")
    write(tmp_path, "docs/adr/README.md", "index")
    assert run(tmp_path) == []


def test_alt_status_formats(tmp_path: Path) -> None:
    write(
        tmp_path,
        "adr/0001-a.md",
        "# ADR 0001: T\n\n- Status: Accepted (note)\n\n## Context\n## Decision\n## Consequences\n",
    )
    write(
        tmp_path,
        "adr/0002-b.md",
        "# ADR 0002: T\n\n## Status\n\nProposed\n\n## Context\n## Decision\n## Consequences\n",
    )
    assert run(tmp_path) == []


def test_structure_problems(tmp_path: Path) -> None:
    write(tmp_path, "adr/0001-a.md", "# ADR 0002: T\n\nStatus: maybe\n\n## Context\n")
    write(tmp_path, "adr/0003-b.md", "no title\n```\n[x](missing.md)\n```\n[bad](nope.md)\n")
    write(tmp_path, "adr/0003-dup.md", GOOD_ADR.format(n=3))
    write(tmp_path, "adr/oops.md", "x")
    out = "\n".join(run(tmp_path))
    for expect in (
        "does not match file number",
        "status 'maybe'",
        "missing required section '## Decision'",
        "numbering gap",
        "missing title",
        "missing Status",
        "broken relative link: nope.md",
        "file name must match",
    ):
        assert expect in out
    assert "missing.md" not in out  # fenced code ignored


def test_duplicate_number(tmp_path: Path) -> None:
    write(tmp_path, "adr/0001-a.md", GOOD_ADR.format(n=1))
    write(tmp_path, "adr/0001-b.md", GOOD_ADR.format(n=1))
    assert any("duplicate ADR number" in line for line in run(tmp_path))


def test_supersedes_ok(tmp_path: Path) -> None:
    write(
        tmp_path,
        "adr/0001-a.md",
        GOOD_ADR.format(n=1).replace("accepted", "superseded by ADR 0002"),
    )
    write(
        tmp_path,
        "adr/0002-b.md",
        GOOD_ADR.format(n=2).replace("Status: accepted", "Status: accepted\nSupersedes: ADR 0001"),
    )
    assert run(tmp_path) == []


def test_supersedes_inconsistent(tmp_path: Path) -> None:
    write(tmp_path, "adr/0001-a.md", GOOD_ADR.format(n=1).replace("accepted", "superseded"))
    write(
        tmp_path,
        "adr/0002-b.md",
        GOOD_ADR.format(n=2).replace("Status: accepted", "Status: accepted\nSupersedes: 1, 9, 2"),
    )
    write(
        tmp_path,
        "adr/0003-c.md",
        GOOD_ADR.format(n=3).replace("Status: accepted", "Status: accepted\nSuperseded by: 7, 2"),
    )
    out = "\n".join(run(tmp_path))
    assert "no 'Superseded by' ADR" in out
    assert "does not declare 'Superseded by 2'" in out
    assert "supersedes unknown ADR 9" in out
    assert "supersedes itself" in out
    assert "superseded by unknown ADR 7" in out
    assert "does not declare 'Supersedes 3'" in out


def test_cycle(tmp_path: Path) -> None:
    for n, other in ((1, 2), (2, 1)):
        write(
            tmp_path,
            f"adr/000{n}-x.md",
            GOOD_ADR.format(n=n).replace(
                "Status: accepted", f"Status: accepted\nSupersedes: {other}\nSuperseded by: {other}"
            ),
        )
    assert any("cycle" in line for line in run(tmp_path))


def test_allowances_and_custom_settings(tmp_path: Path) -> None:
    write(tmp_path, "arch/decisions/0002-a.md", "# ADR 0002: T\n\nStatus: accepted\n\n## Context\n")
    data = {
        "adr": {
            "paths": ["arch/decisions"],
            "required_sections": ["Context", "Decision"],
            "allow": [
                {"path": "arch/**", "rules": ["numbering"], "sections": ["Decision"], "reason": "x"}
            ],
        }
    }
    assert run(tmp_path, data) == []
    findings, n = adr.lint(Config(tmp_path, data), only=[tmp_path / "arch/decisions"])
    assert n == 1 and findings == []
