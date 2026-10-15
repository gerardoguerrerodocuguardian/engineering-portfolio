.PHONY: install run test lint build seed up down

install:
	npm install

up:
	docker compose up -d

down:
	docker compose down

run: build
	npm run start

build:
	npm run build

seed:
	npm run seed

test:
	npm test
	npm run test:e2e

lint:
	npm run lint
