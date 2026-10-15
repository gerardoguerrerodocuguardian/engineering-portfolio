"""Command line entry point."""

from __future__ import annotations

import argparse
import sys
from collections.abc import Sequence
from pathlib import Path

from archkit import __version__, adr, c4, contracts, deps, readme
from archkit.common import Finding
from archkit.config import Config, ConfigError, load_config


def _print_findings(findings: Sequence[Finding]) -> None:
    for f in findings:
        print(f.render())


def cmd_adr_lint(cfg: Config, args: argparse.Namespace) -> int:
    only = [Path(p) for p in args.paths] or None
    findings, n_dirs = adr.lint(cfg, only)
    _print_findings(findings)
    print(f"adr lint: {n_dirs} ADR folder(s), {len(findings)} problem(s)")
    return 1 if findings else 0


def cmd_deps_graph(cfg: Config, args: argparse.Namespace) -> int:
    result = deps.scan(cfg)
    mermaid = deps.to_mermaid(result, include_isolated=args.all)
    if args.out:
        Path(args.out).write_text("```mermaid\n" + mermaid + "```\n", encoding="utf-8")
        print(f"wrote {args.out}")
    else:
        print(mermaid, end="")
    findings = deps.violation_findings(result)
    _print_findings(findings)
    if args.check and findings:
        return 1
    return 0


def cmd_deps_check(cfg: Config, args: argparse.Namespace) -> int:
    result = deps.scan(cfg)
    findings = deps.violation_findings(result)
    _print_findings(findings)
    print(
        f"deps check: {len(result.projects)} project(s), {len(result.dependencies)} import(s), "
        f"{len(deps.parse_rules(cfg))} rule(s), {len(findings)} violation(s)"
    )
    return 1 if findings else 0


def cmd_c4_render(cfg: Config, args: argparse.Namespace) -> int:
    model = c4.load_model(Path(args.model))
    files = c4.render(model)
    out = Path(args.out)
    if args.check:
        problems = c4.check(files, out)
        for p in problems:
            print(f"{out}/{p}")
        print(f"c4 check: {len(files)} file(s), {len(problems)} stale or missing")
        return 1 if problems else 0
    names = c4.write(files, out)
    print(f"c4 render: wrote {len(names)} file(s) to {out}")
    return 0


def cmd_contracts_check(cfg: Config, args: argparse.Namespace) -> int:
    jobs: list[tuple[str, Path, set[contracts.Operation], set[contracts.Operation]]] = []
    ignore = contracts.parse_ignore(args.ignore)
    if args.spec:
        spec = Path(args.spec)
        if args.against:
            other = contracts.load_openapi(Path(args.against))
        elif args.routes:
            other = contracts.load_route_list(Path(args.routes))
        elif args.nest:
            other = contracts.load_nest_routes(Path(args.nest))
        else:
            raise ConfigError("give one of --against, --routes or --nest")
        jobs.append((spec.name, spec, contracts.load_openapi(spec), other))
    else:
        for pair in cfg.section("contracts").get("pair", []):
            spec = cfg.root / pair["spec"]
            if "nest" in pair:
                other = contracts.load_nest_routes(cfg.root / pair["nest"])
            elif "routes" in pair:
                other = contracts.load_route_list(cfg.root / pair["routes"])
            elif "openapi" in pair:
                other = contracts.load_openapi(cfg.root / pair["openapi"])
            else:
                raise ConfigError("[[contracts.pair]] needs nest, routes or openapi")
            ignore |= contracts.parse_ignore(list(pair.get("ignore", [])))
            jobs.append(
                (str(pair.get("name", spec.name)), spec, contracts.load_openapi(spec), other)
            )
        if not jobs:
            raise ConfigError("no contract pairs configured and no --spec given")
    status = 0
    for name, _spec, contract, other in jobs:
        report = contracts.compare(contract, other, ignore)
        for m, p in report.missing:
            print(f"{name}: MISSING in implementation: {m} {p}")
        for m, p in report.extra:
            print(f"{name}: EXTRA, not in contract: {m} {p}")
        ok = report.ok(args.strict)
        print(
            f"contracts check [{name}]: {report.checked} operation(s), "
            f"{len(report.missing)} missing, {len(report.extra)} extra -> {'OK' if ok else 'DRIFT'}"
        )
        if not ok:
            status = 1
    return status


