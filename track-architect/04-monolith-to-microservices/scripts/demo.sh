#!/usr/bin/env bash
# Strangler fig demo: legacy (8081) + new service (8082) behind the proxy (8080); shift 0% -> 50% -> 100%.
set -euo pipefail
cd "$(dirname "$0")/.."
P=${PROXY_PORT:-8080}; L=${LEGACY_PORT:-8081}; N=${NEW_PORT:-8082}
PX=http://127.0.0.1:$P; LG=http://127.0.0.1:$L; NW=http://127.0.0.1:$N
LOGS=$(mktemp -d)
PIDS=()
cleanup() { for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null || true; done; }
trap cleanup EXIT

java -jar legacy-monolith/target/legacy-monolith-1.0.0-all.jar "$L" >"$LOGS/legacy.log" 2>&1 & PIDS+=($!)
java -jar new-campaign-service/target/new-campaign-service-1.0.0-all.jar "$N" >"$LOGS/new.log" 2>&1 & PIDS+=($!)
java -jar strangler-proxy/target/strangler-proxy-1.0.0-all.jar "$P" "$LG" "$NW" strangler-proxy/routing.properties >"$LOGS/proxy.log" 2>&1 & PIDS+=($!)
for u in "$LG/campaigns" "$NW/campaigns" "$PX/admin/status"; do
  for _ in $(seq 1 50); do curl -sf "$u" >/dev/null 2>&1 && break; sleep 0.2; done
done

step() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
served() { curl -s -D - -o /dev/null -H "X-Routing-Key: $2" "$PX$1" | tr -d '\r' | awk -F': ' 'tolower($1)=="x-served-by"{print $2}'; }
distribution() { # path
  local lg=0 nw=0 fb=0 s
  for i in $(seq 1 40); do
    s=$(served "$1" "user-$i")
    case "$s" in new) nw=$((nw+1));; legacy-fallback) fb=$((fb+1));; *) lg=$((lg+1));; esac
  done
  echo "40 requests -> legacy=$lg new=$nw fallback=$fb"
}
setroute() { curl -s -X POST "$PX/admin/routes?prefix=$1&percent=$2" ; echo; }

step "Routing table (config file): everything starts on the legacy"
curl -s "$PX/admin/routes"; echo

step "0%: GET /campaigns/1001 through the proxy (legacy answer, already translated to the NEW model by the ACL)"
curl -si "$PX/campaigns/1001" | tr -d '\r' | grep -iE '^(HTTP|x-served-by)|^\{'
step "0%: distribution over 40 users"
distribution /campaigns

step "Data migration: backfill legacy -> new through the ACL, then reconcile"
curl -s -X POST "$PX/admin/migrate"; echo
curl -s "$PX/admin/reconcile"; echo

step "Dual-write: POST /campaigns through the proxy lands in BOTH stores (legacy CHAR(20) truncates the name; the comparison tolerates it)"
RES=$(curl -s -X POST "$PX/campaigns" -d '{"id":0,"name":"Launch Q4 Retargeting","budget":{"amountMinor":250000,"currency":"USD"},"status":"ACTIVE","startDate":"2025-01-15"}')
echo "proxy  : $RES"
ID=$(echo "$RES" | sed -E 's/.*"id":([0-9]+).*/\1/')
echo "legacy : $(curl -s "$LG/campaigns/$ID")"
echo "new    : $(curl -s "$NW/campaigns/$ID")"

step "Drift: a legacy batch job edits campaign 1002 behind the proxy's back"
curl -s -X DELETE "$PX/admin/mismatches" >/dev/null   # drop the pre-migration noise (new was empty then)
curl -s -X PUT "$LG/campaigns/1002" -d '{"CAMP_NM":"Back To School","BUDGET_AMT":"5000.00","CCY_CD":"USD","STAT_CD":"S","START_DT":"20240801"}' >/dev/null
echo "shadow read (client still gets the legacy answer):"; served /campaigns/1002 k >/dev/null; sleep 0.5
curl -s "$PX/admin/mismatches"; echo
echo "reconcile finds it:"; curl -s "$PX/admin/reconcile"; echo
echo "reconcile with repair (legacy is still the system of record):"; curl -s "$PX/admin/reconcile?repair=true"; echo
curl -s -X DELETE "$PX/admin/mismatches" >/dev/null

step "50%: shift half of the /campaigns traffic"
setroute /campaigns 50
distribution /campaigns

step "100%: all /campaigns traffic on the new service; /reports still on the monolith"
setroute /campaigns 100
distribution /campaigns
echo "GET /reports/spend served by: $(served /reports/spend k)"
curl -s "$PX/reports/spend"; echo

step "Failure drill: kill the new service -> automatic fallback to legacy"
kill "${PIDS[1]}"; sleep 0.5
echo "GET /campaigns/1001 served by: $(served /campaigns/1001 k)"

step "Rollback = one config change"
setroute /campaigns 0
echo "GET /campaigns/1001 served by: $(served /campaigns/1001 k)"
step "Proxy status"
curl -s "$PX/admin/status"; echo
echo; echo "demo finished (logs in $LOGS)"
