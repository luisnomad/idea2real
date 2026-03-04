#!/usr/bin/env bash
# Bootstrap gh CLI setup for idea2real execution workflow.
#
# Usage:
#   ./scripts/gh-bootstrap.sh
#
# Optional env vars:
#   REPO=luisnomad/idea2real
#   PROJECT_OWNER=luisnomad
#   PROJECT_NUMBER=1
#   GH_HOST=github.com

set -euo pipefail

REPO="${REPO:-luisnomad/idea2real}"
PROJECT_OWNER="${PROJECT_OWNER:-luisnomad}"
PROJECT_NUMBER="${PROJECT_NUMBER:-1}"
GH_HOST="${GH_HOST:-github.com}"
RETRY_COUNT="${RETRY_COUNT:-4}"
RETRY_SLEEP_SECONDS="${RETRY_SLEEP_SECONDS:-2}"

usage() {
  cat <<'EOF'
Bootstrap gh CLI setup for idea2real.

Usage:
  ./scripts/gh-bootstrap.sh

Optional env vars:
  REPO=luisnomad/idea2real
  PROJECT_OWNER=luisnomad
  PROJECT_NUMBER=1
  GH_HOST=github.com
  RETRY_COUNT=4
  RETRY_SLEEP_SECONDS=2
EOF
}

confirm() {
  local prompt="$1"
  local ans
  read -r -p "${prompt} [y/N]: " ans
  case "${ans}" in
    y|Y|yes|YES) return 0 ;;
    *) return 1 ;;
  esac
}

require_gh() {
  command -v gh >/dev/null 2>&1 || {
    echo "Error: gh CLI is required." >&2
    echo "Install: https://cli.github.com/" >&2
    exit 1
  }
}

run_with_retry() {
  local attempt=1
  local max_attempts="${RETRY_COUNT}"
  local sleep_seconds="${RETRY_SLEEP_SECONDS}"
  local output=""

  while (( attempt <= max_attempts )); do
    if output="$("$@" 2>&1)"; then
      return 0
    fi

    if (( attempt == max_attempts )); then
      echo "${output}" >&2
      return 1
    fi

    echo "Transient failure (attempt ${attempt}/${max_attempts}). Retrying in ${sleep_seconds}s..." >&2
    sleep "${sleep_seconds}"
    attempt=$((attempt + 1))
  done

  return 1
}

try_project_access() {
  gh project view "${PROJECT_NUMBER}" --owner "${PROJECT_OWNER}" >/dev/null 2>&1
}

project_access_error() {
  gh project view "${PROJECT_NUMBER}" --owner "${PROJECT_OWNER}" 2>&1 >/dev/null || true
}

is_auth_or_scope_error() {
  local err="$1"
  printf '%s' "${err}" | grep -qi 'scope\|forbidden\|resource not accessible\|must authenticate\|authentication\|401\|403\|not authorized'
}

main() {
  if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    usage
    exit 0
  fi

  require_gh

  echo "== gh bootstrap =="
  echo "Repo:    ${REPO}"
  echo "Project: ${PROJECT_OWNER}#${PROJECT_NUMBER}"
  echo "Host:    ${GH_HOST}"
  echo

  if ! gh auth status --hostname "${GH_HOST}" >/dev/null 2>&1; then
    echo "gh is not authenticated."
    if confirm "Run 'gh auth login' now?"; then
      gh auth login --hostname "${GH_HOST}"
    else
      echo "Aborted: gh auth is required."
      exit 1
    fi
  else
    echo "gh auth: OK"
  fi

  echo "Setting default repo..."
  run_with_retry gh repo set-default "${REPO}"

  echo "Validating repo access..."
  run_with_retry gh repo view "${REPO}" --json nameWithOwner >/dev/null

  echo "Validating project access..."
  if run_with_retry try_project_access; then
    echo "project access: OK"
  else
    project_err="$(project_access_error)"
    if is_auth_or_scope_error "${project_err}"; then
      echo "project scope/auth appears missing; requesting refresh"
      gh auth refresh --hostname "${GH_HOST}" -s project
      run_with_retry try_project_access
    else
      echo "project access failed for a non-auth reason. Details:"
      echo "${project_err}"
      exit 1
    fi
  fi

  echo
  echo "Bootstrap complete."
  echo "Next:"
  echo "  ./scripts/start-agent-session.sh"
  echo "  ./scripts/create-p0-issues.sh"
}

main "$@"
