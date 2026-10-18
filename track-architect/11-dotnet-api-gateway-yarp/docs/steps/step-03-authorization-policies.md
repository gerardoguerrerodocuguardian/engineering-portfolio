# Step 3: Authorization policies by role and scope per route

## Why it matters

Authentication says who; authorization says what. Policies are named in code (`campaigns-read`, `campaigns-write`, `reports-read`, `admin`) and attached to routes in configuration through YARP's `AuthorizationPolicy`. Write access needs a role AND a scope, so a token that merely carries the right role is not enough. A fallback policy denies anything that has no policy at all.

## What this step adds

- [`src/Gateway/Program.cs`](../../src/Gateway/Program.cs): `AddAuthorizationBuilder()` policies and the fallback policy
- [`src/Gateway/Infrastructure/Constants.cs`](../../src/Gateway/Infrastructure/Constants.cs): `HasScope` / `Roles` claim helpers
- [`src/Gateway/appsettings.json`](../../src/Gateway/appsettings.json): `AuthorizationPolicy` on each route; read and write are separate routes split by HTTP method

## Try it

Assumes `make run-local` (or `make up`) and, for the token examples, `BASE=http://127.0.0.1:8080`, `TOKEN` for alice, `BOB` for bob and `ROOT` for root (see step 2; admin calls must come from an allowlisted address).

```bash
BOB=$(curl -s -XPOST $BASE/dev/token -H 'content-type: application/json' -d '{"user":"bob"}' | jq -r .access_token)
curl -i -XPOST $BASE/api/v1/campaigns -H "authorization: Bearer $BOB" -H 'content-type: application/json' -d '{"name":"x","dailyBudgetCents":1}'   # 403
curl -i $BASE/api/v1/reports/summary -H "authorization: Bearer $TOKEN"   # 403 (alice has no reports.read)
curl -i $BASE/api/v1/reports/summary -H "authorization: Bearer $BOB"     # 200
```

## What it mitigates

Privilege escalation and broken function-level authorization (OWASP API5): a valid user calling an operation they were never granted.

## Test and checkpoint

- Tests: `dotnet test --filter "Step=03"` (AuthorizationTests: analyst cannot write, campaign manager cannot read reports, a role without the matching scope is denied.)
- Checkpoint: the repository contains the final state. To rebuild the project incrementally, add the files above to the earlier steps' result and wire the line(s) in [`Program.cs`](../../src/Gateway/Program.cs) marked with this step number in its pipeline comments. Every feature is also switchable in `Gateway:*` configuration, so you can start from the final tree and disable later steps to see an earlier checkpoint.
- Configuration switches that make this step observable: see the matching section of [`appsettings.json`](../../src/Gateway/appsettings.json).

[Previous: step 02](step-02-jwt-authentication.md) | [Next: step 04](step-04-rate-limiting.md)
