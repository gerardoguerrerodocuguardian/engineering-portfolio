.PHONY: obs-up obs-down lint template images validate
CHART=charts/adflow-service
HELM?=helm

obs-up:      ## start local observability stack
	docker compose -f observability/docker-compose.yml up -d
obs-down:
	docker compose -f observability/docker-compose.yml down -v
lint:        ## helm lint with both values files
	$(HELM) lint $(CHART) -f $(CHART)/values-ad-bidding.yaml
	$(HELM) lint $(CHART) -f $(CHART)/values-secure-api.yaml
template:    ## render manifests for both services
	$(HELM) template bidding $(CHART) -f $(CHART)/values-ad-bidding.yaml
	$(HELM) template secure-api $(CHART) -f $(CHART)/values-secure-api.yaml
validate:    ## validate compose file
	docker compose -f observability/docker-compose.yml config -q
images:      ## build hardened images (needs Docker)
	docker build -f docker/Dockerfile.spring-boot -t adflow/ad-bidding-platform:dev ../02-ad-bidding-platform
	docker build -f docker/Dockerfile.nestjs -t adflow/secure-api:dev ../../track-fullstack-dev/02-nestjs-secure-api
