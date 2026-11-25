#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
url=${SOC_URL:-http://localhost:8081}
for i in $(seq 1 90); do
  if curl -fsS --max-time 3 "$url/api/v1/health" >/dev/null 2>&1; then
    SOC_URL="$url" node tests/smoke.mjs
    exit 0
  fi
  sleep 2
done
printf 'API niet bereikbaar. Controleer docker compose logs app sqlserver.\n' >&2
exit 1
