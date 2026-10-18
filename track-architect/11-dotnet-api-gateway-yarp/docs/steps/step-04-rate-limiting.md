# Step 4: Rate limiting: token bucket, sliding window, concurrency, 429 + Retry-After

## Why it matters

Three built-in ASP.NET Core limiters, each answering a different question. A global sliding window per IP caps what any address can do (including unauthenticated floods). A token bucket per user or API client gives each caller a fair share with bursts. A concurrency limiter per client protects the slow reports backend from parallel heavy calls. Rejections are `429` with `Retry-After`. The limiter runs after authentication so keys can be identities, not just IPs.

## What this step adds

- [`src/Gateway/RateLimiting/RateLimiting.cs`](../../src/Gateway/RateLimiting/RateLimiting.cs): `GlobalLimiter`, named policies, `OnRejected` writing Retry-After
- [`src/Gateway/appsettings.json`](../../src/Gateway/appsettings.json): `Gateway:RateLimit` and `RateLimiterPolicy` on routes
- [`src/Gateway/Program.cs`](../../src/Gateway/Program.cs): `AddRateLimiter` + `UseRateLimiter` after `UseAuthentication`

## Try it

Assumes `make run-local` (or `make up`) and, for the token examples, `BASE=http://127.0.0.1:8080`, `TOKEN` for alice, `BOB` for bob and `ROOT` for root (see step 2; admin calls must come from an allowlisted address).

```bash
for i in $(seq 1 100); do curl -s -o /dev/null -w '%{http_code} ' $BASE/api/v1/campaigns -H "authorization: Bearer $TOKEN"; done; echo
curl -i $BASE/api/v1/campaigns -H "authorization: Bearer $TOKEN" | grep -i -E 'HTTP/|retry-after'
```

## What it mitigates

Brute force, scraping, accidental client loops and noisy-neighbour effects (OWASP API4: unrestricted resource consumption) at the application layer.

## Test and checkpoint

- Tests: `dotnet test --filter "Step=04"` (RateLimitingTests: bucket empties to 429 with Retry-After, buckets are per user, and the per-IP window limits anonymous callers.)
- Checkpoint: the repository contains the final state. To rebuild the project incrementally, add the files above to the earlier steps' result and wire the line(s) in [`Program.cs`](../../src/Gateway/Program.cs) marked with this step number in its pipeline comments. Every feature is also switchable in `Gateway:*` configuration, so you can start from the final tree and disable later steps to see an earlier checkpoint.
- Configuration switches that make this step observable: see the matching section of [`appsettings.json`](../../src/Gateway/appsettings.json).

[Previous: step 03](step-03-authorization-policies.md) | [Next: step 05](step-05-abuse-protection.md)
