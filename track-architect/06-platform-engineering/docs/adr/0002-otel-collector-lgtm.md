# ADR 0002: OpenTelemetry Collector in front of Prometheus, Loki and Tempo

Status: accepted

## Context
Services should not be coupled to a particular telemetry backend, and local development should mirror production topology.

## Decision
Applications emit OTLP to an OpenTelemetry Collector, which routes traces to Tempo, logs to Loki and metrics to Prometheus. Spring Boot metrics are additionally scraped directly via Micrometer.

## Consequences
- Backends can be swapped (managed services) by changing only collector config.
- One more component to run and size.
- Tempo chosen over Jaeger for object-storage-based retention and Grafana-native trace-to-log correlation.
