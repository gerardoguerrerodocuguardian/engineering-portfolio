# 10 · Architecture Toolkit (archkit)

A small Python CLI that turns architecture governance into CI checks. It is the "fitness function" layer of this repository: ADRs stay well-formed, layers stay clean, diagrams stay current, contracts do not drift, and project READMEs keep a common shape. The only runtime dependency is PyYAML.

## What this is

`archkit` has five commands. Every command exits non-zero on a problem, so each one drops straight into a pipeline.

| Command | What it checks |
|---|---|
| `archkit adr lint [dirs]` | Required sections (Context, Decision, Consequences), status vocabulary, `NNNN-title.md` naming, title/file number match, sequential numbering, no broken relative links, consistent `Supersedes` / `Superseded by` chains (including unknown targets, self-reference and cycles). |
| `archkit deps graph` / `deps check` | Scans Java (pom modules/dependencies, imports), Node (workspaces, declared deps, imports, relative imports) and Python (imports, pyproject) code, emits a Mermaid project graph, and enforces forbidden-dependency rules from `archkit.toml`. |
| `archkit c4 render MODEL --out DIR [--check]` | Renders a TOML or YAML model (people, systems, containers, relations) to Mermaid C4 context and container diagrams plus a Markdown document. `--check` fails if the committed output is stale. |
| `archkit contracts check` | Every `METHOD /path` in an OpenAPI file must exist in an implementation: another OpenAPI file, a plain route list, or NestJS controller decorators. Extras are reported; `--strict` makes them fail. |
| `archkit readme score` | Scores each project README against the required sections and applies per-path waivers. |

## Experience this project reflects

Over 23 years I have defined architecture standards and reviewed code for teams working across JEE, .NET, mobile and cloud platforms. The recurring lesson is that standards that live only in a wiki erode, so I turn them into checks:

- **Architecture decision records** with a fixed shape, so decisions stay findable and reviewable.
- **Fitness functions** (ArchUnit-style dependency rules) that run on every pull request instead of relying on reviewers to remember.
- **Governance with escape hatches**: every rule can be waived per path with a written reason, so exceptions are visible rather than silent.
- **Diagrams as build output**, so documentation cannot quietly disagree with the model.
- **Contract drift detection** between what is promised and what is implemented.

The domain (AdFlow) is invented. No employer, client or proprietary detail appears here.

## Architecture

```
src/archkit/
  cli.py        argparse entry point; maps findings to exit codes (0 ok, 1 findings, 2 usage/config)
  config.py     archkit.toml loader (repository root + per-check sections)
  common.py     Finding type, glob matching (**, *, ?), directory walking
  adr.py        ADR parser and rules
  deps.py       project discovery, import extraction, rule engine, Mermaid output
  c4.py         model loader and Mermaid C4 renderer
  contracts.py  OpenAPI / route-list / NestJS extraction and comparison
  readme.py     heading-based README scoring
```

Each check is a pure function from files to a list of `Finding`s; only `cli.py` prints and sets exit codes. Run them all against this repository:

```bash
make install   # editable install with dev tools
make check     # ruff, mypy --strict, pytest (>= 90 % coverage), then every command on this repo
```

Individual commands (run from this folder; `archkit.toml` points at the repository root):

```bash
archkit adr lint
archkit deps graph --out docs/deps-graph.md   # Mermaid graph of all projects
archkit deps check
archkit c4 render examples/adflow.model.toml --out docs/c4
archkit c4 render examples/adflow.model.toml --out docs/c4 --check
archkit contracts check
archkit readme score
```

The AdFlow model is [`examples/adflow.model.toml`](examples/adflow.model.toml); the generated diagrams are in [`docs/c4`](docs/c4/adflow.md). The project graph is in [`docs/deps-graph.md`](docs/deps-graph.md).

## Design rationale

- **Findings, not exceptions.** Checks return data. This keeps them unit-testable and lets the CLI choose output and exit codes.
- **Language-agnostic rules over parsers.** Real parsers for Java, TypeScript and Python would be heavy. The rule engine instead normalises every import to path-like strings (`io/adflow/bidding/adapters/...`, `../b/y`, `pkg/mod`) and matches them with globs. That is less precise than a full AST, but one rule syntax covers every language and it is fast enough for a monorepo.
- **Waivers are data.** `[[adr.allow]]` and `[[readme.waive]]` carry a `reason`, so a waiver is a reviewed line in git, not a disabled check.
- **Generated files are checked, not trusted.** `c4 render --check` compares byte for byte, the same idea as a lockfile check.
- **Contract direction matters.** The contract is the source of truth: missing operations are failures; extras (health checks, auth endpoints) are reported but allowed unless `--strict`.

## Configuring rules

`archkit.toml` in this folder is the live configuration. Forbidden-dependency rules are globs over the importing file and over the imported target:

```toml
[[deps.rule]]
name = "domain-is-framework-free"
from = "**/src/main/java/**/domain/**"          # importing files
to   = ["org/springframework/**", "jakarta/**"] # forbidden targets
message = "domain must not depend on frameworks"
```

A target string is the import normalised to slashes (Java `a.b.C` becomes `a/b/C`), or the resolved repository path for relative imports. ADR and README relaxations:

```toml
[[adr.allow]]
path = "track-architect/07-gcp-event-pipeline/docs/adr/0002-ports-and-adapters.md"
rules = ["sections"]            # or "numbering", "status", "links", "supersedes", "title"
reason = "why this is acceptable"

[[readme.waive]]
path = "track-architect/01-reference-architecture/README.md"
checks = ["purpose", "run"]
```

### How to add a rule

- **A dependency rule**: add a `[[deps.rule]]` block as above and run `archkit deps check`. Add a case to `tests/test_deps.py` that fails before the code is fixed.
- **A new ADR check**: add a function in `adr.py` that returns `Finding`s with a new `rule` id, call it from `_check_one` (per file) or `lint_directory` (per folder), and cover it in `tests/test_adr.py`. The rule id automatically becomes waivable through `[[adr.allow]]`.
- **A new README check**: add a `[[readme.check]]` (name, `any_of` heading fragments, `required`) to the config; no code needed.
- **A new contract source**: add a `load_*` function in `contracts.py` returning a set of `(METHOD, path)` pairs and a `--flag` plus config key in `cli.py`.

## How to run in CI

[`.github/workflows/architecture-toolkit.yml`](../../.github/workflows/architecture-toolkit.yml) installs from public PyPI, runs ruff, mypy and pytest, then runs the tool against this repository.

## Trade-offs

- Import extraction uses regular expressions, not parsers. It can miss exotic syntax (for example computed `require` paths) and can match imports inside comments.
- Project discovery trusts manifests (`pom.xml`, `package.json`, `pyproject.toml`, `setup.py`, `build.gradle`); nested projects are attributed to the deepest manifest.
- `contracts check` compares operations (method and path), not schemas. Schema-level diffing belongs to a dedicated tool.

## Not verified

Tested with Python 3.14 locally; CI uses Python 3.12 on `ubuntu-24.04`. Only the invented AdFlow repository was scanned. Behaviour on very large monorepos has not been measured.
