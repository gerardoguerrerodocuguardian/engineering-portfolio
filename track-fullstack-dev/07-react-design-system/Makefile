.PHONY: install dev tokens build lint typecheck test size storybook build-storybook verify clean

install:
	npm ci || npm install

dev: ## demo page (playground)
	npm run dev

tokens: ## regenerate src/styles/tokens.css from tokens/tokens.json
	npm run tokens

build:
	npm run build

lint:
	npm run lint

typecheck:
	npm run typecheck

test: ## unit + keyboard + axe tests
	npm run test:ci

size: ## bundle budget (needs build)
	npm run size

storybook: ## component docs + a11y panel on :6006
	npm run storybook

build-storybook:
	npm run build-storybook

verify: lint typecheck test build size

clean:
	rm -rf dist node_modules storybook-static playground-dist coverage
