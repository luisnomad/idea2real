#!/usr/bin/env bash
# Creates Phase 0 slice issues in GitHub and optionally adds them to a Project.
#
# Usage:
#   ./scripts/create-p0-issues.sh
#
# Optional env vars:
#   REPO=luisnomad/idea2real
#   PROJECT_OWNER=luisnomad
#   PROJECT_NUMBER=1
#   AUTO_ADD_PROJECT=true

set -euo pipefail

REPO="${REPO:-luisnomad/idea2real}"
PROJECT_OWNER="${PROJECT_OWNER:-luisnomad}"
PROJECT_NUMBER="${PROJECT_NUMBER:-1}"
AUTO_ADD_PROJECT="${AUTO_ADD_PROJECT:-true}"

usage() {
  cat <<'EOF'
Create Phase 0 slice issues and optionally add them to a GitHub Project.

Usage:
  ./scripts/create-p0-issues.sh

Optional env vars:
  REPO=luisnomad/idea2real
  PROJECT_OWNER=luisnomad
  PROJECT_NUMBER=1
  AUTO_ADD_PROJECT=true
EOF
}

require_gh() {
  command -v gh >/dev/null 2>&1 || {
    echo "Error: gh CLI is required." >&2
    exit 1
  }
  gh auth status >/dev/null 2>&1 || {
    echo "Error: gh is not authenticated. Run: gh auth login" >&2
    exit 1
  }
}

ensure_label() {
  local name="$1"
  local color="$2"
  local description="$3"

  if gh label list --repo "${REPO}" --search "${name}" --json name --jq ".[] | select(.name==\"${name}\") | .name" | grep -qx "${name}"; then
    return 0
  fi

  gh label create "${name}" \
    --repo "${REPO}" \
    --color "${color}" \
    --description "${description}" >/dev/null
}

ensure_labels() {
  ensure_label "slice" "0e8a16" "Parallel execution slice"
  ensure_label "phase-0" "1d76db" "Phase 0 setup and foundations"
  ensure_label "contracts" "5319e7" "Contracts and shared schemas"
  ensure_label "api" "0052cc" "Core API slice"
  ensure_label "geometry" "0366d6" "Geometry microservice slice"
  ensure_label "frontend" "0e8a16" "Frontend slice"
  ensure_label "infra" "c2e0c6" "Infrastructure slice"
}

add_to_project() {
  local issue_url="$1"
  if [[ "${AUTO_ADD_PROJECT}" != "true" ]]; then
    return 0
  fi

  gh project item-add "${PROJECT_NUMBER}" \
    --owner "${PROJECT_OWNER}" \
    --url "${issue_url}" >/dev/null
}

create_issue() {
  local key="$1"
  local title="$2"
  local labels="$3"
  local body="$4"

  local existing_url
  existing_url="$(gh issue list --repo "${REPO}" --state all --search "\"${key}:\" in:title" --limit 1 --json url --jq '.[0].url // empty')"
  if [[ -n "${existing_url}" ]]; then
    add_to_project "${existing_url}"
    echo "• ${key} already exists: ${existing_url}"
    return 0
  fi

  local issue_url
  issue_url="$(gh issue create --repo "${REPO}" --title "${title}" --label "${labels}" --body "${body}")"
  add_to_project "${issue_url}"

  echo "✓ ${key} created: ${issue_url}"
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

require_gh
ensure_labels

if [[ "${AUTO_ADD_PROJECT}" == "true" ]]; then
  gh project view "${PROJECT_NUMBER}" --owner "${PROJECT_OWNER}" >/dev/null 2>&1 || {
    echo "Error: Cannot access project ${PROJECT_OWNER}/${PROJECT_NUMBER}." >&2
    echo "Hint: run gh auth refresh -s project" >&2
    exit 1
  }
fi

echo "Creating Phase 0 slice issues in ${REPO}..."
if [[ "${AUTO_ADD_PROJECT}" == "true" ]]; then
  echo "Auto-adding to project ${PROJECT_OWNER}#${PROJECT_NUMBER}"
else
  echo "Project auto-add disabled (AUTO_ADD_PROJECT=${AUTO_ADD_PROJECT})"
fi
echo

create_issue "P0-CONTRACTS-1" \
  "P0-CONTRACTS-1: Baseline schemas and generated clients" \
  "slice,phase-0,contracts" \
  "$(cat <<'EOF'
## Slice ID
P0-CONTRACTS-1

## Domain
Contracts (`packages/contracts`)

## Depends On
None — this is the foundation slice.

## Paths Touched
```
packages/contracts/src/schemas/
packages/contracts/src/generated/
packages/contracts/package.json
packages/contracts/tsconfig.json
```

## Behavior Contract
```
Given the monorepo is set up
When a consumer imports from @idea2real/contracts
Then they get typed Zod schemas for all domain entities (user, prompt, generation, model, asset, job)
And generated TypeScript types are available without manual casting
```

## Test Plan
- `packages/contracts/src/__tests__/schemas.test.ts` — validate schema shapes and edge cases
- `packages/contracts/src/__tests__/types.test.ts` — ensure generated types compile

