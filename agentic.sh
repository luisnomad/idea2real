#!/usr/bin/env bash
# Compatibility shim: prefer Node control panel; fallback to legacy bash menu.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOOL_DIR="${ROOT_DIR}/tools/agentic-control"
DIST_ENTRY="${TOOL_DIR}/dist/cli.js"
LEGACY_SCRIPT="${ROOT_DIR}/scripts/agentic-legacy.sh"

run_legacy() {
  if [[ ! -x "${LEGACY_SCRIPT}" ]]; then
    echo "Error: legacy script not found: ${LEGACY_SCRIPT}" >&2
    exit 1
  fi

  echo "Falling back to legacy bash control center..." >&2
  exec "${LEGACY_SCRIPT}" "$@"
}

if [[ ! -d "${TOOL_DIR}" ]]; then
  run_legacy "$@"
fi

if command -v node >/dev/null 2>&1 && [[ -f "${DIST_ENTRY}" ]]; then
  exec node "${DIST_ENTRY}" "$@"
fi

if ! command -v pnpm >/dev/null 2>&1; then
  run_legacy "$@"
fi

exec pnpm --dir "${TOOL_DIR}" start "$@"
