# AdFlow Ads Reporting Service (Python / FastAPI)

## What this is

An async Python service for the (fictional) "AdFlow" ad platform: campaigns, usage events and an aggregated performance
report. It is the Python counterpart of the Java and TypeScript services in this repository and implements the
`GET /v1/campaigns/{id}/report` operation and the `Problem` schema from
[`shared/contracts/campaign-api.openapi.yaml`](../../shared/contracts/campaign-api.openapi.yaml).

- `POST/GET /v1/campaigns`, `GET /v1/campaigns/{id}`: create, paginated list (`page`, `pageSize`, `status`), read.
- `POST /v1/campaigns/{id}/usage`: stores a usage event, answers `202`, and a **background task** folds new events
  into the stored aggregate.
- `GET /v1/campaigns/{id}/report`: impressions, clicks, spend (integer cents) and CTR.
- `GET /v1/campaigns/{id}/report/stream`: **Server-Sent Events** with the live aggregate (`interval`, `maxEvents`).
- JWT bearer auth with scopes (`campaigns:read|write`, `usage:write`, `reports:read`), RFC 7807 `application/problem+json`
  for every error, JSON logs with request and trace ids, OpenAPI at `/docs` and `/openapi.json`.

All data is synthetic.

## Experience this project reflects

23 years building backend services, Python being one of several languages used in production. What carries over between
stacks is the discipline, not the syntax: thin transport layer, explicit service and persistence layers, errors as a
documented contract, pure and property-tested business math, strict typing, and a CI gate that fails on coverage drops.

## Architecture

```mermaid
flowchart LR
    C([Client + JWT]) --> MW[TelemetryMiddleware<br/>request id, traceparent, access log]
    MW --> R[routers: validation, scopes]
    R -->|Depends| S[services]
    S --> A[aggregation: pure Totals monoid]
    S --> P[repositories: SQLAlchemy 2.0 async]
    P --> DB[(SQLite dev/test<br/>PostgreSQL via asyncpg)]
    R -. BackgroundTasks .-> S
    R --> SSE[SSE stream]
```

`routers -> services -> repositories -> models`; routers never import the ORM, services return Pydantic schemas.
`aggregation.py` has no I/O. Usage events are folded into `report_aggregates` using a watermark (`last_event_id`),
so a refresh is incremental and idempotent.

## Trade-offs

| Decision | Why | Trade-off |
|---|---|---|
| Report reads a precomputed aggregate | Cheap reads, same data source for REST and SSE | Eventually consistent; a report may lag the newest event until the background task has run |
| `BackgroundTasks` rather than a queue | No extra infrastructure for a demo | Work is lost if the process dies mid-task; production would use a durable queue/outbox |
| SSE polls the aggregate row on an interval | Simple, proxy-friendly, no broker | Not push-based; one DB read per tick per client |
| HS256 shared secret | Self-contained tests and local runs | Production should validate RS256 tokens against a JWKS endpoint |
| SQLite for tests/dev, `create_all` on startup only for SQLite | Fast, hermetic tests | Dialect differences; PostgreSQL uses the Alembic migration (also tested on SQLite only) |
| Telemetry middleware is a stub | Request id and `traceparent` handling without an SDK dependency | No spans or metrics exported until an OpenTelemetry SDK is wired in |
| Money as integer cents, CTR as float | Matches the shared contract | CTR is derived, never stored |

## How to run

```bash
make install          # venv + dependencies (Python >= 3.11)
make migrate          # alembic upgrade head (DATABASE_URL, default SQLite file)
make run              # uvicorn on :8000, docs at /docs
docker build -t adflow-reporting-service .
```

Environment: `DATABASE_URL` (e.g. `postgresql+asyncpg://user:pass@host/db`, install the `postgres` extra),
`JWT_SECRET`, `JWT_ISSUER`, `LOG_LEVEL`. The built-in default secret is for local development only.

## How to test

```bash
make check    # ruff (lint + format), mypy --strict, pytest with a 90% coverage gate
```

| Kind | Tests |
|---|---|
| Property-based (Hypothesis) | `test_aggregation_properties.py`: sums, chunking equals whole, order independence, CTR bounds, associativity |
| API (httpx `AsyncClient` over ASGI) | `test_api.py`: CRUD, pagination, background aggregation, SSE, 401/403, problem+json |
| Contract | `test_openapi_contract.py`: generated OpenAPI contains `/v1/campaigns/{id}/report` from the shared spec and matches the `CampaignReport` fields |
| Migrations and misc | `test_misc.py`: Alembic upgrade/downgrade, settings, JSON logging, lifespan |

### Results of the last run

- ruff check and format: clean. `mypy --strict`: no issues (23 files).
- pytest: 31 passed, total coverage 98% (gate 90%), run on Python 3.14.

## Not verified

- Python 3.12 (the CI and Docker version) was not run locally; tests ran on 3.14. CI has not run yet.
- Docker image was not built; PostgreSQL / asyncpg was never exercised, only SQLite.
- No dependency lockfile is committed; versions are lower bounds in `pyproject.toml`.
- SSE was tested with a finite stream; long-lived client disconnect behavior was not load tested.

## What I would do next in production

- Durable queue or outbox for aggregation, PostgreSQL integration tests in CI (service container), JWKS-based token
  validation, real OpenTelemetry SDK and metrics, a lockfile with hash checking, rate limiting on the SSE endpoint.
