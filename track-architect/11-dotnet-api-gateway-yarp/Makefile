.PHONY: restore build test run-local stop-local certs up down smoke abuse

SLN := AdFlow.Gateway.sln

restore:
	dotnet restore $(SLN)

build: restore
	dotnet build $(SLN) -c Release --no-restore -warnaserror

test: build
	dotnet test $(SLN) -c Release --no-build

# One test step at a time (see docs/steps), e.g.:  make test-step STEP=04
test-step:
	dotnet test $(SLN) -c Release --filter "Step=$(STEP)"

# Compose-free demo: gateway + 2 campaign instances + reports on loopback ports (Development settings).
run-local:
	./scripts/run-local.sh start

stop-local:
	./scripts/run-local.sh stop

# Self-signed certificate for the compose HTTPS listener (git-ignored).
certs:
	./scripts/make-dev-cert.sh

up: certs
	docker compose up -d --build

down:
	docker compose down -v

smoke:
	./scripts/smoke.sh

abuse:
	./scripts/abuse-demo.sh
