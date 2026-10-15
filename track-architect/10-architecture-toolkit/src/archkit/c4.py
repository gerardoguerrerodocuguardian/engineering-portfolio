"""Render a small architecture model (TOML or YAML) to Mermaid C4 diagrams and Markdown."""

from __future__ import annotations

import re
import tomllib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from archkit.config import ConfigError

_ID_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_]*$")


@dataclass(frozen=True)
class Element:
    id: str
    kind: str  # person | system | container
    name: str
    description: str = ""
    technology: str = ""
    external: bool = False
    parent: str = ""  # owning system id for containers


@dataclass(frozen=True)
class Relation:
    source: str
    target: str
    description: str
    technology: str = ""


@dataclass
class Model:
    title: str
    slug: str
    elements: dict[str, Element] = field(default_factory=dict)
    relations: list[Relation] = field(default_factory=list)


def _as_list(data: dict[str, Any], key: str) -> list[dict[str, Any]]:
    value = data.get(key, [])
    if not isinstance(value, list) or not all(isinstance(v, dict) for v in value):
        raise ConfigError(f"'{key}' must be a list of tables/mappings")
    return value


def load_model(path: Path) -> Model:
    if not path.is_file():
        raise ConfigError(f"model file not found: {path}")
    text = path.read_text(encoding="utf-8")
    try:
        if path.suffix == ".toml":
            data = tomllib.loads(text)
        elif path.suffix in (".yaml", ".yml"):
            data = yaml.safe_load(text)
        else:
            raise ConfigError(f"unsupported model format: {path.suffix} (use .toml/.yaml)")
    except (tomllib.TOMLDecodeError, yaml.YAMLError) as exc:
        raise ConfigError(f"cannot parse {path}: {exc}") from exc
    if not isinstance(data, dict):
        raise ConfigError("model must be a mapping at the top level")
    return build_model(data, default_slug=path.name.split(".")[0])


def build_model(data: dict[str, Any], default_slug: str = "model") -> Model:
    meta = data.get("model", {})
    model = Model(
        title=str(meta.get("title", "Architecture")),
        slug=str(meta.get("slug", default_slug)),
    )

    def add(el: Element) -> None:
        if not _ID_RE.match(el.id):
            raise ConfigError(f"invalid id '{el.id}' (use letters, digits, underscore)")
        if el.id in model.elements:
            raise ConfigError(f"duplicate id '{el.id}'")
        model.elements[el.id] = el

    for p in _as_list(data, "person"):
        add(
            Element(
                str(p["id"]),
                "person",
                str(p["name"]),
                str(p.get("description", "")),
                external=bool(p.get("external", False)),
            )
        )
    for s in _as_list(data, "system"):
        add(
            Element(
                str(s["id"]),
                "system",
                str(s["name"]),
                str(s.get("description", "")),
                external=bool(s.get("external", False)),
            )
        )
    for c in _as_list(data, "container"):
        parent = str(c.get("system", ""))
        if parent not in model.elements or model.elements[parent].kind != "system":
            raise ConfigError(f"container '{c.get('id')}' references unknown system '{parent}'")
        add(
            Element(
                str(c["id"]),
                "container",
                str(c["name"]),
                str(c.get("description", "")),
                str(c.get("technology", "")),
                parent=parent,
            )
        )
    for r in _as_list(data, "relation"):
        src, dst = str(r["from"]), str(r["to"])
        for ref in (src, dst):
            if ref not in model.elements:
                raise ConfigError(f"relation references unknown element '{ref}'")
        model.relations.append(
            Relation(src, dst, str(r.get("description", "uses")), str(r.get("technology", "")))
        )
    return model


def _q(text: str) -> str:
    return '"' + text.replace('"', "'") + '"'


def _lift(model: Model, ref: str) -> str:
    el = model.elements[ref]
    return el.parent if el.kind == "container" else ref


def _decl(el: Element, container_diagram: bool = False) -> str:
    desc = _q(el.description)
    if el.kind == "person":
        return f"  Person({el.id}, {_q(el.name)}, {desc})"
    if el.kind == "container":
        return f"  Container({el.id}, {_q(el.name)}, {_q(el.technology)}, {desc})"
    fn = "System_Ext" if el.external else "System"
    return f"  {fn}({el.id}, {_q(el.name)}, {desc})"


