"""Polyglot dependency scanning, Mermaid graph output and forbidden-dependency rules."""

from __future__ import annotations

import json
import posixpath
import re
import tomllib
import xml.etree.ElementTree as ET
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

from archkit.common import (
    DEFAULT_EXCLUDES,
    Finding,
    any_glob,
    glob_match,
    read_text,
    rel,
    walk_files,
)
from archkit.config import Config, ConfigError

MARKERS = {
    "pom.xml": "java",
    "build.gradle": "java",
    "build.gradle.kts": "java",
    "package.json": "node",
    "pyproject.toml": "python",
    "setup.py": "python",
}
SOURCE_SUFFIX = {
    ".java": "java",
    ".kt": "java",
    ".ts": "node",
    ".tsx": "node",
    ".js": "node",
    ".jsx": "node",
    ".mjs": "node",
    ".py": "python",
}

_JAVA_IMPORT = re.compile(r"^\s*import\s+(?:static\s+)?([\w.]+?)(?:\.\*)?\s*;", re.MULTILINE)
_JAVA_PACKAGE = re.compile(r"^\s*package\s+([\w.]+)\s*;", re.MULTILINE)
_JS_IMPORT = re.compile(r"""(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"]([^'"\n]+)['"]""")
_PY_IMPORT = re.compile(r"^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w., ]+))", re.MULTILINE)


@dataclass
class Project:
    path: str  # repo-relative directory ("." for the root)
    kind: str
    name: str
    artifact: str = ""
    packages: set[str] = field(default_factory=set)
    declared: set[str] = field(default_factory=set)  # declared dependency names
    modules: set[str] = field(default_factory=set)  # child module / workspace dirs


@dataclass(frozen=True)
class Dependency:
    """One import statement, with every string a rule may want to match against."""

    source: str
    project: str
    target_project: str | None
    targets: tuple[str, ...]


@dataclass(frozen=True)
class Rule:
    name: str
    sources: tuple[str, ...]
    forbidden: tuple[str, ...]
    message: str = ""


@dataclass
class ScanResult:
    projects: dict[str, Project]
    dependencies: list[Dependency]
    edges: Counter[tuple[str, str]]
    violations: list[tuple[Dependency, Rule, str]]


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _read_pom(directory: Path) -> tuple[str, set[str], set[str]]:
    """Return (artifactId, module dirs, dependency 'groupId:artifactId' names)."""
    try:
        tree = ET.fromstring(read_text(directory / "pom.xml"))
    except ET.ParseError:
        return directory.name, set(), set()
    artifact = ""
    group = ""
    modules: set[str] = set()
    deps: set[str] = set()
    for child in tree:
        tag = _local(child.tag)
        if tag == "artifactId":
            artifact = (child.text or "").strip()
        elif tag == "groupId":
            group = (child.text or "").strip()
        elif tag == "modules":
            modules = {(m.text or "").strip() for m in child if (m.text or "").strip()}
        elif tag == "dependencies":
            for dep in child:
                parts = {_local(x.tag): (x.text or "").strip() for x in dep}
                deps.add(parts.get("artifactId", ""))
    _ = group
    return artifact or directory.name, modules, {d for d in deps if d}


def _read_package_json(directory: Path) -> tuple[str, set[str], set[str]]:
    try:
        data = json.loads(read_text(directory / "package.json"))
    except json.JSONDecodeError:
        return directory.name, set(), set()
    if not isinstance(data, dict):
        return directory.name, set(), set()
    deps: set[str] = set()
    for key in ("dependencies", "devDependencies", "peerDependencies"):
        section = data.get(key)
        if isinstance(section, dict):
            deps |= set(section)
    ws = data.get("workspaces", [])
    if isinstance(ws, dict):
        ws = ws.get("packages", [])
    globs = {str(w) for w in ws} if isinstance(ws, list) else set()
    return str(data.get("name", directory.name)), globs, deps


def _read_pyproject(directory: Path) -> tuple[str, set[str]]:
    try:
        data = tomllib.loads(read_text(directory / "pyproject.toml"))
    except tomllib.TOMLDecodeError:
        return directory.name, set()
    proj = data.get("project", {})
    name = str(proj.get("name", directory.name))
    deps = {
        re.split(r"[\s<>=!~;\[]", d, maxsplit=1)[0].lower() for d in proj.get("dependencies", [])
    }
    return name, {d for d in deps if d}


