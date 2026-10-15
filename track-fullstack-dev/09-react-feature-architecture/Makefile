.PHONY: install lint typecheck test build e2e verify gen-types analyze clean

install:
	npm ci

gen-types: ## regenerate API types from the shared OpenAPI contract
	npm run gen:types

lint: ## ESLint incl. the architecture boundaries rule
	npm run lint

typecheck:
	npm run typecheck

test: ## Vitest + RTL + MSW (includes the architecture-rule test)
	npm test

build: ## tsc + vite build + gzip performance budget
	npm run build

analyze: ## writes dist/stats.html (treemap)
	npm run analyze

e2e: ## Playwright against the MSW-backed dev server (PW_CHANNEL=chrome uses installed Chrome)
	npm run test:e2e

verify: lint typecheck test build e2e

clean:
	rm -rf dist playwright-report test-results
