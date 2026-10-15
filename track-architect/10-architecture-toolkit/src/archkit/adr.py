"""ADR linting: structure, status vocabulary, numbering, links and supersedes chains."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

from archkit.common import Finding, glob_match, read_text, rel
from archkit.config import Config

DEFAULT_STATUSES = ("proposed", "accepted", "rejected", "deprecated", "superseded")
DEFAULT_SECTIONS = ("Context", "Decision", "Consequences")

_FILE_RE = re.compile(r"^(\d+)-[a-z0-9][a-z0-9-]*\.md$")
_TITLE_RE = re.compile(r"^#\s+ADR\s+(\d+)\s*[:—-]\s*\S")
_STATUS_RE = re.compile(r"^[-*]?\s*\**status\**\s*:?\**\s*(.*)$", re.IGNORECASE)
_SUPERSEDES_RE = re.compile(r"^[-*]?\s*\**supersedes\**\s*:?\**\s*(.*)$", re.IGNORECASE)
_SUPERSEDED_BY_RE = re.compile(r"^[-*]?\s*\**superseded by\**\s*:?\**\s*(.*)$", re.IGNORECASE)
_STATUS_SUPERSEDED_BY = re.compile(r"superseded\s+by\s+(.*)", re.IGNORECASE)
_HEADING_RE = re.compile(r"^##\s+(.+?)\s*$")
_LINK_RE = re.compile(r"(?<!!)\[[^\]]*\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)")
_NUM_RE = re.compile(r"\d+")


@dataclass
class Allowance:
    """Per-path relaxations: skipped rules and sections that are optional."""

    path: str
    rules: tuple[str, ...] = ()
    sections: tuple[str, ...] = ()
    reason: str = ""


@dataclass
class AdrSettings:
    paths: tuple[str, ...] = ("**/adr", "**/adrs")
    statuses: tuple[str, ...] = DEFAULT_STATUSES
    required_sections: tuple[str, ...] = DEFAULT_SECTIONS
    allowances: tuple[Allowance, ...] = ()

    @classmethod
    def from_config(cls, cfg: Config) -> AdrSettings:
        sec = cfg.section("adr")
        allows = tuple(
            Allowance(
                path=str(a["path"]),
                rules=tuple(a.get("rules", ())),
                sections=tuple(a.get("sections", ())),
                reason=str(a.get("reason", "")),
            )
            for a in sec.get("allow", [])
        )
        d = cls()
        return cls(
            paths=tuple(sec.get("paths", d.paths)),
            statuses=tuple(s.lower() for s in sec.get("statuses", d.statuses)),
            required_sections=tuple(sec.get("required_sections", d.required_sections)),
            allowances=allows,
        )


@dataclass
class Adr:
    path: Path
    relpath: str
    number: int
    text: str
    title_number: int | None = None
    status_raw: str | None = None
    status_line: int = 0
    sections: set[str] = field(default_factory=set)
    supersedes: set[int] = field(default_factory=set)
    superseded_by: set[int] = field(default_factory=set)


def _numbers(value: str) -> set[int]:
    return {int(m) for m in _NUM_RE.findall(value)}


def parse_adr(path: Path, root: Path, number: int) -> Adr:
    text = read_text(path)
    adr = Adr(path=path, relpath=rel(path, root), number=number, text=text)
    in_fence = False
    in_status_section = False
    seen_first_section = False
    for lineno, line in enumerate(text.splitlines(), start=1):
        if line.lstrip().startswith("```"):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        m = _TITLE_RE.match(line)
        if m and adr.title_number is None:
            adr.title_number = int(m.group(1))
            continue
        h = _HEADING_RE.match(line)
        if h:
            seen_first_section = True
            name = h.group(1).strip()
            adr.sections.add(name.lower())
            in_status_section = name.lower() == "status"
            continue
        stripped = line.strip()
        if in_status_section and stripped and adr.status_raw is None:
            adr.status_raw = stripped.lstrip("-* ").strip()
            adr.status_line = lineno
            continue
        if seen_first_section and not in_status_section:
            continue
        sm = _SUPERSEDES_RE.match(stripped)
        if sm:
            adr.supersedes |= _numbers(sm.group(1))
            continue
        bm = _SUPERSEDED_BY_RE.match(stripped)
        if bm:
            adr.superseded_by |= _numbers(bm.group(1))
            continue
        st = _STATUS_RE.match(stripped)
        if st and adr.status_raw is None:
            adr.status_raw = st.group(1).strip().strip("*").strip()
            adr.status_line = lineno
    if adr.status_raw:
        sb = _STATUS_SUPERSEDED_BY.search(adr.status_raw)
        if sb:
            adr.superseded_by |= _numbers(sb.group(1))
    return adr


def _allowed(settings: AdrSettings, adr: Adr, rule: str) -> bool:
    return any(glob_match(adr.relpath, a.path) and rule in a.rules for a in settings.allowances)


def _optional_sections(settings: AdrSettings, adr: Adr) -> set[str]:
    out: set[str] = set()
    for a in settings.allowances:
        if glob_match(adr.relpath, a.path):
            out |= {s.lower() for s in a.sections}
    return out


def find_adr_dirs(cfg: Config, settings: AdrSettings) -> list[Path]:
    from archkit.common import walk_files

    dirs: set[Path] = set()
    for f in walk_files(cfg.root):
        if f.suffix != ".md":
            continue
        parent = rel(f.parent, cfg.root)
        if any(glob_match(parent, p) for p in settings.paths):
            dirs.add(f.parent)
    return sorted(dirs)


def _check_links(adr: Adr) -> list[Finding]:
    findings: list[Finding] = []
    in_fence = False
    for lineno, line in enumerate(adr.text.splitlines(), start=1):
        if line.lstrip().startswith("```"):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        for target in _LINK_RE.findall(line):
            if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", target) or target.startswith("#"):
                continue
            file_part = target.split("#", 1)[0]
            if not file_part:
                continue
            if not (adr.path.parent / file_part).exists():
                findings.append(
                    Finding(adr.relpath, f"broken relative link: {target}", "links", lineno)
                )
    return findings


def _check_one(adr: Adr, settings: AdrSettings) -> list[Finding]:
    out: list[Finding] = []
    if adr.title_number is None:
        out.append(Finding(adr.relpath, "missing title '# ADR NNNN: <title>'", "title"))
    elif adr.title_number != adr.number:
        out.append(
            Finding(
                adr.relpath,
                f"title number {adr.title_number} does not match file number {adr.number}",
                "title",
            )
        )
    optional = _optional_sections(settings, adr)
    for sec in settings.required_sections:
        if sec.lower() not in adr.sections and sec.lower() not in optional:
            out.append(Finding(adr.relpath, f"missing required section '## {sec}'", "sections"))
    if adr.status_raw is None:
        out.append(Finding(adr.relpath, "missing Status", "status"))
    else:
        words = adr.status_raw.split()
        word = words[0].lower().strip(".,:;()") if words else ""
        if word not in settings.statuses:
            out.append(
                Finding(
                    adr.relpath,
                    f"status '{word}' not in {list(settings.statuses)}",
                    "status",
                    adr.status_line,
                )
            )
        elif word == "superseded" and not adr.superseded_by:
            out.append(
                Finding(adr.relpath, "status superseded but no 'Superseded by' ADR", "supersedes")
            )
    out.extend(_check_links(adr))
    return out


def _check_chain(adrs: dict[int, Adr]) -> list[Finding]:
    out: list[Finding] = []
    for n, adr in adrs.items():
        for target in sorted(adr.supersedes):
            other = adrs.get(target)
            if target == n:
                out.append(Finding(adr.relpath, "ADR supersedes itself", "supersedes"))
            elif other is None:
                out.append(Finding(adr.relpath, f"supersedes unknown ADR {target}", "supersedes"))
            elif n not in other.superseded_by:
                out.append(
                    Finding(
                        adr.relpath,
                        f"supersedes ADR {target}, which does not declare 'Superseded by {n}'",
                        "supersedes",
                    )
                )
        for target in sorted(adr.superseded_by):
            other = adrs.get(target)
            if other is None:
                out.append(
                    Finding(adr.relpath, f"superseded by unknown ADR {target}", "supersedes")
                )
            elif n not in other.supersedes:
                out.append(
                    Finding(
                        adr.relpath,
                        f"superseded by ADR {target}, which does not declare 'Supersedes {n}'",
                        "supersedes",
                    )
                )
    out.extend(_find_cycles(adrs))
    return out


def _find_cycles(adrs: dict[int, Adr]) -> list[Finding]:
    out: list[Finding] = []
    for start, adr in adrs.items():
        seen = {start}
        frontier = [t for t in adr.supersedes if t != start]
        while frontier:
            cur = frontier.pop()
            if cur == start:
                out.append(Finding(adr.relpath, "supersedes chain contains a cycle", "supersedes"))
                break
            if cur in seen or cur not in adrs:
                continue
            seen.add(cur)
            frontier.extend(adrs[cur].supersedes)
    return out


def lint_directory(directory: Path, root: Path, settings: AdrSettings) -> list[Finding]:
    findings: list[Finding] = []
    adrs: dict[int, Adr] = {}
    for md in sorted(directory.glob("*.md")):
        if md.name.lower() in {"readme.md", "template.md", "index.md"}:
            continue
        m = _FILE_RE.match(md.name)
        if not m:
            findings.append(
                Finding(rel(md, root), "file name must match NNNN-kebab-title.md", "filename")
            )
            continue
        number = int(m.group(1))
        adr = parse_adr(md, root, number)
        if number in adrs:
            findings.append(Finding(adr.relpath, f"duplicate ADR number {number}", "numbering"))
            continue
        adrs[number] = adr
    expected = 1
    for number in sorted(adrs):
        if number != expected and not _allowed(settings, adrs[number], "numbering"):
            findings.append(
                Finding(
                    adrs[number].relpath,
                    f"numbering gap: expected {expected:04d}, found {number:04d}",
                    "numbering",
                )
            )
        expected = number + 1
    for adr in adrs.values():
        findings.extend(f for f in _check_one(adr, settings) if not _allowed(settings, adr, f.rule))
    chain = _check_chain(adrs)
    by_path = {a.relpath: a for a in adrs.values()}
    findings.extend(f for f in chain if not _allowed(settings, by_path[f.path], f.rule))
    return sorted(findings)


def lint(cfg: Config, only: list[Path] | None = None) -> tuple[list[Finding], int]:
    """Lint ADR directories. Returns (findings, number_of_directories_checked)."""
    settings = AdrSettings.from_config(cfg)
    dirs = [p.resolve() for p in only] if only else find_adr_dirs(cfg, settings)
    findings: list[Finding] = []
    for d in dirs:
        findings.extend(lint_directory(d, cfg.root, settings))
    return findings, len(dirs)
