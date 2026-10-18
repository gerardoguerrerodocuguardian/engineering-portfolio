#!/usr/bin/env bash
# Runs the whole stack with `dotnet run` (no Docker). Ports: gateway 8080, campaigns 5101/5102, reports 5201.
set -euo pipefail
cd "$(dirname "$0")/.."
PID_DIR=.run
case "${1:-start}" in
  start)
    mkdir -p "$PID_DIR" logs
    dotnet build AdFlow.Gateway.sln -c Release >/dev/null
    start() { # name, project, urls, instance
      INSTANCE_NAME="$4" ASPNETCORE_ENVIRONMENT=Development \
        dotnet run --no-build -c Release --project "$2" --urls "$3" >"logs/$1.log" 2>&1 &
      echo $! >"$PID_DIR/$1.pid"
    }
    start campaigns-1 src/Services/Campaigns.Api http://127.0.0.1:5101 campaigns-1
    start campaigns-2 src/Services/Campaigns.Api http://127.0.0.1:5102 campaigns-2
    start reports     src/Services/Reports.Api   http://127.0.0.1:5201 reports
    start gateway     src/Gateway                http://127.0.0.1:8080 gateway
    echo "started; logs in ./logs. Try: curl -s http://127.0.0.1:8080/healthz"
    ;;
  stop)
    for f in "$PID_DIR"/*.pid; do [ -f "$f" ] && kill "$(cat "$f")" 2>/dev/null || true; rm -f "$f"; done
    ;;
esac