def _rel(src: str, dst: str, r: Relation) -> str:
    tech = f", {_q(r.technology)}" if r.technology else ""
    return f"  Rel({src}, {dst}, {_q(r.description)}{tech})"


def context_diagram(model: Model) -> str:
    """System-context view: people and systems; container relations are lifted to systems."""
    lines = ["C4Context", f"  title {model.title} - System Context"]
    for el in model.elements.values():
        if el.kind != "container":
            lines.append(_decl(el))
    seen: set[tuple[str, str, str, str]] = set()
    for r in model.relations:
        a, b = _lift(model, r.source), _lift(model, r.target)
        key = (a, b, r.description, r.technology)
        if a == b or key in seen:
            continue
        seen.add(key)
        lines.append(_rel(a, b, r))
    return "\n".join(lines) + "\n"


def container_diagram(model: Model, system_id: str) -> str:
    """Container view for one system, with neighbours lifted to people/systems."""
    system = model.elements[system_id]
    inside = {e.id for e in model.elements.values() if e.parent == system_id}
    rels: list[tuple[str, str, Relation]] = []
    outside: list[str] = []
    for r in model.relations:
        a = r.source if r.source in inside else _lift(model, r.source)
        b = r.target if r.target in inside else _lift(model, r.target)
        if (a in inside or b in inside) and a != b:
            rels.append((a, b, r))
            for x in (a, b):
                if x not in inside and x not in outside:
                    outside.append(x)
    lines = ["C4Container", f"  title {model.title} - Containers of {system.name}"]
    for x in outside:
        lines.append(_decl(model.elements[x]))
    lines.append(f"  System_Boundary({system_id}_boundary, {_q(system.name)}) {{")
    for el in model.elements.values():
        if el.id in inside:
            lines.append("  " + _decl(el))
    lines.append("  }")
    seen: set[tuple[str, str, str, str]] = set()
    for a, b, r in rels:
        key = (a, b, r.description, r.technology)
        if key not in seen:
            seen.add(key)
            lines.append(_rel(a, b, r))
    return "\n".join(lines) + "\n"


def render(model: Model) -> dict[str, str]:
    """Return ``{relative file name: content}`` for every artifact of the model."""
    files: dict[str, str] = {}
    sections = [f"# {model.title}\n", "> Generated by `archkit c4 render`. Do not edit by hand.\n"]
    ctx = context_diagram(model)
    files[f"{model.slug}.context.mmd"] = ctx
    sections.append("## System context\n\n```mermaid\n" + ctx + "```\n")
    for el in model.elements.values():
        if el.kind == "system" and any(c.parent == el.id for c in model.elements.values()):
            diagram = container_diagram(model, el.id)
            files[f"{model.slug}.containers-{el.id}.mmd"] = diagram
            sections.append(f"## Containers: {el.name}\n\n```mermaid\n{diagram}```\n")
    rows = ["| Element | Kind | Technology | Description |", "|---|---|---|---|"]
    for el in model.elements.values():
        ext = " (external)" if el.external else ""
        rows.append(f"| {el.name} | {el.kind}{ext} | {el.technology} | {el.description} |")
    sections.append("## Elements\n\n" + "\n".join(rows) + "\n")
    rel_rows = ["| From | To | Description | Technology |", "|---|---|---|---|"]
    for r in model.relations:
        rel_rows.append(
            f"| {model.elements[r.source].name} | {model.elements[r.target].name} "
            f"| {r.description} | {r.technology} |"
        )
    sections.append("## Relations\n\n" + "\n".join(rel_rows) + "\n")
    files[f"{model.slug}.md"] = "\n".join(sections)
    return files


def write(files: dict[str, str], out: Path) -> list[str]:
    out.mkdir(parents=True, exist_ok=True)
    for name, content in files.items():
        (out / name).write_text(content, encoding="utf-8")
    return sorted(files)


def check(files: dict[str, str], out: Path) -> list[str]:
    """Return a list of problems (missing or stale files); empty means up to date."""
    problems: list[str] = []
    for name, content in sorted(files.items()):
        target = out / name
        if not target.is_file():
            problems.append(f"{name}: missing (run 'archkit c4 render')")
        elif target.read_text(encoding="utf-8") != content:
            problems.append(f"{name}: stale (model changed; re-run 'archkit c4 render')")
    return problems
