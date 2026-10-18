# Step 20: WAF: what YARP is not, and a documented integration point

## Why it matters

YARP is a reverse proxy, not a Web Application Firewall. Step 20 adds a small request-inspection middleware with eight OWASP-style signatures (SQLi, XSS, traversal, command injection) in `Off`, `Detect` or `Block` mode, to show where inspection plugs in and to make the limits visible, for example the test that must send raw JSON because `System.Text.Json` escapes `<` as `\u003C`, which a naive signature cannot see. For real protection put ModSecurity + OWASP Core Rule Set (nginx), Coraza, or a cloud WAF in front: see [../waf-integration.md](../waf-integration.md).

## What this step adds

- [`src/Gateway/Middleware/WafMiddleware.cs`](../../src/Gateway/Middleware/WafMiddleware.cs): `WafSignatures` and the middleware (path, query, selected headers, small textual bodies)
- [`deploy/waf/docker-compose.waf.yml`](../../deploy/waf/docker-compose.waf.yml): unverified ModSecurity + CRS compose override
- [`docs/waf-integration.md`](../../docs/waf-integration.md): how to deploy a real WAF and what it adds

## Try it

Assumes `make run-local` (or `make up`) and, for the token examples, `BASE=http://127.0.0.1:8080`, `TOKEN` for alice, `BOB` for bob and `ROOT` for root (see step 2; admin calls must come from an allowlisted address).

```bash
curl -i "$BASE/api/v1/campaigns?q=1%27%20OR%20%271%27%3D%271" -H "authorization: Bearer $TOKEN"   # 403 in Block mode
# Gateway__Waf__Mode=Detect logs to the audit trail without blocking
```

## What it mitigates

Opportunistic injection probes and obvious scanner payloads. It does NOT replace a WAF: no evasion handling, no anomaly scoring, no managed rules, no virtual patching.

## Test and checkpoint

- Tests: `dotnet test --filter "Step=20"` (WafTests: blocked in Block mode, logged in Detect mode, signatures match and ignore ordinary text.)
- Checkpoint: the repository contains the final state. To rebuild the project incrementally, add the files above to the earlier steps' result and wire the line(s) in [`Program.cs`](../../src/Gateway/Program.cs) marked with this step number in its pipeline comments. Every feature is also switchable in `Gateway:*` configuration, so you can start from the final tree and disable later steps to see an earlier checkpoint.
- Configuration switches that make this step observable: see the matching section of [`appsettings.json`](../../src/Gateway/appsettings.json).

[Previous: step 19](step-19-admin-endpoints.md)
