PY ?= python3
CFG = archkit.toml

.PHONY: install lint type test check run clean

install:
	$(PY) -m pip install -e ".[dev]"

lint:
	ruff check src tests

type:
	mypy src

test:
	pytest

# Run every archkit command against this repository.
run:
	archkit --config $(CFG) adr lint
	archkit --config $(CFG) readme score
	archkit --config $(CFG) deps check
	archkit --config $(CFG) c4 render examples/adflow.model.toml --out docs/c4 --check
	archkit --config $(CFG) contracts check

check: lint type test run

clean:
	rm -rf .pytest_cache .mypy_cache .ruff_cache .coverage build *.egg-info src/*.egg-info
