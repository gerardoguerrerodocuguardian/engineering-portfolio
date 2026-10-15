# BASE_URL defaults to http://localhost:3000. Override: make test-remote BASE_URL=https://staging.example.test
BASE_URL ?= http://localhost:3000
export BASE_URL

.PHONY: install typecheck test test-local test-remote pact pact-verify api report

install:
	npm install
	cd ../02-nestjs-secure-api && test -d node_modules || npm install

typecheck:
	npm run typecheck

## Boot the sibling API in-memory on a free port, run Cucumber, stop the API.
test-local:
	npm run test:e2e

## Run Cucumber against an API that is already running at BASE_URL.
test-remote:
	npm run test:bdd

## Consumer-driven contract test: writes pacts/*.json
pact:
	npm run test:pact

## Optional: verify the pact against the in-memory provider.
pact-verify:
	npx tsx scripts/run-against-local-api.ts npx tsx pact/provider/verify.ts

## Start only the API (in-memory) on :3000 for manual exploration.
api:
	NODE_PATH=../02-nestjs-secure-api/node_modules TS_NODE_PROJECT=../02-nestjs-secure-api/tsconfig.json npm run api:start

test: typecheck test-local pact

report:
	open reports/cucumber-report.html
