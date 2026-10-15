from pathlib import Path

import pytest

from archkit import c4
from archkit.config import ConfigError

from .conftest import write

TOML = """
[model]
title = "T"
[[person]]
id = "u"
name = "User"
[[system]]
id = "s"
name = "Sys \\"q\\""
[[system]]
id = "x"
name = "Ext"
external = true
[[container]]
id = "web"
system = "s"
name = "Web"
technology = "TS"
[[container]]
id = "api"
system = "s"
name = "Api"
[[relation]]
from = "u"
to = "web"
[[relation]]
from = "web"
to = "api"
description = "calls"
[[relation]]
from = "api"
to = "x"
description = "pulls"
technology = "HTTPS"
[[relation]]
from = "web"
to = "x"
description = "pulls"
technology = "HTTPS"
"""


def test_render_toml_and_check(tmp_path: Path) -> None:
    m = c4.load_model(write(tmp_path, "m.model.toml", TOML))
    assert m.slug == "m"
    files = c4.render(m)
    assert set(files) == {"m.context.mmd", "m.containers-s.mmd", "m.md"}
    ctx = files["m.context.mmd"]
    assert ctx.count("Rel(s, x") == 1  # lifted and de-duplicated
    assert "Rel(u, s," in ctx and "System_Ext(x" in ctx
    cont = files["m.containers-s.mmd"]
    assert "System_Boundary" in cont and "Rel(web, api" in cont
    out = tmp_path / "out"
    assert c4.check(files, out)[0].endswith("(run 'archkit c4 render')")
    assert c4.write(files, out) == sorted(files)
    assert c4.check(files, out) == []
    (out / "m.md").write_text("old")
    assert "stale" in c4.check(files, out)[0]


def test_yaml(tmp_path: Path) -> None:
    y = "model: {title: Y, slug: yy}\nsystem:\n  - {id: a, name: A}\n"
    files = c4.render(c4.load_model(write(tmp_path, "m.yaml", y)))
    assert "yy.md" in files and "yy.containers-a.mmd" not in files


@pytest.mark.parametrize(
    ("name", "text"),
    [
        ("m.json", "{}"),
        ("m.toml", "[["),
        ("m.yaml", "a: [\n"),
        ("m.yml", "- 1\n"),
        ("m.toml", '[[system]]\nid="1bad"\nname="x"\n'),
        ("m.toml", '[[system]]\nid="a"\nname="x"\n[[system]]\nid="a"\nname="y"\n'),
        ("m.toml", '[[container]]\nid="c"\nsystem="zz"\nname="x"\n'),
        ("m.toml", '[[system]]\nid="a"\nname="x"\n[[relation]]\nfrom="a"\nto="b"\n'),
        ("m.toml", "system = 3\n"),
    ],
)
def test_bad_models(tmp_path: Path, name: str, text: str) -> None:
    with pytest.raises(ConfigError):
        c4.load_model(write(tmp_path, name, text))


def test_missing_model(tmp_path: Path) -> None:
    with pytest.raises(ConfigError):
        c4.load_model(tmp_path / "none.toml")
