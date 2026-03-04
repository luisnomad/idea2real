#!/usr/bin/env bash
# Creates security-focused slice issues and places them in a GitHub Project.
#
# Usage:
#   ./scripts/create-security-issues.sh
#
# Optional env vars:
#   REPO=luisnomad/idea2real
#   PROJECT_OWNER=luisnomad
#   PROJECT_NUMBER=1
#   AUTO_ADD_PROJECT=true
#   AUTO_SET_STATUS=true
#   STATUS_FIELD_NAME=Status

set -euo pipefail

REPO="${REPO:-luisnomad/idea2real}"
PROJECT_OWNER="${PROJECT_OWNER:-luisnomad}"
PROJECT_NUMBER="${PROJECT_NUMBER:-1}"
AUTO_ADD_PROJECT="${AUTO_ADD_PROJECT:-true}"
AUTO_SET_STATUS="${AUTO_SET_STATUS:-true}"
STATUS_FIELD_NAME="${STATUS_FIELD_NAME:-Status}"

PROJECT_ID=""
STATUS_FIELD_ID=""
READY_OPTION_ID=""
BACKLOG_OPTION_ID=""

usage() {
  cat <<'EOF'
Create security slices in GitHub and optionally place them in Project statuses.

Usage:
  ./scripts/create-security-issues.sh

Optional env vars:
  REPO=luisnomad/idea2real
  PROJECT_OWNER=luisnomad
  PROJECT_NUMBER=1
  AUTO_ADD_PROJECT=true
  AUTO_SET_STATUS=true
  STATUS_FIELD_NAME=Status
EOF
}

