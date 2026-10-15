# Testing pyramid and strategy

```
            /\        Acceptance / BDD (this project)      few, slow, business-readable
           /  \       Contract tests (OpenAPI + Pact)      cheap, catch integration drift
          /----\      Integration / API tests (02 e2e)     supertest against the real Nest pipeline
         /      \     Unit tests (02 Jest)                 many, milliseconds, TDD loop
        /--------\
```

## What lives where

| Layer | Where | Question it answers |
| --- | --- | --- |
| Unit (TDD) | `02-nestjs-secure-api/src/**/*.spec.ts` | Does this class behave? Drives design, runs on every save. |
| Integration | `02-nestjs-secure-api/test` | Do guards, pipes, filters and persistence work together in-process? |
| Contract (provider side) | `features/contract.feature` + After hook | Does every real response match `shared/contracts/campaign-api.openapi.yaml`? |
| Contract (consumer-driven) | `pact/` | Does the provider still give the dashboard what it reads? |
| Acceptance (BDD) | `features/*.feature` | Does the deployed system deliver the agreed business behavior? |

## Principles

1. **Push checks down.** Edge cases (every validation rule, token claim, guard branch) belong in unit and
   integration tests. The BDD suite keeps one scenario per business rule and a few outline rows, not a combinatorial matrix.
2. **Gherkin is for people.** Features describe outcomes in domain language ("An advertiser cannot delete a campaign");
   HTTP details live in the typed client and step definitions. Product, QA and developers can review the same file in refinement.
3. **Black box.** The suite only knows a base URL and synthetic credentials, so it runs unchanged against local, CI
   and staging. It never imports provider code (the launcher is the single, isolated exception, used only to boot a local target).
4. **Every response is contract-checked.** An After hook validates every `/v1` response of every scenario against the
   OpenAPI schemas (Ajv). Undocumented error statuses fall back to the shared `Problem` schema, which makes contract gaps visible.
5. **Consumer-driven where consumers differ.** The OpenAPI file says what the provider offers; the Pact file says what a
   specific consumer relies on (typed matchers, no exact values). A field nobody consumes can change; one the dashboard reads cannot.
6. **Independent, self-cleaning scenarios.** Each scenario creates its own data and deletes it afterwards; tokens are cached per
   run because the dev issuer rate-limits logins.
7. **Quality gate.** In CI: typecheck, BDD, consumer pact on every PR; provider verification as a second job or on the provider
   pipeline (with a broker, `can-i-deploy` gates release). Reports (HTML/JSON) are uploaded as artifacts.

## Known limits

- Runs against the in-memory repository locally, so the Mongo aggregation pipeline is not exercised here (it is in the API's own e2e when a mongod is available).
- Report numbers are only asserted for an empty campaign: the public API has no way to ingest events, and a black-box suite should not reach into the datastore.
- Non-functional testing (load, security scanning) is out of scope.
