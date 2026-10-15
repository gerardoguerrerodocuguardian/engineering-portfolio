.PHONY: install dev-shell dev-campaigns dev-reports build serve test typecheck e2e e2e-install clean

install:
	npm ci || npm install

dev-shell: ## each app runs on its own: shell :5170, campaigns :5171, reports :5172
	npm run dev:shell

dev-campaigns:
	npm run dev:campaigns

dev-reports:
	npm run dev:reports

build: ## builds the three apps independently (each emits its own dist/)
	npm run build

serve: build ## three static origins, like three deployments
	npm run serve

test: ## Vitest unit tests
	npm test

typecheck:
	npm run typecheck

e2e-install:
	npm run e2e:install

e2e: build ## set PW_CHANNEL=chrome to use an installed Google Chrome
	npm run e2e

clean:
	rm -rf node_modules apps/*/dist test-results
