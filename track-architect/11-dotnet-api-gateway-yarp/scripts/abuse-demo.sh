#!/usr/bin/env bash
# Shows the adaptive ban: repeated bad tokens from one address end in a temporary 403 + Retry-After.
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:8080}"
for i in $(seq 1 14); do
  printf 'attempt %2d -> ' "$i"
  curl -s -o /dev/null -D - "$BASE/api/v1/campaigns" -H 'authorization: Bearer bad.token.here' \
    | awk 'NR==1{printf "%s ", $2} tolower($1)=="retry-after:"{printf "retry-after=%s", $2} END{print ""}'
done
