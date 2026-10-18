# Step 2: JWT bearer authentication (OIDC-style validation)

## Why it matters

Every request must prove who it is before it reaches anything internal. The gateway validates signature, issuer, audience, lifetime (with a small clock skew) and restricts the accepted signing algorithms, so a token minted for another API or another issuer is useless here. Production points `Gateway:Auth:Authority` at the identity provider (keys come from its JWKS); the demo uses a symmetric dev key that is generated at startup and never committed.

## What this step adds

- [`src/Gateway/Security/ConfigureJwtBearer.cs`](../../src/Gateway/Security/ConfigureJwtBearer.cs): validation parameters, algorithm allowlist, `MapInboundClaims = false`
- [`src/Gateway/Security/SigningKeyProvider.cs`](../../src/Gateway/Security/SigningKeyProvider.cs): random dev key or a base64 key from configuration
- [`src/Gateway/Security/DevTokenService.cs`](../../src/Gateway/Security/DevTokenService.cs): issues tokens for the demo users alice, bob, root
- [`src/Gateway/Endpoints/DevTokenEndpoint.cs`](../../src/Gateway/Endpoints/DevTokenEndpoint.cs): `POST /dev/token` (404 unless enabled and no authority is set)
- [`src/Gateway/Program.cs`](../../src/Gateway/Program.cs): `AddAuthentication` with a policy scheme and `UseAuthentication`

## Try it

Assumes `make run-local` (or `make up`) and, for the token examples, `BASE=http://127.0.0.1:8080`, `TOKEN` for alice, `BOB` for bob and `ROOT` for root (see step 2; admin calls must come from an allowlisted address).

```bash
BASE=http://127.0.0.1:8080
curl -i $BASE/api/v1/campaigns                                         # 401
TOKEN=$(curl -s -XPOST $BASE/dev/token -H 'content-type: application/json' -d '{"user":"alice"}' | jq -r .access_token)
curl -i $BASE/api/v1/campaigns -H "authorization: Bearer $TOKEN"       # 200
```

## What it mitigates

Anonymous access, forged or tampered tokens, tokens from another issuer or audience (confused deputy), expired or replayed-after-expiry tokens, and `alg=none` / algorithm-confusion attacks.

## Test and checkpoint

- Tests: `dotnet test --filter "Step=02"` (AuthenticationTests: 401 without a token, with garbage, with an expired token and with a wrong-audience token; the dev endpoint works and can be turned off.)
- Checkpoint: the repository contains the final state. To rebuild the project incrementally, add the files above to the earlier steps' result and wire the line(s) in [`Program.cs`](../../src/Gateway/Program.cs) marked with this step number in its pipeline comments. Every feature is also switchable in `Gateway:*` configuration, so you can start from the final tree and disable later steps to see an earlier checkpoint.
- Configuration switches that make this step observable: see the matching section of [`appsettings.json`](../../src/Gateway/appsettings.json).

[Previous: step 01](step-01-reverse-proxy.md) | [Next: step 03](step-03-authorization-policies.md)
