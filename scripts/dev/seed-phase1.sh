#!/usr/bin/env bash
# Seed local dev environment for Phase 1 testing.
# Creates minio bucket and verifies service connectivity.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "==> Starting infrastructure services..."
docker compose -f "$ROOT_DIR/docker-compose.yml" up -d postgres redis minio

echo "==> Waiting for services to be healthy..."
docker compose -f "$ROOT_DIR/docker-compose.yml" up minio-init

echo "==> Verifying PostgreSQL..."
docker compose -f "$ROOT_DIR/docker-compose.yml" exec -T postgres pg_isready -U idea2real -d idea2real

echo "==> Verifying Redis..."
docker compose -f "$ROOT_DIR/docker-compose.yml" exec -T redis redis-cli ping

echo "==> Verifying MinIO..."
curl -fsS http://localhost:9000/minio/health/live && echo " MinIO OK"

echo ""
echo "Phase 1 local environment ready!"
echo "  PostgreSQL: localhost:5432 (idea2real/idea2real)"
echo "  Redis:      localhost:6379"
echo "  MinIO:      localhost:9000 (minioadmin/minioadmin)"
echo "  MinIO Console: http://localhost:9001"
echo "  Bucket:     idea2real-assets"
