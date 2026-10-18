# WAF integration: what the gateway is not, and what to put in front

## YARP is not a WAF

A reverse proxy routes traffic. A Web Application Firewall inspects it for attack patterns. YARP (and therefore this gateway) does the first, plus the API-specific controls in steps 1 to 19: authentication, authorization, rate limits, structural validation, bans. It ships no rule engine, no managed signatures, no anomaly scoring, no bot or reputation intelligence and no virtual patching.

The `WafMiddleware` in this repository (step 20) is a teaching example with eight regular expressions. It exists to show **where** inspection plugs into the pipeline (after cheap validation, before routing and authentication so attacks are logged even from anonymous callers) and to make its weaknesses visible:

- It matches decoded path, query, `User-Agent`, `Referer` and small textual bodies. It does not normalize every encoding (JSON `<` escapes, HTML entities, Unicode tricks, multipart) the way a real engine's transformation pipeline does.
- Signatures are easy to evade and can false-positive on legitimate data.
- It has no paranoia levels, no anomaly threshold, no per-rule exclusions, no response inspection.

Use `Detect` mode to learn what it would flag; do not rely on `Block` mode for protection.

## Option 1: ModSecurity v3 + OWASP Core Rule Set (nginx)

Place an nginx with ModSecurity and the OWASP CRS in front of the gateway. The public `owasp/modsecurity-crs` image does this with environment variables. [`deploy/waf/docker-compose.waf.yml`](../deploy/waf/docker-compose.waf.yml) is an override file:

```bash
docker compose -f docker-compose.yml -f deploy/waf/docker-compose.waf.yml --profile waf up -d --build
curl -i "http://127.0.0.1:8000/api/v1/campaigns?q=%3Cscript%3Ealert(1)%3C/script%3E"
```

**This file is configuration only. It was not run or verified by the author**; check image tags and variable names against the image documentation you pin.

Operating notes that matter more than the snippet:

1. Start with `MODSEC_RULE_ENGINE=DetectionOnly` and `PARANOIA=1`. Read the audit log for a week, add exclusions for legitimate traffic, then switch to `On`, then raise paranoia gradually.
2. The WAF becomes the gateway's only peer. Set `Gateway:Forwarded:KnownNetworks` to the WAF's network so the real client IP (from `X-Forwarded-For`) is used by rate limits, bans and allowlists. Without it, every request appears to come from the WAF and a single ban blocks everyone. Unpublish the gateway's own port so the WAF cannot be bypassed.
3. Keep the gateway's own checks. They are cheap, identity-aware and catch what a generic rule set cannot (a valid user calling an operation they were not granted).

## Option 2: Coraza

[Coraza](https://coraza.io) is a Go WAF engine compatible with ModSecurity rules and the CRS, embeddable in Caddy or nginx-like proxies and in Envoy via a filter. Use it when you want a ModSecurity-compatible rule set without the C++ ModSecurity runtime. Deployment shape is the same as option 1: it sits in front, loads the CRS, starts in detection mode, and the gateway trusts only its address. No Coraza configuration is shipped here because it could not be verified.

## Option 3: managed WAF

On a cloud, prefer the provider's WAF in front of the load balancer (for example Azure Front Door / Application Gateway WAF with the OWASP managed rule set, AWS WAF, or Cloud Armor). You get managed rule updates, bot and IP-reputation feeds, geo controls, and DDoS absorption at the edge, none of which a self-hosted gateway can provide.

## Division of labour

| Concern | Edge WAF / CDN | This gateway |
|---|---|---|
| Volumetric DDoS, L3/L4 floods | yes | no |
| Generic injection / XSS signatures, bot rules | yes (managed rules) | teaching example only |
| TLS termination at scale, certificates | yes | optional |
| Who is the caller, and may they do this? | no | yes (JWT, roles, scopes, API keys) |
| Per-identity rate limits and quotas | basic | yes |
| Business routing, versioning, resilience | no | yes |
