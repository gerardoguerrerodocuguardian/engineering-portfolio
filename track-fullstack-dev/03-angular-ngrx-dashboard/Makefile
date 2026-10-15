.PHONY: install start mock build test e2e e2e-install clean

install:
	npm ci || npm install

start: ## dashboard + mock API
	npm start

mock:
	npm run mock

build:
	npm run build

test: ## unit tests (no browser needed)
	npm run test:ci

e2e-install: ## optional: download Playwright's Chromium
	npm run e2e:install

e2e: ## set PW_CHANNEL=chrome to use an installed Google Chrome instead
	npm run e2e

clean:
	rm -rf dist .angular node_modules test-results
