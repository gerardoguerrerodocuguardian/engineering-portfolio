# 06 - BDD Test Suite (AdFlow Campaign API)

## What this is

A standalone, black-box test-automation project for the Campaign API of **AdFlow**, a *fictional* ad platform
(all data synthetic, no real secrets). It lives next to the API it tests (`../02-nestjs-secure-api`) but knows only a base URL.

- **BDD with Cucumber.js**: Gherkin features in business language (auth/roles, create/list/update/delete, validation errors, report, contract), step definitions and a typed `ApiClient`.
- **Contract testing, provider side**: every `/v1` response of every scenario is validated with Ajv against `shared/contracts/campaign-api.openapi.yaml`.
- **Consumer-driven contract (Pact)**: the dashboard's expectations (`pact/dashboard.consumer.pact.test.ts`) generate `pacts/adflow-dashboard-adflow-campaign-api.json`; `pact/provider/verify.ts` verifies it against a running API.
- **Target anywhere**: `BASE_URL` (default `http://localhost:3000`); a launcher boots the API in memory for local/CI runs.
- HTML + JSON reports in `reports/`.

```
features/            *.feature + step_definitions + support (World, hooks)
src/                 config, typed API client, OpenAPI contract validator
pact/                consumer test + optional provider verification
launcher/            boots ../02-nestjs-secure-api with its in-memory repository
scripts/             run-against-local-api.ts (start API, run command, stop API)
docs/testing-strategy.md
```

## Experience this project reflects

- TDD/BDD as a core competency: tests written first as living specifications, readable by product, QA and developers.
- Quality gates in CI: typecheck, acceptance and contract suites block a merge; reports are published as artifacts.
- Working in Scrum teams: Gherkin scenarios as the shared artifact in refinement and acceptance criteria.
- Contract testing between Java (Spring Boot) / NestJS services and Angular / Next.js consumers, so teams can release independently without integration surprises.

## Testing strategy

See [docs/testing-strategy.md](docs/testing-strategy.md). In short: many unit tests, fewer integration tests, a thin contract layer
(OpenAPI conformance + Pact) and a small set of business-level BDD scenarios on top.

## How to run

Requires Node 20+ and the sibling project's dependencies (`make install` installs both).

```bash
make install
make test          # typecheck + BDD against a locally booted API + Pact consumer test
make test-local    # only the Cucumber suite (API booted in-memory on a free port)
make pact          # only the consumer pact -> pacts/*.json
make pact-verify   # optional provider verification against the in-memory API
make report        # open reports/cucumber-report.html (macOS)
```

Against an API that is already running (local, staging):

```bash
make test-remote BASE_URL=https://staging.example.test
```

Optional env vars: `ADMIN_USER`, `ADMIN_PASSWORD`, `ADVERTISER_USER`, `ADVERTISER_PASSWORD`, `CONTRACT_PATH`.
Defaults are the synthetic dev-issuer users of the sibling API.

**How the local API is started.** The sibling API has no env flag for in-memory persistence (`main.ts` always uses MongoDB),
and it must not be modified, so `launcher/start-api.ts` composes the same pieces (`AppModule.register('memory')` + `configureApp`)
and `NODE_PATH` points to the sibling's `node_modules` so a single copy of Nest is loaded. No Docker or MongoDB needed.

## Trade-offs

- **Launcher imports provider source.** It is the only coupling to `02`; it keeps the sibling untouched at the cost of ts-node type-checking Nest sources at startup (a few seconds). The tests themselves stay black box.
- **Token cache.** The dev issuer rate-limits `/auth/token` to 10/min, so tokens are obtained once per role per run.
- **Undocumented statuses.** The contract omits some real errors (e.g. 401 everywhere, 404 on DELETE). The hook validates those against the shared `Problem` schema instead of failing; the better fix is to extend the contract.
- **Report assertions are shallow.** The API has no ingestion endpoint, so only the empty report is asserted black-box.
- **Pact matchers over values.** Looser, so the provider can evolve; stricter checks stay in OpenAPI conformance.
- Pact consumer tests use `node:test` + `tsx` to avoid adding a second runner next to Cucumber.

## Not verified

- Run only against the in-memory repository: MongoDB persistence and the aggregation pipeline were not exercised by this suite.
- No Pact Broker, so `can-i-deploy`, webhooks and versioned pacts are documented, not run.
- `.github/workflows/bdd-test-suite.yml` at the repo root was not executed on a CI runner.
- `make test-remote` against a non-local host was only exercised against the local `make api` instance on :3000.
- Verified on Node v26.7.0 (Cucumber prints an "untested Node version" notice).