def discover_projects(root: Path, excludes: tuple[str, ...]) -> dict[str, Project]:
    projects: dict[str, Project] = {}
    for f in walk_files(root, excludes):
        kind = MARKERS.get(f.name)
        if kind is None:
            continue
        directory = f.parent
        key = rel(directory, root)
        if key == "":
            key = "."
        if key in projects and f.name not in ("pom.xml", "package.json"):
            continue  # first marker wins; pom/package.json are the most informative
        if f.name == "pom.xml":
            artifact, modules, deps = _read_pom(directory)
            projects[key] = Project(key, kind, artifact, artifact, declared=deps, modules=modules)
        elif f.name == "package.json":
            name, ws, deps = _read_package_json(directory)
            projects[key] = Project(key, kind, name, name, declared=deps, modules=ws)
        elif f.name == "pyproject.toml":
            name, deps = _read_pyproject(directory)
            projects[key] = Project(key, kind, name, name.lower().replace("-", "_"), declared=deps)
        elif key not in projects:
            projects[key] = Project(key, kind, directory.name, directory.name)
    return projects


def owner_of(path: str, projects: dict[str, Project]) -> str | None:
    """Return the deepest project directory containing ``path``."""
    best: str | None = None
    for key in projects:
        if (key == "." or path == key or path.startswith(key + "/")) and (
            best is None or best == "." or (key != "." and len(key) > len(best))
        ):
            best = key
    return best


def _imports(path: Path, lang: str) -> list[str]:
    text = read_text(path)
    if lang == "java":
        return _JAVA_IMPORT.findall(text)
    if lang == "node":
        return _JS_IMPORT.findall(text)
    found: list[str] = []
    for frm, plain in _PY_IMPORT.findall(text):
        if frm:
            found.append(frm)
        else:
            found.extend(p.strip().split(" as ")[0] for p in plain.split(",") if p.strip())
    return found


def _index_provided(
    root: Path, projects: dict[str, Project], files: list[tuple[Path, str]]
) -> None:
    """Record which Java packages / Python top-level modules each project provides."""
    for f, lang in files:
        owner = owner_of(rel(f, root), projects)
        if owner is None:
            continue
        proj = projects[owner]
        if lang == "java":
            m = _JAVA_PACKAGE.search(read_text(f))
            if m and "/src/test/" not in "/" + rel(f, root):
                proj.packages.add(m.group(1))
        elif lang == "python" and f.name == "__init__.py":
            parts = Path(rel(f.parent, root)).parts
            base = Path(owner).parts if owner != "." else ()
            local = parts[len(base) :]
            if local and local[0] == "src":
                local = local[1:]
            if len(local) == 1:
                proj.packages.add(local[0])


def _resolve(
    spec: str, lang: str, src_rel: str, root: Path, projects: dict[str, Project], self_proj: str
) -> tuple[str | None, tuple[str, ...]]:
    """Resolve an import to (target project, match strings)."""
    targets: list[str] = []
    target_project: str | None = None
    if lang == "java":
        targets.append(spec.replace(".", "/"))
        best = ""
        for key, proj in projects.items():
            for pkg in proj.packages:
                if (spec == pkg or spec.startswith(pkg + ".")) and len(pkg) > len(best):
                    best, target_project = pkg, key
        return target_project, tuple(targets)
    if lang == "node":
        if spec.startswith("."):
            resolved = posixpath.normpath(posixpath.join(posixpath.dirname(src_rel), spec))
            targets.append(resolved)
            target_project = owner_of(resolved, projects)
        else:
            targets.append(spec)
            for key, proj in projects.items():
                if proj.kind == "node" and (spec == proj.name or spec.startswith(proj.name + "/")):
                    target_project = key
        return target_project, tuple(targets)
    # python
    if spec.startswith("."):
        base = posixpath.dirname(src_rel)
        dots = len(spec) - len(spec.lstrip("."))
        for _ in range(dots - 1):
            base = posixpath.dirname(base)
        resolved = posixpath.normpath(posixpath.join(base, spec.lstrip(".").replace(".", "/")))
        targets.append(resolved)
        return owner_of(resolved, projects), tuple(targets)
    targets.append(spec.replace(".", "/"))
    top = spec.split(".", 1)[0]
    for key, proj in projects.items():
        if proj.kind == "python" and (top in proj.packages or top == proj.artifact):
            target_project = key
    return target_project, tuple(targets)


