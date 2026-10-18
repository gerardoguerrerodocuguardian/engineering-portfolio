#!/usr/bin/env bash
# Black-box walkthrough against a running gateway (compose or run-local). Requires curl and jq.
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:8080}"
fail() { echo "FAIL: $*" >&2; exit 1; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
expect() { local want="$1"; shift; local got; got="$(code "$@")"; [ "$got" = "$want" ] || fail "expected $want got $got for: $*"; echo "ok  $want  $*"; }

for i in $(seq 1 60); do curl -fsS "$BASE/healthz" >/dev/null 2>&1 && break; sleep 1; done
curl -fsS "$BASE/healthz" >/dev/null || fail "gateway not healthy"

expect 401 "$BASE/api/v1/campaigns"                                         # step 2: no token
TOKEN="$(curl -fsS -X POST "$BASE/dev/token" -H 'content-type: application/json' -d '{"user":"alice"}' | jq -r .access_token)"
BOB="$(curl -fsS -X POST "$BASE/dev/token" -H 'content-type: application/json' -d '{"user":"bob"}' | jq -r .access_token)"
expect 200 "$BASE/api/v1/campaigns" -H "authorization: Bearer $TOKEN"        # step 1+2: proxied
expect 200 "$BASE/api/v2/campaigns" -H "authorization: Bearer $TOKEN"        # step 16: v2 path transform
expect 403 "$BASE/api/v1/reports/summary" -H "authorization: Bearer $TOKEN"  # step 3: wrong scope
expect 200 "$BASE/api/v1/reports/summary" -H "authorization: Bearer $BOB"
expect 400 "$BASE/api/v1/campaigns/%252e%252e/admin" -H "authorization: Bearer $TOKEN"   # step 6: traversal
expect 403 "$BASE/api/v1/campaigns?q=1%27%20OR%20%271%27%3D%271" -H "authorization: Bearer $TOKEN"   # step 20: WAF-lite
expect 413 -X POST "$BASE/api/v1/campaigns" -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  --data-binary "{\"name\":\"$(head -c 70000 /dev/zero | tr '\0' a)\"}"                   # step 6: body limit
expect 415 -X POST "$BASE/api/v1/campaigns" -H "authorization: Bearer $TOKEN" -H 'content-type: text/plain' -d 'x'

hdrs="$(curl -s -D - -o /dev/null "$BASE/api/v1/campaigns" -H "authorization: Bearer $TOKEN")"
echo "$hdrs" | grep -qi '^x-content-type-options: nosniff' || fail "missing nosniff"       # step 7
echo "$hdrs" | grep -qi '^x-correlation-id:' || fail "missing correlation id"              # step 11
echo "ok  secure headers + correlation id"

if [ -f certs/gateway.pfx ]; then
  curl -ksS -D - -o /dev/null "https://127.0.0.1:8443/healthz" | grep -qi '^strict-transport-security' \
    && echo "ok  HSTS over TLS" || fail "no HSTS header on HTTPS"
fi

# Last: exhaust the per-client token bucket (60 tokens, +30 per 10 s). 429s feed the abuse tracker,
# so this check must stay at the end of the run.
got429=0
for i in $(seq 1 200); do
  c="$(code "$BASE/api/v1/campaigns" -H "authorization: Bearer $TOKEN")"
  if [ "$c" = "429" ]; then got429=1; break; fi
done
[ "$got429" = 1 ] && echo "ok  429 after burst" || fail "never rate limited"
echo "smoke OK"
