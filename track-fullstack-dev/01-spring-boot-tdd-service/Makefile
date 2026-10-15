.PHONY: up down run test verify mutation format

up:        ## PostgreSQL for local runs
	docker compose up -d --wait

down:
	docker compose down -v

run:       ## start on :8080 (needs `make up`, a JWKS endpoint and a tax service; see README)
	mvn -B spring-boot:run -Dspring-boot.run.profiles=local

test:      ## unit + slice + integration + ArchUnit + format check + JaCoCo gate
	mvn -B verify

mutation:  ## PIT on the domain package, fails below the threshold
	mvn -B verify -Pmutation

format:
	mvn -B spotless:apply

verify: test
