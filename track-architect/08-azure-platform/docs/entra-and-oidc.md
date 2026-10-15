# Entra ID: API token validation and CI federation

All identifiers below are placeholders. Bicep cannot reliably create app registrations (Microsoft Graph is a separate control plane), so these are one-time CLI/portal steps.

## 1. API app registration (what the NestJS API validates)

```bash
az ad app create --display-name adflow-api --sign-in-audience AzureADMyOrg \
  --identifier-uris api://<api-app-client-id>      # set after creation: az ad app update --id <id> --identifier-uris api://<id>
```

- In the manifest set `requestedAccessTokenVersion` (`api.requestedAccessTokenVersion`) to `2` so tokens are v2.0.
- Expose a scope (e.g. `access_as_user`) for interactive clients and define **app roles** (e.g. `Bids.Write`, `Reports.Read`) for service callers. Assign roles to client apps/groups in the enterprise application ("Assignment required" = yes).
- SPA/mobile clients: separate registrations using auth-code + PKCE, no client secret.
- Use the **audience** `api://<api-app-client-id>` as `entraApiAudience` in `params/*.bicepparam`.

## 2. NestJS validation (passport-jwt + JWKS)

```ts
// jwt.strategy.ts - validates signature via Entra JWKS, issuer, audience
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';

@Injectable()
export class EntraJwtStrategy extends PassportStrategy(Strategy, 'entra-jwt') {
  constructor() {
    const tenant = process.env.ENTRA_TENANT_ID!;
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      audience: process.env.ENTRA_AUDIENCE,                       // api://<client-id>
      issuer: `https://login.microsoftonline.com/${tenant}/v2.0`, // v2.0 tokens
      algorithms: ['RS256'],
      secretOrKeyProvider: passportJwtSecret({
        jwksUri: `https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`,
        cache: true, rateLimit: true, jwksRequestsPerMinute: 10,
      }),
    });
  }
  validate(payload: any) {
    // roles: app roles ('roles' claim); scp: delegated scopes (space separated)
    return { sub: payload.sub, oid: payload.oid, roles: payload.roles ?? [], scopes: (payload.scp ?? '').split(' ') };
  }
}
```

Pitfalls: never accept tokens from other tenants (single-tenant issuer pin; multi-tenant needs per-tenant issuer checks on the `tid` claim); check `roles`/`scp` per route with a guard, not just "token is valid"; v1 tokens use issuer `https://sts.windows.net/<tenant>/`, which is why version 2 is pinned.

## 3. Runtime identity (no secrets)

The apps run as a user-assigned managed identity. Containers set `AZURE_CLIENT_ID` and use `DefaultAzureCredential` for Service Bus, Key Vault, Application Insights and PostgreSQL (Entra token as the password). One-time database step, as a member of the Entra admin group:

```sql
SELECT * FROM pgaadauth_create_principal('id-adflow-<env>-app', false, false);
GRANT CONNECT ON DATABASE adflow TO "id-adflow-<env>-app";
-- grant only the table privileges the app needs
```

## 4. CI federation (no client secrets)

Azure DevOps: create a service connection of type *Azure Resource Manager -> Workload identity federation (automatic or manual)*, scoped to the resource group, one per environment. The identity gets `Contributor` on the resource group plus `Role Based Access Control Administrator` limited (via ABAC condition) to the roles the template assigns; a read-only identity (`Reader`) can run what-if.

GitHub Actions:

```bash
az ad app create --display-name adflow-github-deploy
az ad sp create --id <client-id>
for SUBJECT in "repo:<org>/<repo>:environment:dev" "repo:<org>/<repo>:environment:prod" "repo:<org>/<repo>:pull_request"; do
  az ad app federated-credential create --id <client-id> --parameters "{
    \"name\": \"gh-$(echo $SUBJECT | tr ':/' '--')\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"$SUBJECT\", \"audiences\": [\"api://AzureADTokenExchange\"] }"
done
az role assignment create --assignee <client-id> --role Contributor \
  --scope /subscriptions/<subscription-id>/resourceGroups/rg-adflow-dev
```

Use a distinct identity for prod. Subjects pin the environment, so a feature branch cannot mint a prod token.
