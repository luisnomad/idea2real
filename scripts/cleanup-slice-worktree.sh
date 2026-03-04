#!/usr/bin/env bash
# Clean up a completed slice worktree/branch after merge.
#
# Usage:
#   ./scripts/cleanup-slice-worktree.sh --branch codex/p0-infra-1-topic
#   ./scripts/cleanup-slice-worktree.sh --slice P0-INFRA-1
#
# Defaults:
#   BASE_BRANCH=main

set -euo pipefail

BASE_BRANCH="${BASE_BRANCH:-main}"
SLICE_ID=""
BRANCH_NAME=""
WORKTREE_PATH=""
DELETE_REMOTE="false"
FORCE="false"
YES="false"
DRY_RUN="false"
DIRTY_WORKTREE="false"
DIRTY_COUNT=0
DIRTY_PREVIEW=""
LOCAL_AHEAD_COUNT=0

usage() {
  cat <<'EOF'
Clean up a merged slice worktree and branch.

Usage:
  ./scripts/cleanup-slice-worktree.sh --branch <branch>
  ./scripts/cleanup-slice-worktree.sh --slice <slice-id>

Options:
  --slice <id>         Slice ID (example: P0-INFRA-1)
  --branch <name>      Branch name (example: codex/p0-infra-1-topic)
  --worktree <path>    Explicit worktree path (optional)
  --base <branch>      Base branch to verify merge against (default: main)
  --delete-remote      Also delete remote branch from origin
  --force              Skip merged check and force local cleanup
  --yes                Non-interactive confirmation
  --dry-run            Print actions without executing
  -h, --help           Show help
EOF
}

