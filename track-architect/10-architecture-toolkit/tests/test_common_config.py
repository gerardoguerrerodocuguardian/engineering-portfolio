from pathlib import Path

import pytest

from archkit.common import Finding, glob_match, rel, walk_files
from archkit.config import ConfigError, load_config

from .conftest import write


def test_glob() -> None:
    assert glob_match("a/b/c.java", "**/*.java")
    assert glob_match("c.java", "**/*.java")
    assert glob_match("a/domain/x/Y.java", "a/domain/**")
    assert not glob_match("a/b/c.java", "*.java")
    assert glob_match("ab", "a?")
    assert glob_match("org/spring/x", "org/**")


def test_finding_render() -> None:
    assert Finding("a.md", "bad", "r", 3).render() == "a.md:3: bad [r]"
    assert Finding("a.md", "bad").render() == "a.md: bad"


def test_walk_skips_excluded(tmp_path: Path) -> None:
    write(tmp_path, "a/x.txt", "")
    write(tmp_path, "node_modules/y.txt", "")
    assert [rel(p, tmp_path) for p in walk_files(tmp_path)] == ["a/x.txt"]
    assert rel(Path("/elsewhere/file"), tmp_path) == "/elsewhere/file"


def test_config(tmp_path: Path) -> None:
    f = write(tmp_path, "sub/archkit.toml", 'root = ".."\n[adr]\npaths=["x"]\n')
    c = load_config(f)
    assert c.root == tmp_path.resolve()
    assert c.section("adr")["paths"] == ["x"]
    assert c.section("missing") == {}
    assert load_config(None).root == Path.cwd()
    with pytest.raises(ConfigError):
        load_config(tmp_path / "nope.toml")
    with pytest.raises(ConfigError):
        load_config(write(tmp_path, "bad.toml", "[[["))
    c.data["x"] = 1
    with pytest.raises(ConfigError):
        c.section("x")
