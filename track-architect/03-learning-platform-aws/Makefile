# Local developer entry points. None of these targets applies anything to AWS.
ENV ?= dev
ENVS := dev prod
TF  ?= terraform

.PHONY: help fmt fmt-check validate lint security plan check clean

help:
	@echo "make fmt         - terraform fmt -recursive"
	@echo "make fmt-check   - fail if formatting differs"
	@echo "make validate    - init -backend=false + validate for each env (no credentials needed)"
	@echo "make lint        - tflint (needs tflint installed)"
	@echo "make security    - checkov (needs checkov installed)"
	@echo "make plan ENV=dev - terraform plan (needs credentials + backend + tfvars)"
	@echo "make check       - fmt-check + validate + lint + security"

fmt:
	$(TF) fmt -recursive

fmt-check:
	$(TF) fmt -check -recursive -diff

validate:
	@for e in $(ENVS) backend; do \
	  d=envs/$$e; [ $$e = backend ] && d=backend; \
	  echo "== validate $$d"; \
	  $(TF) -chdir=$$d init -backend=false -input=false >/dev/null && \
	  $(TF) -chdir=$$d validate || exit 1; \
	done

lint:
	tflint --init
	@for d in envs/dev envs/prod backend $$(ls -d modules/*); do \
	  echo "== tflint $$d"; tflint --chdir=$$d || exit 1; \
	done

security:
	checkov --config-file .checkov.yaml

plan:
	$(TF) -chdir=envs/$(ENV) init -input=false
	$(TF) -chdir=envs/$(ENV) plan -input=false -var-file=terraform.tfvars -out=tfplan

check: fmt-check validate lint security

clean:
	find . -name .terraform -type d -prune -exec rm -rf {} +
	find . -name tfplan -delete