fail() {
  echo "Error: $*" >&2
  exit 1
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

to_slice_slug() {
  echo "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g'
}

require_tools() {
  command -v git >/dev/null 2>&1 || fail "git is required"
}

detect_repo_root() {
  REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
  [[ -n "${REPO_ROOT}" ]] || fail "Run from a git repository."
}

infer_branch_from_slice() {
  [[ -n "${SLICE_ID}" ]] || return 0
  [[ -z "${BRANCH_NAME}" ]] || return 0

  local slice_slug candidate matches_count
  slice_slug="$(to_slice_slug "${SLICE_ID}")"
  matches_count=0

  while IFS= read -r candidate; do
    [[ -n "${candidate}" ]] || continue
    matches_count=$((matches_count + 1))
    BRANCH_NAME="${candidate}"
  done < <(git for-each-ref --format='%(refname:short)' "refs/heads/codex/${slice_slug}*")

  if (( matches_count == 0 )); then
    fail "No local branch matches slice '${SLICE_ID}'. Use --branch."
  elif (( matches_count > 1 )); then
    fail "Multiple local branches match slice '${SLICE_ID}'. Use --branch."
  fi
}

resolve_worktree_path() {
  [[ -n "${WORKTREE_PATH}" ]] && return 0
  [[ -n "${BRANCH_NAME}" ]] || fail "Branch not resolved."

  local wt_path="" wt_branch="" line
  while IFS= read -r line; do
    if [[ "${line}" == worktree\ * ]]; then
      wt_path="${line#worktree }"
      wt_branch=""
    elif [[ "${line}" == branch\ refs/heads/* ]]; then
      wt_branch="${line#branch refs/heads/}"
    elif [[ -z "${line}" ]]; then
      if [[ "${wt_branch}" == "${BRANCH_NAME}" ]]; then
        WORKTREE_PATH="${wt_path}"
        return 0
      fi
      wt_path=""
      wt_branch=""
    fi
  done < <(git -C "${REPO_ROOT}" worktree list --porcelain; echo)
}

ensure_not_current_worktree() {
  local cwd
  cwd="$(pwd -P)"
  if [[ -n "${WORKTREE_PATH}" && "${cwd}" == "${WORKTREE_PATH}" ]]; then
    fail "You are inside the target worktree. Run cleanup from integration worktree."
  fi
}

collect_danger_state() {
  DIRTY_WORKTREE="false"
  DIRTY_COUNT=0
  DIRTY_PREVIEW=""
  LOCAL_AHEAD_COUNT=0

  if [[ -n "${WORKTREE_PATH}" && -d "${WORKTREE_PATH}" ]]; then
    local status_lines
    status_lines="$(git -C "${WORKTREE_PATH}" status --porcelain 2>/dev/null || true)"
    if [[ -n "${status_lines}" ]]; then
      DIRTY_WORKTREE="true"
      DIRTY_COUNT="$(printf '%s\n' "${status_lines}" | sed '/^$/d' | wc -l | tr -d ' ')"
      DIRTY_PREVIEW="$(printf '%s\n' "${status_lines}" | sed -n '1,10p')"
    fi
  fi

  if git -C "${REPO_ROOT}" show-ref --verify --quiet "refs/remotes/origin/${BRANCH_NAME}"; then
    local counts
    counts="$(git -C "${REPO_ROOT}" rev-list --left-right --count "origin/${BRANCH_NAME}...${BRANCH_NAME}" 2>/dev/null || true)"
    if [[ "${counts}" =~ ^[0-9]+[[:space:]][0-9]+$ ]]; then
      # rev-list --left-right --count A...B => "<left-only> <right-only>"
      LOCAL_AHEAD_COUNT="$(echo "${counts}" | awk '{print $2}')"
    fi
  fi
}

confirm_destructive_if_needed() {
  local warned="false"

  if [[ "${DIRTY_WORKTREE}" == "true" ]]; then
    warned="true"
    echo
    echo "Warning: target worktree has uncommitted changes (${DIRTY_COUNT} file(s))."
    echo "These local changes will be permanently lost if cleanup proceeds."
    echo "${DIRTY_PREVIEW}" | sed 's/^/  /'
  fi

  if [[ "${LOCAL_AHEAD_COUNT}" =~ ^[0-9]+$ ]] && (( LOCAL_AHEAD_COUNT > 0 )); then
    warned="true"
    echo
    echo "Warning: local branch is ahead of origin by ${LOCAL_AHEAD_COUNT} commit(s)."
    echo "Those local-only commits can be lost after cleanup if not merged elsewhere."
  fi

  if [[ "${warned}" == "true" ]]; then
    if [[ "${FORCE}" != "true" ]]; then
      fail "Dangerous cleanup detected. Re-run with --force after reviewing warnings."
    fi

    if [[ "${YES}" != "true" && "${DRY_RUN}" != "true" ]]; then
      confirm "Destructive cleanup confirmed? This may permanently delete local work." || {
        echo "Cancelled."
        exit 0
      }
    fi
  fi
}

is_branch_merged_via_pr() {
  local branch="$1"

  command -v gh >/dev/null 2>&1 || return 1
  gh auth status >/dev/null 2>&1 || return 1

  local remote_url repo
  remote_url="$(git -C "${REPO_ROOT}" remote get-url origin 2>/dev/null || true)"
  [[ -n "${remote_url}" ]] || return 1
  repo="$(echo "${remote_url}" | sed -E 's#^git@github.com:##; s#^https://github.com/##; s#\.git$##')"
  [[ -n "${repo}" ]] || return 1

  local merged_count
  merged_count="$(gh pr list --repo "${repo}" --head "${branch}" --state merged --limit 1 --json number --jq 'length' 2>/dev/null || echo "0")"
  [[ "${merged_count}" =~ ^[0-9]+$ ]] || return 1
  (( merged_count > 0 ))
}

ensure_branch_merged() {
  [[ "${FORCE}" == "true" ]] && return 0

  git -C "${REPO_ROOT}" fetch origin "${BASE_BRANCH}" >/dev/null 2>&1 || true

  local merge_target="${BASE_BRANCH}"
  if git -C "${REPO_ROOT}" show-ref --verify --quiet "refs/remotes/origin/${BASE_BRANCH}"; then
    merge_target="origin/${BASE_BRANCH}"
  elif ! git -C "${REPO_ROOT}" show-ref --verify --quiet "refs/heads/${BASE_BRANCH}"; then
    fail "Base branch '${BASE_BRANCH}' not found locally or on origin."
  fi

  if ! git -C "${REPO_ROOT}" show-ref --verify --quiet "refs/heads/${BRANCH_NAME}"; then
    fail "Branch '${BRANCH_NAME}' not found locally."
  fi

  if ! git -C "${REPO_ROOT}" merge-base --is-ancestor "${BRANCH_NAME}" "${merge_target}"; then
    if is_branch_merged_via_pr "${BRANCH_NAME}"; then
      echo "Info: branch '${BRANCH_NAME}' is not an ancestor of '${merge_target}', but a merged PR was found."
      return 0
    fi
    fail "Branch '${BRANCH_NAME}' is not merged into '${merge_target}'. Use --force if intentional."
  fi
}

print_plan() {
  echo "Cleanup plan:"
  echo "  Base branch: ${BASE_BRANCH}"
  echo "  Slice:       ${SLICE_ID:-<n/a>}"
  echo "  Branch:      ${BRANCH_NAME}"
  if [[ -n "${WORKTREE_PATH}" ]]; then
    echo "  Worktree:    ${WORKTREE_PATH}"
  else
    echo "  Worktree:    <not attached>"
  fi
  echo "  Delete remote branch: ${DELETE_REMOTE}"
}

run_cleanup() {
  if [[ -n "${WORKTREE_PATH}" ]]; then
    local wt_remove_cmd=(git -C "${REPO_ROOT}" worktree remove "${WORKTREE_PATH}")
    if [[ "${FORCE}" == "true" ]]; then
      wt_remove_cmd=(git -C "${REPO_ROOT}" worktree remove --force "${WORKTREE_PATH}")
    fi

    if [[ "${DRY_RUN}" == "true" ]]; then
      if [[ "${FORCE}" == "true" ]]; then
        echo "[dry-run] git -C \"${REPO_ROOT}\" worktree remove --force \"${WORKTREE_PATH}\""
      else
        echo "[dry-run] git -C \"${REPO_ROOT}\" worktree remove \"${WORKTREE_PATH}\""
      fi
    else
      "${wt_remove_cmd[@]}"
    fi
  fi

  local branch_delete_cmd=(git -C "${REPO_ROOT}" branch -d "${BRANCH_NAME}")
  if [[ "${FORCE}" == "true" ]]; then
    branch_delete_cmd=(git -C "${REPO_ROOT}" branch -D "${BRANCH_NAME}")
  fi

  if [[ "${DRY_RUN}" == "true" ]]; then
    if [[ "${FORCE}" == "true" ]]; then
      echo "[dry-run] git -C \"${REPO_ROOT}\" branch -D \"${BRANCH_NAME}\""
    else
      echo "[dry-run] git -C \"${REPO_ROOT}\" branch -d \"${BRANCH_NAME}\""
    fi
  else
    "${branch_delete_cmd[@]}"
  fi

  if [[ "${DELETE_REMOTE}" == "true" ]]; then
    if [[ "${DRY_RUN}" == "true" ]]; then
      echo "[dry-run] git -C \"${REPO_ROOT}\" push origin --delete \"${BRANCH_NAME}\""
    else
      git -C "${REPO_ROOT}" push origin --delete "${BRANCH_NAME}"
    fi
  fi
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --slice) SLICE_ID="$2"; shift 2 ;;
      --branch) BRANCH_NAME="$2"; shift 2 ;;
      --worktree) WORKTREE_PATH="$2"; shift 2 ;;
      --base) BASE_BRANCH="$2"; shift 2 ;;
      --delete-remote) DELETE_REMOTE="true"; shift ;;
      --force) FORCE="true"; shift ;;
      --yes) YES="true"; shift ;;
      --dry-run) DRY_RUN="true"; shift ;;
      -h|--help) usage; exit 0 ;;
      *) fail "Unknown argument: $1" ;;
    esac
  done
}

main() {
  parse_args "$@"
  require_tools
  detect_repo_root

  if [[ -z "${SLICE_ID}" && -z "${BRANCH_NAME}" ]]; then
    fail "Provide --slice or --branch."
  fi

  infer_branch_from_slice
  [[ -n "${BRANCH_NAME}" ]] || fail "Could not resolve branch."
  resolve_worktree_path
  ensure_not_current_worktree
  ensure_branch_merged
  collect_danger_state
  print_plan
  confirm_destructive_if_needed

  if [[ "${YES}" != "true" && "${DRY_RUN}" != "true" ]]; then
    confirm "Proceed with cleanup?" || {
      echo "Cancelled."
      exit 0
    }
  fi

  run_cleanup
  echo "Cleanup complete."
}

main "$@"