def parse_rules(cfg: Config) -> tuple[Rule, ...]:
    rules: list[Rule] = []
    for raw in cfg.section("deps").get("rule", []):
        try:
            frm = raw["from"]
            to = raw["to"]
            name = raw["name"]
        except KeyError as exc:
            raise ConfigError(f"[[deps.rule]] missing key {exc}") from exc
        rules.append(
            Rule(
                name=str(name),
                sources=(frm,) if isinstance(frm, str) else tuple(frm),
                forbidden=(to,) if isinstance(to, str) else tuple(to),
                message=str(raw.get("message", "")),
            )
        )
    return tuple(rules)


def scan(cfg: Config) -> ScanResult:
    root = cfg.root
    sec = cfg.section("deps")
    excludes = tuple(DEFAULT_EXCLUDES) + tuple(sec.get("exclude_dirs", ()))
    projects = discover_projects(root, excludes)
    files = [
        (f, SOURCE_SUFFIX[f.suffix])
        for f in walk_files(root, excludes)
        if f.suffix in SOURCE_SUFFIX
    ]
    _index_provided(root, projects, files)
    rules = parse_rules(cfg)
    deps: list[Dependency] = []
    edges: Counter[tuple[str, str]] = Counter()
    violations: list[tuple[Dependency, Rule, str]] = []
    for f, lang in files:
        src_rel = rel(f, root)
        owner = owner_of(src_rel, projects)
        if owner is None:
            continue
        for spec in _imports(f, lang):
            tproj, targets = _resolve(spec, lang, src_rel, root, projects, owner)
            dep = Dependency(src_rel, owner, tproj, targets)
            deps.append(dep)
            if tproj is not None and tproj != owner:
                edges[(owner, tproj)] += 1
            for rule in rules:
                if any_glob(src_rel, rule.sources):
                    hit = next((t for t in targets if any_glob(t, rule.forbidden)), None)
                    if hit is not None:
                        violations.append((dep, rule, hit))
    _add_declared_edges(projects, edges)
    return ScanResult(projects, deps, edges, violations)


def _add_declared_edges(projects: dict[str, Project], edges: Counter[tuple[str, str]]) -> None:
    """Add edges from build manifests: module/workspace membership and declared dependencies."""
    by_name = {p.artifact: k for k, p in projects.items() if p.artifact}
    for key, proj in projects.items():
        for mod in proj.modules:
            child = posixpath.normpath(posixpath.join(key, mod)) if key != "." else mod
            for other in projects:
                if glob_match(other, child) and other != key:
                    edges[(key, other)] += 1
        for dep in proj.declared:
            tgt = by_name.get(dep) or by_name.get(dep.replace("-", "_"))
            if tgt and tgt != key and (key, tgt) not in edges:
                edges[(key, tgt)] += 1


def violation_findings(result: ScanResult) -> list[Finding]:
    return sorted(
        Finding(
            dep.source,
            f"imports '{hit}' - {rule.message or 'forbidden dependency'}",
            f"deps:{rule.name}",
        )
        for dep, rule, hit in result.violations
    )


def _node_id(path: str) -> str:
    return "p_" + re.sub(r"[^A-Za-z0-9]", "_", path)


def to_mermaid(result: ScanResult, include_isolated: bool = False) -> str:
    """Render the project dependency graph. Violating edges are drawn dashed and red."""
    bad = {(d.project, d.target_project) for d, _, _ in result.violations if d.target_project}
    used = {a for a, _ in result.edges} | {b for _, b in result.edges}
    lines = ["flowchart LR"]
    for key in sorted(result.projects):
        if not include_isolated and key not in used:
            continue
        proj = result.projects[key]
        lines.append(f'  {_node_id(key)}["{key}<br/>{proj.kind}"]')
    link_styles: list[int] = []
    for idx, ((a, b), n) in enumerate(sorted(result.edges.items())):
        label = f"|{n}|" if n > 1 else ""
        lines.append(f"  {_node_id(a)} -->{label} {_node_id(b)}")
        if (a, b) in bad:
            link_styles.append(idx)
    for i in link_styles:
        lines.append(f"  linkStyle {i} stroke:#d33,stroke-width:2px,stroke-dasharray:4")
    return "\n".join(lines) + "\n"
