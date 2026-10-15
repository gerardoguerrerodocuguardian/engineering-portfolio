# ADR 0001: Azure Container Apps for the API and worker

Status: accepted

## Context
A stateless NestJS API and a queue-consuming worker with bursty load (campaign launches). Small team. Options: App Service for Containers, Container Apps, AKS, Azure Functions.

## Decision
Use **Container Apps** (workload-profile environment, Consumption profile, VNet-integrated). The API scales on HTTP concurrency; the worker scales 0..N with a KEDA `azure-servicebus` rule on subscription depth.

## Consequences
- No cluster upgrades or node pools; KEDA is built in; scale-to-zero for workers in dev.
- Less control than AKS (no custom CRDs, limited networking policy, no DaemonSets). If a service mesh or multi-tenant scheduling is needed, move to AKS; images and identities carry over.
- App Service is simpler for plain web apps but has no queue-driven scale-out. Functions fit small handlers, not long-lived consumers with batching.
- Consumption pricing is per vCPU-second; steady high load may be cheaper on dedicated workload profiles or AKS reservations.
- The environment subnet is delegated and cannot be shared; size it up front (/24 used here).
