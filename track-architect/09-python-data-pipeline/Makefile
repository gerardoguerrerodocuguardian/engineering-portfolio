PY ?= python3
OUT ?= out

.PHONY: install lint type test verify demo clean
install:
	$(PY) -m pip install -e ".[dev]"
lint:
	ruff check . && ruff format --check .
type:
	mypy
test:
	pytest
verify: lint type test
demo:
	adflow generate --out $(OUT) --seed 42
	adflow run --workdir $(OUT)
	adflow check --workdir $(OUT)
clean:
	rm -rf $(OUT) .pytest_cache .mypy_cache .ruff_cache .coverage htmlcov
