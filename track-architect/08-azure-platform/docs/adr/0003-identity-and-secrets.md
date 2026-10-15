# ADR 0003: Managed identities, RBAC and federated CI; no secrets in config

Status: accepted

## Context
Config files, parameter files and pipelines must not contain credentials. Services need data-plane access to Service Bus, Key Vault, ACR, PostgreSQL and Application Insights.

## Decision
- **User-assigned managed identities**, created before the resources that grant them roles. Separate identity for the KEDA scaler (`Service Bus Data Owner` on the topic only, because reading depth needs management rights) versus the app (`Data Sender`/`Data Receiver` on topic/subscription, `Key Vault Secrets User`, `AcrPull`, `Monitoring Metrics Publisher`).
- **RBAC on Key Vault** (no access policies), purge protection on, public access off in prod.
- Local auth disabled: Service Bus SAS, Log Analytics and Application Insights keys, ACR admin user, PostgreSQL passwords.
- **Federated credentials** for CI (WIF service connection or GitHub OIDC) with per-environment subjects.
- Secrets that must exist (third-party API keys) live in Key Vault and are referenced by Container Apps via `keyVaultUrl` + identity, never in parameter files.

## Consequences
- Nothing to rotate for platform access; leaked repos expose no credentials.
- Role assignments can take minutes to propagate; first revision start may need a retry.
- User-assigned identities are shared between api and worker for simplicity; split per app if blast radius matters.
- The Container Apps environment still uses the Log Analytics shared key (ARM-handled, never output); Azure Monitor diagnostic settings are the keyless alternative.
- Whether `Data Receiver` suffices for the KEDA scaler is unverified here; Data Owner is the documented safe choice. Test and downgrade if possible.
