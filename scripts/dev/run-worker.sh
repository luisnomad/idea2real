#!/usr/bin/env bash
# Run the API generation worker process locally.
# Requires: docker compose services running (postgres, redis, minio).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "==> Checking infrastructure services..."
docker compose -f "$ROOT_DIR/docker-compose.yml" ps --format '{{.Service}} {{.Status}}' | while read -r svc status; do
  case "$svc" in
    postgres|redis|minio)
      if [[ "$status" != *"Up"* ]]; then
        echo "ERROR: $svc is not running. Start with: docker compose up -d postgres redis minio"
        exit 1
      fi
      ;;
  esac
done

echo "==> Starting API worker..."
cd "$ROOT_DIR"
exec pnpm --filter @idea2real/api run dev:worker
