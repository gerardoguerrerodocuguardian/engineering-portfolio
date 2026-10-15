from pathlib import Path

import pytest

from archkit import deps
from archkit.config import Config, ConfigError

from .conftest import write

RULES = {
    "deps": {
        "rule": [
            {
                "name": "domain-pure",
                "from": "**/domain/**",
                "to": ["org/springframework/**", "io/x/adapters/**"],
                "message": "no",
            }
        ]
    }
}


def make_repo(root: Path) -> None:
    write(
        root,
        "svc/pom.xml",
        "<project><artifactId>svc</artifactId><dependencies><dependency><artifactId>lib</artifactId></dependency></dependencies></project>",
    )
    write(
        root,
        "svc/src/main/java/io/x/domain/A.java",
        "package io.x.domain;\nimport org.springframework.stereotype.Component;\nimport io.y.lib.B;\nimport static io.y.lib.B.f;\nimport java.util.*;\n",
    )
    write(root, "svc/src/test/java/io/x/domain/T.java", "package io.x.domain.test;\n")
    write(
        root,
        "lib/pom.xml",
        "<project><modules><module>sub</module></modules><artifactId>lib</artifactId></project>",
    )
    write(root, "lib/src/main/java/io/y/lib/B.java", "package io.y.lib;\n")
    write(root, "lib/sub/pom.xml", "<project><artifactId>sub</artifactId></project>")
    write(
        root,
        "web/package.json",
        '{"name":"@x/web","dependencies":{"@x/ui":"1"},"workspaces":["packages/*"]}',
    )
    write(root, "web/packages/ui/package.json", '{"name":"@x/ui"}')
    write(
        root,
        "web/src/a.ts",
        "import { a } from '@x/ui/button';\nimport b from '../packages/ui/src/b';\nconst c = require('lodash');\n",
    )
    write(
        root,
        "py/pyproject.toml",
        '[project]\nname = "py-app"\ndependencies = ["pyyaml>=6", "lib-py"]\n',
    )
    write(root, "py/src/pyapp/__init__.py", "")
    write(
        root,
        "py/src/pyapp/m.py",
        "import os, sys as s\nfrom pyapp import x\nfrom . import y\nfrom ..z import q\nimport otherpkg.mod\n",
    )
    write(root, "other/pyproject.toml", '[project]\nname = "otherpkg"\n')
    write(root, "other/otherpkg/__init__.py", "")
    write(root, "broken/pom.xml", "<not xml")
    write(root, "broken2/package.json", "[1]")
    write(root, "broken3/package.json", "{bad")
    write(root, "broken4/pyproject.toml", "[[[")
    write(root, "plain/setup.py", "")
    write(root, "gradle/build.gradle", "")


def test_scan_and_rules(tmp_path: Path) -> None:
    make_repo(tmp_path)
    res = deps.scan(Config(tmp_path, RULES))
    assert {"svc", "lib", "web", "py", "other", "plain", "gradle"} <= set(res.projects)
    assert res.edges[("svc", "lib")] >= 2
    assert ("lib", "lib/sub") in res.edges
    assert ("web", "web/packages/ui") in res.edges
    assert ("py", "other") in res.edges
    msgs = [f.render() for f in deps.violation_findings(res)]
    assert any("org/springframework/stereotype/Component" in m for m in msgs)
    assert len(msgs) == 1
    mermaid = deps.to_mermaid(res)
    assert mermaid.startswith("flowchart LR")
    assert "plain" not in mermaid
    assert "plain" in deps.to_mermaid(res, include_isolated=True)


def test_violating_edge_is_styled(tmp_path: Path) -> None:
    make_repo(tmp_path)
    rules = {"deps": {"rule": [{"name": "r", "from": "svc/**", "to": "io/y/lib/**"}]}}
    res = deps.scan(Config(tmp_path, rules))
    assert "linkStyle" in deps.to_mermaid(res)
    assert deps.violation_findings(res)[0].rule == "deps:r"


def test_rule_config_errors(tmp_path: Path) -> None:
    with pytest.raises(ConfigError):
        deps.parse_rules(Config(tmp_path, {"deps": {"rule": [{"name": "x"}]}}))


def test_owner_of() -> None:
    projs = {".": deps.Project(".", "node", "r"), "a": deps.Project("a", "node", "a")}
    assert deps.owner_of("a/b.ts", projs) == "a"
    assert deps.owner_of("c/b.ts", projs) == "."
    assert deps.owner_of("c", {}) is None
