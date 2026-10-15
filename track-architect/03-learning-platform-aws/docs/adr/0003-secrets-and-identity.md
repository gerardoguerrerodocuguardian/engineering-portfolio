# ADR 0003: Secrets, runtime identity and end-user identity

Status: accepted

## Context
Credentials are the most common source of cloud incidents: long-lived keys in CI, passwords in state files, over-broad task roles.

## Decision
- **CI uses GitHub OIDC**, no stored AWS keys. Two roles: a read-only *plan* role (trusted for `pull_request` tokens) and an *apply* role (trusted only for a protected GitHub Environment) with a scoped policy supplied per stack.
- **Database password is never in Terraform**: RDS `manage_master_user_password` stores it in Secrets Manager, encrypted with a customer-managed KMS key.
- **ECS injects secrets at task start** from Secrets Manager. The *execution role* may read only the listed secret ARNs and decrypt only the listed keys; the *task role* (application code) has only item-level DynamoDB actions on its own table.
- **End users authenticate with Cognito** (Authorization Code + PKCE, no client secret for the SPA, optional TOTP MFA, groups for roles). The API verifies the JWT (issuer, audience/client id, expiry, signature via JWKS) and authorizes from the `cognito:groups` claim.

## Consequences
- Generated application secrets (random values) do reach Terraform state. State is in an encrypted, versioned, access-restricted bucket, and high-value secrets should use `generate = false` and be set out-of-band.
- The apply role is intentionally left without a broad policy; teams must write one scoped to the services in use. This costs effort up front and avoids an `AdministratorAccess` role reachable from CI.
- Automatic rotation (RDS secret rotation, Cognito token lifetimes) is configurable but only token lifetimes are set in this baseline.
