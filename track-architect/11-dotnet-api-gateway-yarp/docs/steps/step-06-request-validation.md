# Step 6: Request validation, header hygiene and identity injection

## Why it matters

Cheap structural checks run before any expensive work: method allowlist, path normalization (dot segments, backslashes, NUL, double encoding), path/query/header size and count limits, a global body cap and per-route limits (`MaxBodyBytes`, `RequiredContentType`) kept in YARP route metadata. Then the trust boundary: the gateway strips inbound `X-User-*`, `X-Client-*`, `X-Forwarded-*`, `Authorization` and `X-Api-Key`, and injects identity headers derived from the validated principal. Hop-by-hop headers (`Connection`, `TE`, `Upgrade`...) are removed by YARP itself.

## What this step adds

- [`src/Gateway/Middleware/RequestValidationMiddleware.cs`](../../src/Gateway/Middleware/RequestValidationMiddleware.cs): `PathSafety` and the pre-routing checks
- [`src/Gateway/Middleware/RouteLimitsMiddleware.cs`](../../src/Gateway/Middleware/RouteLimitsMiddleware.cs): per-route body size and content type from route metadata
- [`src/Gateway/Middleware/IdentityHeadersMiddleware.cs`](../../src/Gateway/Middleware/IdentityHeadersMiddleware.cs): strip spoofable headers and inject trusted identity
- [`src/Gateway/appsettings.json`](../../src/Gateway/appsettings.json): `Gateway:Validation` and the `Metadata` on `campaigns-v1-write`

## Try it

Assumes `make run-local` (or `make up`) and, for the token examples, `BASE=http://127.0.0.1:8080`, `TOKEN` for alice, `BOB` for bob and `ROOT` for root (see step 2; admin calls must come from an allowlisted address).

```bash
curl -i "$BASE/api/v1/campaigns/%252e%252e/admin" -H "authorization: Bearer $TOKEN"        # 400
curl -i -XTRACE $BASE/api/v1/campaigns -H "authorization: Bearer $TOKEN"                    # 405
curl -i -XPOST $BASE/api/v1/campaigns -H "authorization: Bearer $TOKEN" -H 'content-type: text/plain' -d x   # 415
curl -s $BASE/api/v1/campaigns/echo -H "authorization: Bearer $TOKEN" -H 'X-User-Id: root' -H 'X-Forwarded-For: 6.6.6.6' | jq .headers
```
The echo shows `x-user-id: alice`; the spoofed values never arrive.

## What it mitigates

Path traversal, request smuggling-adjacent header abuse, oversized payload DoS, header spoofing for privilege escalation and log/IP forgery, and mass assignment via unexpected content types.

## Test and checkpoint

- Tests: `dotnet test --filter "Step=06"` (RequestValidationTests: 413, 415, 405, several 400 path cases, and the spoofed-header test asserting what the downstream actually received.)
- Checkpoint: the repository contains the final state. To rebuild the project incrementally, add the files above to the earlier steps' result and wire the line(s) in [`Program.cs`](../../src/Gateway/Program.cs) marked with this step number in its pipeline comments. Every feature is also switchable in `Gateway:*` configuration, so you can start from the final tree and disable later steps to see an earlier checkpoint.
- Configuration switches that make this step observable: see the matching section of [`appsettings.json`](../../src/Gateway/appsettings.json).

[Previous: step 05](step-05-abuse-protection.md) | [Next: step 07](step-07-tls-and-secure-headers.md)
