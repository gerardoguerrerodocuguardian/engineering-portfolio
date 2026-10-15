"""Shared helpers: findings, glob matching, file walking."""

from __future__ import annotations

import re
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

DEFAULT_EXCLUDES = (
    "node_modules",
    "target",
    ".git",
    ".venv",
    "venv",
    "dist",
    "build",
    "__pycache__",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    ".angular",
    ".next",
    "coverage",
)


@dataclass(frozen=True, order=True)
class Finding:
    """A single problem reported by a check."""

    path: str
    message: str
    rule: str = ""
    line: int = 0

    def render(self) -> str:
        loc = f"{self.path}:{self.line}" if self.line else self.path
        tag = f" [{self.rule}]" if self.rule else ""
        return f"{loc}: {self.message}{tag}"


@lru_cache(maxsize=512)
def glob_to_regex(pattern: str) -> re.Pattern[str]:
    """Translate a path glob (supports ``**``, ``*``, ``?``) into a regex."""
    out: list[str] = []
    i = 0
    n = len(pattern)
    while i < n:
        c = pattern[i]
        if c == "*":
            if pattern.startswith("**", i):
                i += 2
                if pattern.startswith("/", i):
                    i += 1
                    out.append("(?:.*/)?")
                else:
                    out.append(".*")
                continue
            out.append("[^/]*")
        elif c == "?":
            out.append("[^/]")
        else:
            out.append(re.escape(c))
        i += 1
    return re.compile("^" + "".join(out) + "$")


def glob_match(path: str, pattern: str) -> bool:
    return glob_to_regex(pattern).match(path) is not None


def any_glob(path: str, patterns: Iterable[str]) -> bool:
    return any(glob_match(path, p) for p in patterns)


def walk_files(root: Path, excludes: Iterable[str] = DEFAULT_EXCLUDES) -> Iterator[Path]:
    """Yield files under ``root`` skipping excluded directory names."""
    skip = set(excludes)
    stack = [root]
    while stack:
        current = stack.pop()
        try:
            entries = sorted(current.iterdir())
        except OSError:  # pragma: no cover - unreadable directory
            continue
        for entry in entries:
            if entry.is_dir():
                if entry.name not in skip:
                    stack.append(entry)
            elif entry.is_file():
                yield entry


def rel(path: Path, root: Path) -> str:
    try:
        return path.resolve().relative_to(root.resolve()).as_posix()
    except ValueError:
        return path.as_posix()


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")
