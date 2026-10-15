.PHONY: install start mock build test e2e e2e-install bench bench-browser clean

install:
	npm ci || npm install

start: ## mock event server (:4310) + console (:4200)
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

bench: ## pure aggregator throughput in Node
	npm run bench

bench-browser: build ## needs: PW_CHANNEL=chrome and `npm run serve:dist` running in another shell
	npm run bench:browser

clean:
	rm -rf dist .angular node_modules test-results out-tsc
