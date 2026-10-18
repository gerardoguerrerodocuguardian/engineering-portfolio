#!/usr/bin/env bash
# Creates a self-signed certificate for the demo HTTPS listener. The password is a documented
# placeholder (override with CERT_PASSWORD); the files stay in ./certs, which is git-ignored.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p certs
PASS="${CERT_PASSWORD:-dev-only-change-me}"
openssl req -x509 -newkey rsa:2048 -nodes -days 30 \
  -keyout certs/gateway.key -out certs/gateway.crt \
  -subj "/CN=gateway.adflow.example" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" 2>/dev/null
openssl pkcs12 -export -out certs/gateway.pfx -inkey certs/gateway.key -in certs/gateway.crt -passout "pass:${PASS}"
chmod 644 certs/gateway.pfx   # the container runs as a non-root user and must be able to read it
echo "wrote certs/gateway.pfx"
