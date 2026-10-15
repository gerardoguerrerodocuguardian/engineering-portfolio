from pathlib import Path

import pytest

from archkit.cli import main

from .conftest import GOOD_ADR, write

HERE = Path(__file__).resolve().parent.parent
CFG = str(HERE / "archkit.toml")


def test_version(capsys: pytest.CaptureFixture[str]) -> None:
    with pytest.raises(SystemExit):
        main(["--version"])
    assert "archkit" in capsys.readouterr().out


def test_repo_adr_and_readme_and_deps_and_contracts(capsys: pytest.CaptureFixture[str]) -> None:
    """Dogfooding: every command passes against this repository (skipped outside it)."""
    if not (HERE.parent.parent / "shared/contracts").is_dir():
        pytest.skip("not inside the portfolio repository")
    assert main(["--config", CFG, "adr", "lint"]) == 0
    assert main(["--config", CFG, "readme", "score"]) == 0
    assert main(["--config", CFG, "deps", "check"]) == 0
    assert main(["--config", CFG, "deps", "graph", "--check"]) == 0
    assert main(["--config", CFG, "contracts", "check"]) == 0
    model = str(HERE / "examples/adflow.model.toml")
    assert main(["c4", "render", model, "--out", str(HERE / "docs/c4"), "--check"]) == 0
    capsys.readouterr()


def test_adr_lint_failure(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)
    write(tmp_path, "adr/0001-a.md", "# ADR 0001: T\n")
    assert main(["adr", "lint", str(tmp_path / "adr")]) == 1
    assert "missing" in capsys.readouterr().out


def test_deps_graph_out_and_violation(tmp_path: Path) -> None:
    write(tmp_path, "a/package.json", '{"name":"a"}')
    write(tmp_path, "b/package.json", '{"name":"b"}')
    write(tmp_path, "a/x.ts", "import '../b/y';")
    write(tmp_path, "b/y.ts", "")
    cfg = write(
        tmp_path,
        "archkit.toml",
        '[[deps.rule]]\nname="r"\nfrom="a/**"\nto="b/**"\nmessage="no"\n',
    )
    out = tmp_path / "g.md"
    assert main(["--config", str(cfg), "deps", "graph", "--out", str(out)]) == 0
    assert out.read_text().startswith("```mermaid")
    assert main(["--config", str(cfg), "deps", "graph", "--check", "--all"]) == 1
    assert main(["--config", str(cfg), "deps", "check"]) == 1


def test_c4_render_cycle(tmp_path: Path) -> None:
    model = write(tmp_path, "m.toml", '[[system]]\nid="a"\nname="A"\n')
    out = tmp_path / "o"
    assert main(["c4", "render", str(model), "--out", str(out), "--check"]) == 1
    assert main(["c4", "render", str(model), "--out", str(out)]) == 0
    assert main(["c4", "render", str(model), "--out", str(out), "--check"]) == 0


def test_contracts_variants(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    spec = write(tmp_path, "s.yaml", "paths:\n  /a:\n    get: {}\n  /b:\n    get: {}\n")
    other = write(tmp_path, "o.yaml", "paths:\n  /a:\n    get: {}\n  /c:\n    get: {}\n")
    routes = write(tmp_path, "r.txt", "GET /a\nGET /b\nGET /z\n")
    s = str(spec)
    assert main(["contracts", "check", "--spec", s, "--against", str(other)]) == 1
    assert "MISSING" in capsys.readouterr().out
    assert main(["contracts", "check", "--spec", s, "--routes", str(routes)]) == 0
    assert main(["contracts", "check", "--spec", s, "--routes", str(routes), "--strict"]) == 1
    args = ["contracts", "check", "--spec", s, "--routes", str(routes), "--strict"]
    assert main([*args, "--ignore", "GET /z"]) == 0
    write(tmp_path, "src/a.controller.ts", "@Controller('a')\nclass A { @Get() x() {} }")
    assert main(["contracts", "check", "--spec", s, "--nest", str(tmp_path / "src")]) == 1


def test_contracts_config_errors(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)
    spec = write(tmp_path, "s.yaml", "paths:\n  /a:\n    get: {}\n")
    assert main(["contracts", "check", "--spec", str(spec)]) == 2
    assert main(["contracts", "check"]) == 2
    write(tmp_path, "r.txt", "GET /a\n")
    nest = write(tmp_path, "n/a.controller.ts", "@Controller('a')\nclass A { @Get() x() {} }")
    cfg = write(
        tmp_path,
        "archkit.toml",
        'root = "."\n[[contracts.pair]]\nspec="s.yaml"\nroutes="r.txt"\nignore=["GET /q"]\n'
        '[[contracts.pair]]\nspec="s.yaml"\nopenapi="s.yaml"\n'
        f'[[contracts.pair]]\nspec="s.yaml"\nnest="{nest.parent.name}"\n',
    )
    assert main(["--config", str(cfg), "contracts", "check"]) == 0
    bad = write(tmp_path, "bad/archkit.toml", 'root = ".."\n[[contracts.pair]]\nspec="s.yaml"\n')
    assert main(["--config", str(bad), "contracts", "check"]) == 2
    assert "error" in capsys.readouterr().err


def test_readme_score_failure(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    write(tmp_path, "track-x/p/README.md", "## Architecture\n")
    cfg = write(tmp_path, "archkit.toml", "")
    assert main(["--config", str(cfg), "readme", "score"]) == 1
    assert "FAIL" in capsys.readouterr().out
    empty = write(tmp_path, "e/archkit.toml", 'root = "."\n')
    assert main(["--config", str(empty), "readme", "score", "--min", "10"]) == 1


def test_default_config_discovery(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    write(tmp_path, "archkit.toml", "")
    write(tmp_path, "adr/0001-a.md", GOOD_ADR.format(n=1))
    monkeypatch.chdir(tmp_path)
    assert main(["adr", "lint"]) == 0
    assert main(["--config", "missing.toml", "adr", "lint"]) == 2
