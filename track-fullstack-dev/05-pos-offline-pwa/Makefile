.PHONY: install dev dev-server build lint typecheck test e2e e2e-install verify clean

install:
	npm ci || npm install

dev: ## web app on :5173 (run `make dev-server` in another terminal)
	npm run dev

dev-server: ## sync server on :8787
	npm run dev:server

build:
	npm run build

lint:
	npm run lint

typecheck:
	npm run typecheck

test: ## unit + server tests (fake-indexeddb, no browser)
	npm run test:ci

e2e-install: ## optional: download Playwright's Chromium
	npm run e2e:install

e2e: ## set PW_CHANNEL=chrome to use installed Google Chrome
	npm run e2e

verify: lint typecheck test build

clean:
	rm -rf dist dev-dist node_modules test-results