require_tools() {
  command -v gh >/dev/null 2>&1 || {
    echo "Error: gh CLI is required." >&2
    exit 1
  }
  command -v jq >/dev/null 2>&1 || {
    echo "Error: jq is required for project status assignment." >&2
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

setup_project_context() {
  [[ "${AUTO_ADD_PROJECT}" == "true" ]] || return 0

  gh project view "${PROJECT_NUMBER}" --owner "${PROJECT_OWNER}" >/dev/null 2>&1 || {
    echo "Error: Cannot access project ${PROJECT_OWNER}/${PROJECT_NUMBER}." >&2
    echo "Hint: run gh auth refresh -s project" >&2
    exit 1
  }

  PROJECT_ID="$(gh project view "${PROJECT_NUMBER}" --owner "${PROJECT_OWNER}" --format json --jq '.id // empty' 2>/dev/null || true)"

  [[ "${AUTO_SET_STATUS}" == "true" ]] || return 0

  local fields_json
  fields_json="$(gh project field-list "${PROJECT_NUMBER}" --owner "${PROJECT_OWNER}" --format json)"

  STATUS_FIELD_ID="$(echo "${fields_json}" | jq -r --arg name "${STATUS_FIELD_NAME}" '
    if type=="array" then
      (map(select(.name==$name))[0].id // "")
    elif has("fields") then
      (.fields | map(select(.name==$name))[0].id // "")
    else
      ""
    end
  ')"

  if [[ -z "${STATUS_FIELD_ID}" ]]; then
    echo "Warning: Could not find field '${STATUS_FIELD_NAME}'. Status assignment will be skipped." >&2
    AUTO_SET_STATUS="false"
    return 0
  fi

  READY_OPTION_ID="$(echo "${fields_json}" | jq -r --arg name "${STATUS_FIELD_NAME}" '
    if type=="array" then
      (map(select(.name==$name))[0].options // [] | map(select(.name=="Ready"))[0].id // "")
    elif has("fields") then
      (.fields | map(select(.name==$name))[0].options // [] | map(select(.name=="Ready"))[0].id // "")
    else
      ""
    end
  ')"

  BACKLOG_OPTION_ID="$(echo "${fields_json}" | jq -r --arg name "${STATUS_FIELD_NAME}" '
    if type=="array" then
      (map(select(.name==$name))[0].options // [] | map(select(.name=="Backlog"))[0].id // "")
    elif has("fields") then
      (.fields | map(select(.name==$name))[0].options // [] | map(select(.name=="Backlog"))[0].id // "")
    else
      ""
    end
  ')"

  if [[ -z "${READY_OPTION_ID}" || -z "${BACKLOG_OPTION_ID}" ]]; then
    echo "Warning: Could not resolve Ready/Backlog options in '${STATUS_FIELD_NAME}'. Status assignment will be skipped." >&2
    AUTO_SET_STATUS="false"
  fi
}

find_existing_issue_url() {
  local key="$1"
  gh issue list --repo "${REPO}" --state all --search "\"${key}:\" in:title" --limit 1 --json url --jq '.[0].url // empty'
}

resolve_item_id_by_url() {
  local issue_url="$1"
  local items_json
  items_json="$(gh project item-list "${PROJECT_NUMBER}" --owner "${PROJECT_OWNER}" --limit 200 --format json)"

  echo "${items_json}" | jq -r --arg u "${issue_url}" '
    if type=="array" then
      (map(select((.content.url // "")==$u))[0].id // "")
    elif has("items") then
      (.items | map(select((.content.url // "")==$u))[0].id // "")
    else
      ""
    end
  '
}

set_project_status() {
  local item_id="$1"
  local status="$2"

  [[ "${AUTO_SET_STATUS}" == "true" ]] || return 0
  [[ -n "${item_id}" ]] || return 0
  [[ -n "${PROJECT_ID}" ]] || return 0
  [[ -n "${STATUS_FIELD_ID}" ]] || return 0

  local option_id=""
  case "${status}" in
    Ready) option_id="${READY_OPTION_ID}" ;;
    Backlog) option_id="${BACKLOG_OPTION_ID}" ;;
    *)
      echo "Warning: Unsupported status '${status}'. Skipping status assignment." >&2
      return 0
      ;;
  esac

  [[ -n "${option_id}" ]] || return 0

  gh project item-edit \
    --id "${item_id}" \
    --project-id "${PROJECT_ID}" \
    --field-id "${STATUS_FIELD_ID}" \
    --single-select-option-id "${option_id}" >/dev/null || {
      echo "Warning: Failed setting project status '${status}' for item ${item_id}." >&2
      return 0
    }
}

add_issue_to_project() {
  local issue_url="$1"
  local status="$2"
  local item_id=""

  [[ "${AUTO_ADD_PROJECT}" == "true" ]] || return 0

  local add_json
  add_json="$(gh project item-add "${PROJECT_NUMBER}" --owner "${PROJECT_OWNER}" --url "${issue_url}" --format json 2>/dev/null || true)"
  item_id="$(echo "${add_json}" | jq -r '.id // .item.id // empty' 2>/dev/null || true)"

  if [[ -z "${item_id}" ]]; then
    item_id="$(resolve_item_id_by_url "${issue_url}")"
  fi

  set_project_status "${item_id}" "${status}"
}

create_or_skip_issue() {
  local key="$1"
  local title="$2"
  local labels="$3"
  local status="$4"
  local body="$5"

  local issue_url
  issue_url="$(find_existing_issue_url "${key}")"

  if [[ -n "${issue_url}" ]]; then
    echo "• ${key} already exists: ${issue_url}"
    add_issue_to_project "${issue_url}" "${status}"
    return 0
  fi

  issue_url="$(gh issue create --repo "${REPO}" --title "${title}" --label "${labels}" --body "${body}")"
  add_issue_to_project "${issue_url}" "${status}"
  echo "✓ ${key} created (${status}): ${issue_url}"
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

require_tools
setup_project_context

ensure_label "slice" "0e8a16" "Parallel execution slice"
ensure_label "security" "b60205" "Security-focused work item"
ensure_label "phase-5" "1d76db" "Phase 5 hardening and production readiness"

echo "Creating security slices in ${REPO}..."
if [[ "${AUTO_ADD_PROJECT}" == "true" ]]; then
  echo "Project: ${PROJECT_OWNER}#${PROJECT_NUMBER}"
fi
if [[ "${AUTO_SET_STATUS}" == "true" ]]; then
  echo "Status field: ${STATUS_FIELD_NAME} (Backlog/Ready)"
fi
echo

create_or_skip_issue "P5-API-11" \
  "P5-API-11: Prompt injection boundary + output validation layer" \
  "slice,security,phase-5" \
  "Ready" \
  "$(cat <<'EOF'
## Slice ID
P5-API-11

## Domain
Core API (`apps/api`)

## Depends On
None

## Paths Touched
```
apps/api/src/security/
apps/api/src/providers/
apps/api/src/routes/prompt*
apps/api/src/middleware/
```

## Behavior Contract
```
Given a user prompt and provider response are received
When prompt improvement and generation handoff executes
Then system instructions remain immutable and user content is treated as untrusted
And responses violating prompt-safety policy are rejected with a safe error
```

## Test Plan
- Prompt policy unit tests (allowlist/denylist and schema checks)
- Integration tests for malicious prompt/output rejection paths

## Definition of Done
Prompt-improvement flow enforces server-side prompt boundaries and rejects policy-bypass responses.
EOF
)"

create_or_skip_issue "P5-WEB-11" \
  "P5-WEB-11: Frontend security posture (CSP-safe patterns, no secret leakage)" \
  "slice,security,phase-5" \
  "Ready" \
  "$(cat <<'EOF'
## Slice ID
P5-WEB-11

## Domain
Frontend (`apps/web`)

## Depends On
None

## Paths Touched
```
apps/web/src/
apps/web/index.html
apps/web/vite.config.ts
```

## Behavior Contract
```
Given the frontend is built for production
When configuration and rendering paths are inspected
Then no secret values are exposed in client bundle config
And unsafe rendering sinks are avoided or constrained by reviewed sanitizer boundaries
```

## Test Plan
- Unit tests for safe rendering components
- Build-time checks to prevent secret-prefixed vars from being consumed client-side

## Definition of Done
Frontend follows secure rendering/config defaults and has checks preventing accidental secret exposure.
EOF
)"

create_or_skip_issue "P5-GEOM-11" \
  "P5-GEOM-11: Upload and geometry pipeline sandbox hardening" \
  "slice,security,phase-5" \
  "Ready" \
  "$(cat <<'EOF'
## Slice ID
P5-GEOM-11

## Domain
Geometry (`services/geometry`)

## Depends On
None

## Paths Touched
```
services/geometry/app/
services/geometry/tests/
services/geometry/Dockerfile
```

## Behavior Contract
```
Given uploaded files enter geometry processing
When files are validated and processed
Then invalid MIME/type/size payloads are rejected early
And processing runs with explicit timeout and resource constraints
```

## Test Plan
- Negative tests for malformed and oversized upload payloads
- Timeout/resource-limit integration tests

## Definition of Done
Geometry service rejects malformed uploads and enforces bounded processing runtime.
EOF
)"

create_or_skip_issue "P5-API-12" \
  "P5-API-12: Auth scopes, abuse throttling, and idempotency controls" \
  "slice,security,phase-5" \
  "Backlog" \
  "$(cat <<'EOF'
## Slice ID
P5-API-12

## Domain
Core API (`apps/api`)

## Depends On
P5-API-11

## Paths Touched
```
apps/api/src/auth/
apps/api/src/middleware/
apps/api/src/routes/
apps/api/src/jobs/
```

## Behavior Contract
```
Given public generation endpoints receive high traffic or repeat submissions
When auth and request controls are applied
Then unauthorized or over-limit requests are denied safely
And duplicate generation actions are deduplicated with idempotency keys
```

## Test Plan
- Auth scope validation tests
- Rate-limit burst tests
- Idempotency integration tests

## Definition of Done
Public endpoints enforce scoped auth, rate limits, and idempotent job creation.
EOF
)"

create_or_skip_issue "P5-INFRA-11" \
  "P5-INFRA-11: VPS hardening baseline (firewall, ssh policy, non-root runtime)" \
  "slice,security,phase-5" \
  "Backlog" \
  "$(cat <<'EOF'
## Slice ID
P5-INFRA-11

## Domain
Infra

## Depends On
None

## Paths Touched
```
deploy/
docker-compose*.yml
infra/
docs/project/
```

## Behavior Contract
```
Given the app is deployed to a VPS
When host and runtime hardening controls are applied
Then only required public ports are exposed and SSH policy is hardened
And containers run with least privilege and non-root users
```

## Test Plan
- Deployment checklist validation
- Port exposure verification
- User/privilege checks for runtime containers

## Definition of Done
VPS and runtime baseline controls are documented and reproducibly applied.
EOF
)"

create_or_skip_issue "P5-INFRA-12" \
  "P5-INFRA-12: Security observability, incident runbooks, and key-rotation drill" \
  "slice,security,phase-5" \
  "Backlog" \
  "$(cat <<'EOF'
## Slice ID
P5-INFRA-12

## Domain
Infra

## Depends On
P5-INFRA-11

## Paths Touched
```
docs/
scripts/
monitoring/
```

## Behavior Contract
```
Given production security-relevant events occur
When logging and incident procedures run
Then auth/rate-limit/prompt-safety anomalies are visible with request context
And key-rotation and restore drills are executable via documented runbooks
```

## Test Plan
- Alert wiring checks
- Dry-run incident drill checklist
- Key-rotation rehearsal notes

## Definition of Done
Security observability and incident-response drills are operational and documented.
EOF
)"

echo
echo "Security slice creation complete."
echo "Issues: https://github.com/${REPO}/issues"
if [[ "${AUTO_ADD_PROJECT}" == "true" ]]; then
  echo "Project: https://github.com/users/${PROJECT_OWNER}/projects/${PROJECT_NUMBER}"
fi
