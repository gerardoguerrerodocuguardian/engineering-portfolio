.PHONY: install dev build start lint typecheck test e2e e2e-install types clean verify

install:
	npm ci || npm install

dev:
	npm run dev

build:
	npm run build

start: ## serve the production build
	npm run start

lint:
	npm run lint

typecheck:
	npm run typecheck

test: ## unit tests (no browser needed)
	npm run test:ci

types: ## regenerate contract types from shared/contracts
	npm run gen:types

e2e-install: ## optional: download Playwright's Chromium
	npm run e2e:install

e2e: ## set PW_CHANNEL=chrome to use an installed Google Chrome instead
	npm run e2e

verify: lint typecheck test build

clean:
	rm -rf .next node_modules test-results coverage
