# Use MVN to override, e.g.: make demo MVN="mvn -s /tmp/settings.xml"
MVN ?= mvn

.PHONY: build test demo clean

build:
	$(MVN) -q verify

test:
	$(MVN) -q test

demo:
	$(MVN) -q -DskipTests package
	./scripts/demo.sh

clean:
	$(MVN) -q clean