## Definition of Done
Other agents can `import { GenerationSchema, JobSchema } from '@idea2real/contracts'` and get full type safety.
EOF
)"

create_issue "P0-API-1" \
  "P0-API-1: Hono API skeleton with health, auth stub, and OpenAPI" \
  "slice,phase-0,api" \
  "$(cat <<'EOF'
## Slice ID
P0-API-1

## Domain
Core API (`apps/api`)

## Depends On
P0-CONTRACTS-1 (for shared schemas)

## Paths Touched
```
apps/api/src/
apps/api/package.json
apps/api/tsconfig.json
apps/api/vitest.config.ts
```

## Behavior Contract
```
Given the API server starts
When a client sends GET /health
Then it returns 200 with { status: "ok", version: string }
And all responses use the typed error envelope from contracts
And OpenAPI spec is generated and accessible at /docs
```

## Test Plan
- `apps/api/src/__tests__/health.test.ts` — health endpoint returns 200
- `apps/api/src/__tests__/error-envelope.test.ts` — errors follow contract shape
- `apps/api/src/__tests__/auth-stub.test.ts` — auth middleware exists and passes through

## Definition of Done
`curl localhost:3000/health` returns valid JSON. OpenAPI spec accessible. Error responses typed.
EOF
)"

create_issue "P0-GEOM-1" \
  "P0-GEOM-1: FastAPI geometry service skeleton with health and stubs" \
  "slice,phase-0,geometry" \
  "$(cat <<'EOF'
## Slice ID
P0-GEOM-1

## Domain
Geometry (`services/geometry`)

## Depends On
P0-CONTRACTS-1 (for request/response schema alignment)

## Paths Touched
```
services/geometry/app/
services/geometry/tests/
services/geometry/pyproject.toml
services/geometry/Dockerfile
```

## Behavior Contract
```
Given the geometry service starts
When a client sends GET /health
Then it returns 200 with { status: "ok" }
And POST /cleanup returns 501 with a stub response matching the contract schema
And all responses include request-id header
```

## Test Plan
- `services/geometry/tests/test_health.py` — health endpoint
- `services/geometry/tests/test_cleanup_stub.py` — cleanup returns 501 with correct shape

## Definition of Done
`curl localhost:8000/health` returns valid JSON. Cleanup endpoint exists as documented stub.
EOF
)"

create_issue "P0-WEB-1" \
  "P0-WEB-1: App shell, routing, and design token setup" \
  "slice,phase-0,frontend" \
  "$(cat <<'EOF'
## Slice ID
P0-WEB-1

## Domain
Frontend (`apps/web`)

## Depends On
None (can start immediately, stubs against contract types)

## Paths Touched
```
apps/web/src/
apps/web/index.html
apps/web/package.json
apps/web/tsconfig.json
apps/web/vite.config.ts
apps/web/tailwind.config.ts
```

## Behavior Contract
```
Given a user opens the app in a browser
When the page loads
Then they see the three-column layout (left nav, workspace, inspector)
And the left nav shows all primary sections (Dashboard, Create, Prompt Studio, Library, History, Print Prep, Settings)
And clicking a nav item routes to the correct view
And the app respects light/dark theme preference
```

## Test Plan
- `apps/web/src/__tests__/App.test.tsx` — app renders shell
- `apps/web/src/__tests__/routing.test.tsx` — routes resolve
- `apps/web/src/__tests__/theme.test.tsx` — theme toggle works

## Definition of Done
App loads in browser with shell layout. All nav items route correctly. Design tokens applied. Light/dark theme works.

## UI Reference
See `docs/project/FRONTEND_UI_DIRECTION.md` for layout specs, typography, color tokens, and component map.
EOF
)"

create_issue "P0-INFRA-1" \
  "P0-INFRA-1: Docker Compose stack, CI matrix, and local bootstrap" \
  "slice,phase-0,infra" \
  "$(cat <<'EOF'
## Slice ID
P0-INFRA-1

## Domain
Infra

## Depends On
None (can start immediately)

## Paths Touched
```
docker-compose.yml
docker-compose.dev.yml
.github/workflows/ci.yml
scripts/bootstrap.sh
scripts/seed.sh
package.json (workspace root)
pnpm-workspace.yaml
turbo.json
```

## Behavior Contract
```
Given a developer clones the repo
When they run ./scripts/bootstrap.sh
Then all services start (postgres, redis, minio, api, geometry, web)
And pnpm install succeeds with workspace packages linked
And CI runs lint, typecheck, and unit tests for all packages
```

## Test Plan
- CI workflow validates: lint, typecheck, test for each workspace package
- `scripts/bootstrap.sh` exits 0 on a clean clone
- Docker Compose health checks pass for all services

## Definition of Done
`docker compose up` starts full stack. `pnpm install && pnpm build` succeeds. CI matrix runs all checks.
EOF
)"

echo
echo "All Phase 0 issues created."
echo "Issues: https://github.com/${REPO}/issues"
if [[ "${AUTO_ADD_PROJECT}" == "true" ]]; then
  echo "Project: https://github.com/users/${PROJECT_OWNER}/projects/${PROJECT_NUMBER}"
fi
