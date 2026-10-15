.PHONY: test verify run tf-fmt tf-validate docker-build sql-render

test verify:   ## unit, contract and architecture tests (the emulator IT is skipped without Docker)
	mvn -B verify

run:           ## local run: in-memory source/sink, health on :8080
	mvn -B spring-boot:run

tf-fmt:        ## formatting check (works offline)
	cd terraform && tofu fmt -check -recursive

tf-validate:   ## needs provider download from the registry
	cd terraform && tofu init -backend=false && tofu validate

docker-build:
	docker build -t adflow-event-pipeline:local .

sql-render:    ## render SQL with PROJECT=... DATASET=...
	@for f in sql/*.sql; do sed -e 's/[$$]{project}/$(PROJECT)/g' -e 's/[$$]{dataset}/$(DATASET)/g' $$f; done