def cmd_readme_score(cfg: Config, args: argparse.Namespace) -> int:
    scores = readme.score_all(cfg)
    minimum = args.min if args.min is not None else int(cfg.section("readme").get("min_score", 0))
    failed = 0
    for s in scores:
        bad = bool(s.missing) or s.percent < minimum
        failed += bad
        extra = f" missing: {', '.join(s.missing)}" if s.missing else ""
        waived = f" (waived: {', '.join(s.waived)})" if s.waived else ""
        print(f"{'FAIL' if bad else 'ok  '} {s.percent:3d}% {s.path}{extra}{waived}")
    avg = round(sum(s.percent for s in scores) / len(scores)) if scores else 0
    print(f"readme score: {len(scores)} README(s), average {avg}%, {failed} failing")
    return 1 if failed or not scores else 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="archkit", description="Architecture governance checks.")
    p.add_argument("--version", action="version", version=f"archkit {__version__}")
    p.add_argument("--config", type=Path, default=None, help="path to archkit.toml")
    groups = p.add_subparsers(dest="group", required=True)

    a = groups.add_parser("adr", help="ADR tooling").add_subparsers(dest="cmd", required=True)
    lint = a.add_parser("lint", help="validate ADR markdown files")
    lint.add_argument("paths", nargs="*", help="ADR folders (default: discover from config)")
    lint.set_defaults(func=cmd_adr_lint)

    d = groups.add_parser("deps", help="dependency graph and rules").add_subparsers(
        dest="cmd", required=True
    )
    g = d.add_parser("graph", help="emit a Mermaid project dependency graph")
    g.add_argument("--out", help="write a Markdown file with the mermaid block")
    g.add_argument("--all", action="store_true", help="include projects with no edges")
    g.add_argument("--check", action="store_true", help="exit 1 on rule violations")
    g.set_defaults(func=cmd_deps_graph)
    dc = d.add_parser("check", help="fail on forbidden dependencies")
    dc.set_defaults(func=cmd_deps_check)

    c = groups.add_parser("c4", help="C4 diagrams").add_subparsers(dest="cmd", required=True)
    r = c.add_parser("render", help="render a model to Mermaid C4 + Markdown")
    r.add_argument("model", help="model file (.toml, .yaml)")
    r.add_argument("--out", required=True, help="output directory")
    r.add_argument("--check", action="store_true", help="fail if committed output is stale")
    r.set_defaults(func=cmd_c4_render)

    k = groups.add_parser("contracts", help="contract drift").add_subparsers(
        dest="cmd", required=True
    )
    ck = k.add_parser("check", help="every operation in the spec must exist elsewhere")
    ck.add_argument("--spec", help="OpenAPI file (default: pairs in config)")
    ck.add_argument("--against", help="another OpenAPI file")
    ck.add_argument("--routes", help="text file with 'METHOD /path' lines")
    ck.add_argument("--nest", help="NestJS source directory")
    ck.add_argument("--ignore", action="append", default=[], help="'METHOD /path' allowed extra")
    ck.add_argument("--strict", action="store_true", help="extra operations also fail")
    ck.set_defaults(func=cmd_contracts_check)

    rd = groups.add_parser("readme", help="README quality").add_subparsers(
        dest="cmd", required=True
    )
    sc = rd.add_parser("score", help="score project READMEs")
    sc.add_argument("--min", type=int, default=None, help="minimum percent per README")
    sc.set_defaults(func=cmd_readme_score)
    return p


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        cfg_path = args.config
        if cfg_path is None and Path("archkit.toml").is_file():
            cfg_path = Path("archkit.toml")
        cfg = load_config(cfg_path)
        code: int = args.func(cfg, args)
        return code
    except ConfigError as exc:
        print(f"archkit: error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
