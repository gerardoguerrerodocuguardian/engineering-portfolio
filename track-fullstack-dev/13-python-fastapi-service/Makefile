PY ?= python3.12
VENV ?= .venv
BIN := $(VENV)/bin

.PHONY: install lint format typecheck test check run migrate docker

install:
	$(PY) -m venv $(VENV)
	$(BIN)/pip install --index-url https://pypi.org/simple -e ".[dev]"

lint:
	$(BIN)/ruff check . && $(BIN)/ruff format --check .

format:
	$(BIN)/ruff format . && $(BIN)/ruff check --fix .

typecheck:
	$(BIN)/mypy

test:
	$(BIN)/pytest

check: lint typecheck test

migrate:
	$(BIN)/alembic upgrade head

run:
	$(BIN)/uvicorn app.main:app_factory --factory --reload

docker:
	docker build -t adflow-reporting-service .
