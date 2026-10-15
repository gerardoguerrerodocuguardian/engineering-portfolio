# ADR 0001: One generic Helm chart for all HTTP services

Status: accepted

## Context
Spring Boot and NestJS services need the same Kubernetes hygiene: probes, limits, HPA, PDB, NetworkPolicy, hardened securityContext.
Per-service charts drift and security fixes must be repeated.

## Decision
Maintain a single `adflow-service` chart. Differences (port, probe paths, env, egress ports) live in per-service values files.

## Consequences
- Security baseline changes once, applies everywhere.
- The chart must stay small; services with truly different topology (StatefulSets, workers) need another chart.
- Values schema is a contract; add `values.schema.json` when more teams consume it.
