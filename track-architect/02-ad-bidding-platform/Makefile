.PHONY: up down run test verify

up:       ## start Kafka (KRaft) and Postgres
	docker compose up -d --wait

down:     ## stop and remove containers and volumes
	docker compose down -v

run:      ## run the service (requires `make up`)
	mvn -B spring-boot:run

test:     ## unit + architecture tests (integration test is skipped without Docker)
	mvn -B verify

verify: test
