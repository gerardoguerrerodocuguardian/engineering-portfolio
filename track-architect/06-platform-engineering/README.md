# AdFlow Platform Engineering

## What this is

Reusable platform building blocks for the (fictional) "AdFlow" services: a hardened generic Helm chart, a local observability stack, hardened Dockerfiles, a CI pipeline example and SLO/runbook docs. It targets the Spring Boot service in [`../02-ad-bidding-platform`](../02-ad-bidding-platform) and the NestJS service in [`../../track-fullstack-dev/02-nestjs-secure-api`](../../track-fullstack-dev/02-nestjs-secure-api). All data and hostnames are synthetic (`*.invalid`).

## Experience this project reflects

- Kubernetes and Docker adoption for backend teams, including EKS and GKE deployments.
- Terraform, Jenkins and GitHub Actions pipelines with SonarQube quality gates.
- Observability and autoscaling for high-traffic APIs.
- Splunk-style security auditing: central logs, searchable audit trails, alerting on anomalies.

## Architecture

See [`docs/architecture.md`](docs/architecture.md) for the Mermaid diagram (CI/CD flow, cluster objects, telemetry path).

- `charts/adflow-service`: Deployment (startup/readiness/liveness probes, resources), Service, HPA, PDB, NetworkPolicy, ServiceAccount, ConfigMap, optional Ingress and ServiceMonitor. Per-service overrides: `values-ad-bidding.yaml`, `values-secure-api.yaml`.
- `observability/`: docker-compose with Prometheus, Grafana (provisioned RED dashboard), Loki, Tempo, OpenTelemetry Collector; burn-rate and latency alert rules.
- `docker/`: `Dockerfile.spring-boot` (layered jar, distroless Java 21), `Dockerfile.nestjs` (distroless Node 20).
- `ci.yml.example`: build, test, SonarQube, Trivy, helm lint, kind deploy.
- `docs/`: SLOs and runbook, two ADRs, DevSecOps checklist.

## Security hardening choices

- Non-root user, `readOnlyRootFilesystem`, `allowPrivilegeEscalation: false`, all capabilities dropped, seccomp `RuntimeDefault`; writable `/tmp` via a size-limited emptyDir.
- Service account token not auto-mounted.
- NetworkPolicy restricts ingress to named namespaces and egress to DNS plus explicit ports.
- Secrets come only from a pre-existing Secret (`existingSecret`); none are in the chart.
- Distroless images, so no shell; `preStop` uses the native Kubernetes `sleep` action (Kubernetes 1.30+).
- CI fails on SonarQube quality gate and HIGH/CRITICAL Trivy findings.

## SLO approach

99.9% availability and 95% of requests under 300 ms over 30 days. Alerts use multi-window burn rates (14.4x and 6x) so pages track budget consumption rather than raw thresholds. Details in [`docs/slo-and-runbook.md`](docs/slo-and-runbook.md).

## How to use

```bash
make lint template          # needs helm
make obs-up                 # Grafana http://localhost:3001, Prometheus :9090
make images                 # needs Docker
helm install bidding charts/adflow-service -f charts/adflow-service/values-ad-bidding.yaml
```

Copy `ci.yml.example` to `.github/workflows/ci.yml` and set `SONAR_TOKEN` and `SONAR_HOST_URL`. Assumptions: the Spring Boot service exposes Actuator health and Prometheus endpoints; the NestJS sample exposes `/health` but not `/metrics`, so its ServiceMonitor is off by default. Alert and dashboard queries assume Micrometer metric names.

## What was and wasn't validated

Validated (run locally):
- `helm lint` passed for both values files (helm v4.3.0); `helm template` rendered both.
- `kubeconform` (k8s 1.30.0): all rendered resources valid; the ServiceMonitor CRD was skipped (no schema). Ingress rendering also checked.
- `docker compose config -q` passed on the observability compose file.
- All YAML configs parse (Ruby YAML) and the Grafana dashboard parses as JSON.

Not validated:
- No containers were started; Prometheus, Loki, Tempo, Collector and Grafana configs were never loaded by their own binaries. Alert rules were not checked with `promtool`.
- Dockerfiles were not built; the Spring Boot ENTRYPOINT jar path is a placeholder to adjust to the extracted layout.
- `ci.yml.example` was not run; nothing was deployed to a cluster (no `kubectl apply`).
- Dashboard panels were not rendered in Grafana.
