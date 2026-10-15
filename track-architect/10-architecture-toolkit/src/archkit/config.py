"""Configuration loading from ``archkit.toml``."""

from __future__ import annotations

import tomllib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


class ConfigError(Exception):
    """Raised for invalid configuration or model files."""


@dataclass
class Config:
    """Parsed ``archkit.toml``. ``root`` is the repository root all paths are relative to."""

    root: Path
    data: dict[str, Any] = field(default_factory=dict)

    def section(self, name: str) -> dict[str, Any]:
        value = self.data.get(name, {})
        if not isinstance(value, dict):
            raise ConfigError(f"[{name}] must be a table")
        return value


def load_config(path: Path | None) -> Config:
    """Load the config; with no file, use defaults and the current directory as root."""
    if path is None:
        return Config(root=Path.cwd())
    if not path.is_file():
        raise ConfigError(f"config file not found: {path}")
    try:
        data = tomllib.loads(path.read_text(encoding="utf-8"))
    except tomllib.TOMLDecodeError as exc:
        raise ConfigError(f"invalid TOML in {path}: {exc}") from exc
    root = (path.parent / str(data.get("root", "."))).resolve()
    return Config(root=root, data=data)
