#!/usr/bin/env bash
#
# OWASP ZAP baseline scan against the running stack.
#
#   npm run test:security
#   TARGET=https://staging.example.com npm run test:security
#
# The baseline scan is passive: it spiders the app and applies passive rules.
# It never attacks, so it is safe to point at a running environment. The active
# scan (zap-full-scan.py) does attack and must only be used on a throwaway
# environment — never production.
#
# Findings are written to tests/security/reports/ as HTML and JSON.
#
# IMPORTANT: the gateway rate-limits by IP (10 r/s general, 5 r/s on bookings).
# ZAP's spider is faster than that, so it collects mostly 429s and can stall.
# For a meaningful scan, either raise the limits temporarily or exempt the
# scanner's IP with a `geo`/`map` block feeding limit_req_zone. Do not run
# other test suites at the same time — they will be throttled by the scan.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REPORT_DIR="$REPO_ROOT/tests/security/reports"

# Inside the container, the host is reachable as host.docker.internal.
TARGET="${TARGET:-http://host.docker.internal}"
HEALTH_URL="${HEALTH_URL:-http://localhost/health}"

if ! docker info > /dev/null 2>&1; then
  echo "Docker is not running — start Docker Desktop first."
  exit 1
fi

if ! curl -sf --max-time 5 "$HEALTH_URL" > /dev/null; then
  echo "The stack is not responding at $HEALTH_URL."
  echo "Start it with:  cd backend/infra && docker compose up -d"
  exit 1
fi

mkdir -p "$REPORT_DIR"

echo "OWASP ZAP baseline scan"
echo "  target:  $TARGET"
echo "  reports: tests/security/reports/"
echo ""

# -I keeps the exit code at 0 for warnings so the scan reports rather than
# blocks. Drop it once the findings are triaged and you want this to gate.
docker run --rm \
  --add-host=host.docker.internal:host-gateway \
  -v "$REPORT_DIR:/zap/wrk:rw" \
  zaproxy/zap-stable \
  zap-baseline.py \
  -t "$TARGET" \
  -r zap-report.html \
  -J zap-report.json \
  -I

echo ""
echo "HTML report: tests/security/reports/zap-report.html"
