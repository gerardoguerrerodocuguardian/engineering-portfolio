# Step 7: HTTPS/TLS, HSTS, secure headers and forwarded-header trust

## Why it matters

Transport security: Kestrel serves HTTPS from a certificate mounted at runtime (`make certs` creates a self-signed one; production uses a managed certificate or terminates TLS in front), HSTS tells browsers to stay on HTTPS, optional redirection moves HTTP callers over. Response headers harden clients (`nosniff`, `X-Frame-Options`, a deny-all CSP suited to an API, `Referrer-Policy`, `Cache-Control: no-store` by default) and the `Server` banner is removed, including one copied from downstream. `X-Forwarded-*` is honoured only from configured proxies, otherwise anyone could claim any client IP.

## What this step adds

- [`src/Gateway/Middleware/SecurityHeadersMiddleware.cs`](../../src/Gateway/Middleware/SecurityHeadersMiddleware.cs): secure headers, banner removal
- [`src/Gateway/Program.cs`](../../src/Gateway/Program.cs): Kestrel limits, `UseHsts`, `UseHttpsRedirection`, `ForwardedHeadersOptions` from `Gateway:Forwarded`
- [`scripts/make-dev-cert.sh`](../../scripts/make-dev-cert.sh): self-signed PFX with a documented placeholder password
- [`docker-compose.yml`](../../docker-compose.yml): HTTPS listener on 8443, certificate mounted read-only

## Try it

Assumes `make run-local` (or `make up`) and, for the token examples, `BASE=http://127.0.0.1:8080`, `TOKEN` for alice, `BOB` for bob and `ROOT` for root (see step 2; admin calls must come from an allowlisted address).

```bash
make certs && make up
curl -ik https://127.0.0.1:8443/healthz | grep -i -E 'strict-transport|x-content-type|content-security'
```

## What it mitigates

Eavesdropping and downgrade attacks, MIME sniffing and framing, technology fingerprinting, and client-IP spoofing through forged `X-Forwarded-For` (which would defeat IP rate limits, bans and allowlists).

## Test and checkpoint

- Tests: `dotnet test --filter "Step=07"` (SecurityHeaderTests: headers present, no `Server`, and a forged `X-Forwarded-For` from an untrusted peer is ignored.)
- Checkpoint: the repository contains the final state. To rebuild the project incrementally, add the files above to the earlier steps' result and wire the line(s) in [`Program.cs`](../../src/Gateway/Program.cs) marked with this step number in its pipeline comments. Every feature is also switchable in `Gateway:*` configuration, so you can start from the final tree and disable later steps to see an earlier checkpoint.
- Configuration switches that make this step observable: see the matching section of [`appsettings.json`](../../src/Gateway/appsettings.json).

[Previous: step 06](step-06-request-validation.md) | [Next: step 08](step-08-ip-filtering.md)
