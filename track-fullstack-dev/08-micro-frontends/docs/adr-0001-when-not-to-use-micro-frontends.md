# ADR 0001 - When NOT to use micro-frontends

Status: accepted (for this demo; the decision rule is general)

## Context
This repository demonstrates micro-frontends (MFEs). A demo makes the pattern look free. It is not.

## Decision
Use MFEs only when **organisational** scaling is the problem, not when code structure is. Default to a modular monolith
(one repo, one build, enforced module boundaries, lazy routes).

## Do NOT use MFEs when
- **One team (or fewer than roughly 3 to 4 teams) owns the UI.** The coordination cost you remove does not exist yet.
- **Releases are not actually blocked.** If a monolith deploys daily without cross-team conflicts, independent deploys buy nothing.
- **You want "separation" or tidier code.** Lazy routes, Nx/Turborepo boundaries and lint rules give this for far less.
- **Screens share a lot of state or UX flow.** Every shared concern (auth, routing, design system, state) becomes a versioned contract and an event schema.
- **Performance and bundle size are tight.** Duplicated dependencies, extra network hops and waterfalls (manifest -> remoteEntry -> chunks) cost real milliseconds.
- **You lack platform capacity.** Someone must own the shell, the manifest, contract versioning, observability and the CI matrix.
- **Accessibility and consistency must be uniform.** Focus management, page titles and styling drift across independently built islands.

## Costs this demo already shows
- Version-skew policy for shared singletons (React), enforced by the manifest `requires` check.
- A contract package (events, auth) that becomes a public API: additive changes only.
- Failure isolation needs explicit work (error boundary, timeout, fallback UI, retry).
- Mixed technologies (React + Web Component) multiply tooling and test surface.

## When it is justified
Many teams, different release cadences, a legacy-to-new migration (strangler), or a white-label/partner surface.

## Consequences
The demo is intentionally small; treat it as a reference for mechanics, not as a recommendation to adopt the pattern.
