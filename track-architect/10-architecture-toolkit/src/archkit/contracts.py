"""Contract drift detection between an OpenAPI file and another description of a service."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

import yaml

from archkit.common import read_text, walk_files
from archkit.config import ConfigError

HTTP_METHODS = ("get", "put", "post", "delete", "patch", "head", "options")
Operation = tuple[str, str]  # (METHOD, normalised path)

_PARAM_BRACES = re.compile(r"\{[^}/]+\}")
_PARAM_COLON = re.compile(r":[A-Za-z_]\w*")
_DECORATOR = re.compile(
    r"@(Get|Post|Put|Patch|Delete|Head|Options)\(\s*(?:['\"]([^'\"]*)['\"])?\s*\)"
)
_CONTROLLER = re.compile(r"@Controller\(\s*(?:['\"]([^'\"]*)['\"])?\s*\)")


def normalize_path(path: str) -> str:
    """Collapse parameter styles ({id}, :id) to ``{}`` and trim slashes."""
    p = _PARAM_COLON.sub("{}", _PARAM_BRACES.sub("{}", path.strip()))
    p = re.sub(r"/+", "/", "/" + p.strip("/"))
    return p


def load_openapi(path: Path) -> set[Operation]:
    if not path.is_file():
        raise ConfigError(f"OpenAPI file not found: {path}")
    try:
        doc = yaml.safe_load(read_text(path))
    except yaml.YAMLError as exc:
        raise ConfigError(f"cannot parse {path}: {exc}") from exc
    if not isinstance(doc, dict) or not isinstance(doc.get("paths"), dict):
        raise ConfigError(f"{path} has no 'paths' mapping")
    ops: set[Operation] = set()
    for p, item in doc["paths"].items():
        if not isinstance(item, dict):
            continue
        for method in item:
            if str(method).lower() in HTTP_METHODS:
                ops.add((str(method).upper(), normalize_path(str(p))))
    return ops


def load_route_list(path: Path) -> set[Operation]:
    """Plain list: one ``METHOD /path`` per line; ``#`` comments allowed."""
    if not path.is_file():
        raise ConfigError(f"route list not found: {path}")
    ops: set[Operation] = set()
    for lineno, raw in enumerate(read_text(path).splitlines(), start=1):
        line = raw.split("#", 1)[0].strip()
        if not line:
            continue
        parts = line.split()
        if len(parts) != 2 or parts[0].upper() not in {m.upper() for m in HTTP_METHODS}:
            raise ConfigError(f"{path}:{lineno}: expected 'METHOD /path', got '{raw.strip()}'")
        ops.add((parts[0].upper(), normalize_path(parts[1])))
    return ops


def load_nest_routes(directory: Path) -> set[Operation]:
    """Extract routes from NestJS ``@Controller``/``@Get`` style decorators."""
    if not directory.is_dir():
        raise ConfigError(f"source directory not found: {directory}")
    ops: set[Operation] = set()
    for f in walk_files(directory):
        if not f.name.endswith(".controller.ts"):
            continue
        text = read_text(f)
        ctrl = _CONTROLLER.search(text)
        prefix = ctrl.group(1) or "" if ctrl else ""
        for method, sub in _DECORATOR.findall(text):
            ops.add((method.upper(), normalize_path(f"{prefix}/{sub}")))
    return ops


@dataclass
class DriftReport:
    missing: list[Operation]  # in the contract, absent from the implementation
    extra: list[Operation]  # in the implementation, absent from the contract
    checked: int

    def ok(self, strict: bool) -> bool:
        return not self.missing and not (strict and self.extra)


def compare(contract: set[Operation], other: set[Operation], ignore: set[Operation]) -> DriftReport:
    return DriftReport(
        missing=sorted(contract - other),
        extra=sorted(other - contract - ignore),
        checked=len(contract),
    )


def parse_ignore(values: list[str]) -> set[Operation]:
    out: set[Operation] = set()
    for v in values:
        parts = v.split()
        if len(parts) != 2:
            raise ConfigError(f"ignore entry must be 'METHOD /path': {v!r}")
        out.add((parts[0].upper(), normalize_path(parts[1])))
    return out
