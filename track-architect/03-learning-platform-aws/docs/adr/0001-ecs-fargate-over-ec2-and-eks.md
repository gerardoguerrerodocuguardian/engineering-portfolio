# ADR 0001: ECS on Fargate for the API tier

Status: accepted

## Context
The API is a stateless containerised service with spiky, mostly daytime load (course launches, exam windows). A small team operates it. Options: EC2 Auto Scaling groups running containers or processes, ECS on EC2, ECS on Fargate, EKS.

## Decision
Run the API on **ECS Fargate** behind an ALB, scaled by target tracking on CPU and memory (min 3 tasks across 3 AZs in prod, min 1 in dev).

## Consequences
- No hosts to patch, no capacity provider tuning, per-task isolation, and the task/execution role split gives least privilege per service.
- Per-vCPU price is higher than well-packed EC2 at steady, high utilization. If baseline load becomes large and flat, move the same task definitions to ECS on EC2 (or Savings Plans on Fargate) without changing the module interface.
- EKS was rejected: Kubernetes features (CRDs, service mesh, multi-tenant scheduling) are not needed here and its operational cost is not justified.
- Tasks use ARM64 (Graviton) for price/performance; images must be built for `linux/arm64`.
- Plain EC2 Auto Scaling remains the right tool for workloads that need host access, GPUs or licensed agents; it is not used in this baseline.
