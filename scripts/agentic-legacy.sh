#!/usr/bin/env bash
# High-level human operator orchestrator for local agentic workflow.
# Calls lower-level scripts in ./scripts.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_DIR="${ROOT_DIR}/scripts"

BOOTSTRAP_SCRIPT="${SCRIPTS_DIR}/gh-bootstrap.sh"
START_SCRIPT="${SCRIPTS_DIR}/start-agent-session.sh"
NEW_SLICE_SCRIPT="${SCRIPTS_DIR}/new-slice-worktree.sh"
FINISH_SCRIPT="${SCRIPTS_DIR}/finish-slice-session.sh"
CLEANUP_SCRIPT="${SCRIPTS_DIR}/cleanup-slice-worktree.sh"
P0_SCRIPT="${SCRIPTS_DIR}/create-p0-issues.sh"
SECURITY_SCRIPT="${SCRIPTS_DIR}/create-security-issues.sh"

REPO_NAME="$(basename "${ROOT_DIR}")"
REMOTE_URL="$(git -C "${ROOT_DIR}" remote get-url origin 2>/dev/null || true)"
if [[ -n "${REMOTE_URL}" ]]; then
  GITHUB_REPO="$(echo "${REMOTE_URL}" | sed -E 's#^git@github.com:##; s#^https://github.com/##; s#\.git$##')"
else
  GITHUB_REPO="luisnomad/idea2real"
fi

PROJECT_OWNER="${PROJECT_OWNER:-${GITHUB_REPO%%/*}}"
PROJECT_NUMBER="${PROJECT_NUMBER:-1}"
STATUS_FIELD_NAME="${STATUS_FIELD_NAME:-Status}"

PROJECT_ID=""
STATUS_FIELD_ID=""
STATUS_READY_ID=""
STATUS_BACKLOG_ID=""
STATUS_IN_PROGRESS_ID=""
STATUS_BLOCKED_ID=""
STATUS_REVIEW_ID=""
STATUS_DONE_ID=""
PROJECT_CONTEXT_LOADED="false"

SELECTED_BRANCH=""
SELECTED_PATH=""
SLICE_WORKTREE_LINES=()

usage() {
  cat <<'USAGE'
Human operator command center for local agentic workflow.

Usage:
  ./agentic.sh

This menu wraps:
  - GitHub bootstrap
  - Issue seeding (P0 + security)
  - Session start/resume
  - Direct worktree creation
  - Close slice (tests -> optional commit -> finish -> Review)
  - PR feedback loop (comments/requests/checks/conflicts)
  - Merge and clean (merge PR -> Done -> cleanup -> start next)
  - Standalone cleanup
  - Doctor checks
  - Health/status checks
USAGE
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

run_script() {
  local script_path="$1"
  shift || true
  [[ -x "${script_path}" ]] || fail "Missing executable script: ${script_path}"
  "${script_path}" "$@"
}

is_transient_gh_error() {
  local text="$1"
  printf '%s' "${text}" | rg -qi '(502|503|504|Bad Gateway|temporar|timed out|timeout|connection reset|TLS handshake|EOF)'
}

gh_retry() {
  local max_attempts="${GH_RETRY_COUNT:-4}"
  local sleep_seconds="${GH_RETRY_SLEEP_SECONDS:-2}"
  local attempt output rc

  for ((attempt = 1; attempt <= max_attempts; attempt++)); do
    if output="$(gh "$@" 2>&1)"; then
      printf '%s' "${output}"
      return 0
    fi
    rc=$?

    if (( attempt < max_attempts )) && is_transient_gh_error "${output}"; then
      echo "Transient GitHub API error (attempt ${attempt}/${max_attempts}). Retrying in ${sleep_seconds}s..." >&2
      sleep "${sleep_seconds}"
      continue
    fi

    printf '%s\n' "${output}" >&2
    return "${rc}"
  done

  return 1
}

to_slug() {
  echo "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g'
}

to_slice_id() {
  echo "$1" | tr '[:lower:]' '[:upper:]'
}

extract_slice_from_branch() {
  local branch="$1"
  if [[ "${branch}" =~ ^codex/([a-z0-9]+-[a-z0-9]+-[0-9]+) ]]; then
    to_slice_id "${BASH_REMATCH[1]}"
  else
    echo ""
  fi
}

extract_slice_from_title() {
  local title="$1"
  if [[ "${title}" =~ (P[0-9]+-[A-Z0-9]+-[0-9]+) ]]; then
    echo "${BASH_REMATCH[1]}"
  else
    echo ""
  fi
}

pause() {
  echo
  read -r -p "Press Enter to continue..."
}

read_multiline_block() {
  local prompt="$1"
  local line
  local out=""

  echo "${prompt}"
  echo "End with a single '.' on its own line."
  while IFS= read -r line; do
    [[ "${line}" == "." ]] && break
    out+="${line}"$'\n'
  done
  printf '%s' "${out}"
}

print_header() {
  clear || true
  echo "== idea2real Human Command Center =="
  echo "Repo: ${GITHUB_REPO}"
  echo "Project: ${PROJECT_OWNER}#${PROJECT_NUMBER}"
  echo "Root: ${ROOT_DIR}"
  echo
}

require_gh_auth() {
  command -v gh >/dev/null 2>&1 || fail "gh is required"
  gh_retry auth status >/dev/null 2>&1 || fail "gh is not authenticated. Run option 1 first."
}

load_project_context() {
  [[ "${PROJECT_CONTEXT_LOADED}" == "true" ]] && return 0

  require_gh_auth
  command -v jq >/dev/null 2>&1 || fail "jq is required for project status automation"

  gh_retry project view "${PROJECT_NUMBER}" --owner "${PROJECT_OWNER}" >/dev/null 2>&1 || {
    fail "Cannot access project ${PROJECT_OWNER}#${PROJECT_NUMBER}. Run option 1 first."
  }

  PROJECT_ID="$(gh_retry project view "${PROJECT_NUMBER}" --owner "${PROJECT_OWNER}" --format json --jq '.id // empty' 2>/dev/null || true)"
  [[ -n "${PROJECT_ID}" ]] || fail "Could not read project id"

  local fields_json
  fields_json="$(gh_retry project field-list "${PROJECT_NUMBER}" --owner "${PROJECT_OWNER}" --format json 2>/dev/null || true)"
  [[ -n "${fields_json}" ]] || fail "Could not read project fields"

  STATUS_FIELD_ID="$(echo "${fields_json}" | jq -r --arg n "${STATUS_FIELD_NAME}" '
    if type=="array" then
      (map(select(.name==$n))[0].id // "")
    elif has("fields") then
      (.fields | map(select(.name==$n))[0].id // "")
    else
      ""
    end
  ')"

  [[ -n "${STATUS_FIELD_ID}" ]] || fail "Could not find status field '${STATUS_FIELD_NAME}'"

  STATUS_READY_ID="$(echo "${fields_json}" | jq -r --arg n "${STATUS_FIELD_NAME}" '
    if type=="array" then
      (map(select(.name==$n))[0].options // [] | map(select(.name=="Ready"))[0].id // "")
    elif has("fields") then
      (.fields | map(select(.name==$n))[0].options // [] | map(select(.name=="Ready"))[0].id // "")
    else
      ""
    end
  ')"
  STATUS_BACKLOG_ID="$(echo "${fields_json}" | jq -r --arg n "${STATUS_FIELD_NAME}" '
    if type=="array" then
      (map(select(.name==$n))[0].options // [] | map(select(.name=="Backlog"))[0].id // "")
    elif has("fields") then
      (.fields | map(select(.name==$n))[0].options // [] | map(select(.name=="Backlog"))[0].id // "")
    else
      ""
    end
  ')"
  STATUS_IN_PROGRESS_ID="$(echo "${fields_json}" | jq -r --arg n "${STATUS_FIELD_NAME}" '
    if type=="array" then
      (map(select(.name==$n))[0].options // [] | map(select(.name=="In Progress"))[0].id // "")
    elif has("fields") then
      (.fields | map(select(.name==$n))[0].options // [] | map(select(.name=="In Progress"))[0].id // "")
    else
      ""
    end
  ')"
  STATUS_BLOCKED_ID="$(echo "${fields_json}" | jq -r --arg n "${STATUS_FIELD_NAME}" '
    if type=="array" then
      (map(select(.name==$n))[0].options // [] | map(select(.name=="Blocked"))[0].id // "")
    elif has("fields") then
      (.fields | map(select(.name==$n))[0].options // [] | map(select(.name=="Blocked"))[0].id // "")
    else
      ""
    end
  ')"
  STATUS_REVIEW_ID="$(echo "${fields_json}" | jq -r --arg n "${STATUS_FIELD_NAME}" '
    if type=="array" then
      (map(select(.name==$n))[0].options // [] | map(select(.name=="Review"))[0].id // "")
    elif has("fields") then
      (.fields | map(select(.name==$n))[0].options // [] | map(select(.name=="Review"))[0].id // "")
    else
      ""
    end
  ')"
  STATUS_DONE_ID="$(echo "${fields_json}" | jq -r --arg n "${STATUS_FIELD_NAME}" '
    if type=="array" then
      (map(select(.name==$n))[0].options // [] | map(select(.name=="Done"))[0].id // "")
    elif has("fields") then
      (.fields | map(select(.name==$n))[0].options // [] | map(select(.name=="Done"))[0].id // "")
    else
      ""
    end
  ')"

  PROJECT_CONTEXT_LOADED="true"
}

status_option_id() {
  local status="$1"
  case "${status}" in
    Ready) echo "${STATUS_READY_ID}" ;;
    Backlog) echo "${STATUS_BACKLOG_ID}" ;;
    "In Progress") echo "${STATUS_IN_PROGRESS_ID}" ;;
    Blocked) echo "${STATUS_BLOCKED_ID}" ;;
    Review) echo "${STATUS_REVIEW_ID}" ;;
    Done) echo "${STATUS_DONE_ID}" ;;
    *) echo "" ;;
  esac
}

resolve_issue_by_slice() {
  local slice="$1"
  ISSUE_NUMBER=""
  ISSUE_TITLE=""
  ISSUE_URL=""

  ISSUE_NUMBER="$(gh_retry issue list \
    --repo "${GITHUB_REPO}" \
    --label "slice" \
    --state all \
    --search "\"${slice}:\" in:title" \
    --limit 1 \
    --json number \
    --jq '.[0].number // empty' 2>/dev/null || true)"

  ISSUE_TITLE="$(gh_retry issue list \
    --repo "${GITHUB_REPO}" \
    --label "slice" \
    --state all \
    --search "\"${slice}:\" in:title" \
    --limit 1 \
    --json title \
    --jq '.[0].title // empty' 2>/dev/null || true)"

  ISSUE_URL="$(gh_retry issue list \
    --repo "${GITHUB_REPO}" \
    --label "slice" \
    --state all \
    --search "\"${slice}:\" in:title" \
    --limit 1 \
    --json url \
    --jq '.[0].url // empty' 2>/dev/null || true)"
}

set_project_status_for_issue_url() {
  local issue_url="$1"
  local status="$2"

  [[ -n "${issue_url}" ]] || return 1
  load_project_context

  local option_id
  option_id="$(status_option_id "${status}")"
  [[ -n "${option_id}" ]] || fail "Project status option '${status}' not found"

  local items_json item_id add_json
  items_json="$(gh_retry project item-list "${PROJECT_NUMBER}" --owner "${PROJECT_OWNER}" --limit 500 --format json 2>/dev/null || true)"

  item_id="$(echo "${items_json}" | jq -r --arg u "${issue_url}" '
    if type=="array" then
      (map(select((.content.url // "")==$u))[0].id // "")
    elif has("items") then
      (.items | map(select((.content.url // "")==$u))[0].id // "")
    else
      ""
    end
  ' 2>/dev/null || true)"

  if [[ -z "${item_id}" ]]; then
    add_json="$(gh_retry project item-add "${PROJECT_NUMBER}" --owner "${PROJECT_OWNER}" --url "${issue_url}" --format json 2>/dev/null || true)"
    item_id="$(echo "${add_json}" | jq -r '.id // .item.id // empty' 2>/dev/null || true)"
  fi

  [[ -n "${item_id}" ]] || fail "Could not resolve project item for ${issue_url}"

  gh_retry project item-edit \
    --id "${item_id}" \
    --project-id "${PROJECT_ID}" \
    --field-id "${STATUS_FIELD_ID}" \
    --single-select-option-id "${option_id}" >/dev/null
}

recommended_ready_slices() {
  require_gh_auth
  command -v jq >/dev/null 2>&1 || fail "jq is required for recommended slice lookup"

  gh_retry project view "${PROJECT_NUMBER}" --owner "${PROJECT_OWNER}" >/dev/null 2>&1 || return 0

  local items_json
  items_json="$(gh_retry project item-list "${PROJECT_NUMBER}" --owner "${PROJECT_OWNER}" --limit 500 --format json 2>/dev/null || true)"

  echo "${items_json}" | jq -r '
    def arr: if type=="array" then . elif has("items") then .items else [] end;
    arr[]
    | select((((.content.assignees | length?) // 0) == 0))
    | select((tostring | test("\\\"Ready\\\""; "i")))
    | .content
    | select(.title != null)
    | "\(.number // "")\t\(.title)\t\(.url // "")"
  ' 2>/dev/null || true
}

default_test_cmd_for_slice() {
  local slice="$1"
  case "${slice}" in
    *-WEB-*) echo "pnpm --dir apps/web test" ;;
    *-API-*) echo "pnpm --dir apps/api test" ;;
    *-GEOM-*) echo "pytest -q" ;;
    *-CONTRACTS-*) echo "pnpm --dir packages/contracts test" ;;
    *-UI-*) echo "pnpm --dir packages/ui test" ;;
    *-INFRA-*) echo "pnpm -r test" ;;
    *) echo "" ;;
  esac
}

show_checks() {
  echo "== Checks =="
  if command -v docker >/dev/null 2>&1; then
    if docker info >/dev/null 2>&1; then
      echo "docker: OK (daemon up)"
    else
      echo "docker: found, daemon DOWN"
    fi
  else
    echo "docker: not installed"
  fi

  if command -v gh >/dev/null 2>&1; then
    if gh auth status >/dev/null 2>&1; then
      echo "gh: authenticated"
    else
      echo "gh: installed, not authenticated"
    fi
  else
    echo "gh: not installed"
  fi

  echo
  echo "Active worktrees:"
  git -C "${ROOT_DIR}" worktree list || true

  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    echo
    echo "Open slice issues:"
    gh issue list --repo "${GITHUB_REPO}" --label "slice" --state open --limit 20 || true
  fi
}

agentic_doctor() {
  echo "== Agentic Doctor =="
  local fail_count=0
  local warn_count=0

  doctor_pass() { echo "PASS: $1"; }
  doctor_fail() { echo "FAIL: $1"; echo "  Fix: $2"; fail_count=$((fail_count + 1)); }
  doctor_warn() { echo "WARN: $1"; echo "  Fix: $2"; warn_count=$((warn_count + 1)); }

  local required_scripts=(
    "${BOOTSTRAP_SCRIPT}"
    "${START_SCRIPT}"
    "${NEW_SLICE_SCRIPT}"
    "${FINISH_SCRIPT}"
    "${CLEANUP_SCRIPT}"
    "${P0_SCRIPT}"
    "${SECURITY_SCRIPT}"
  )

  for script in "${required_scripts[@]}"; do
    if [[ -x "${script}" ]]; then
      doctor_pass "Script executable: ${script#${ROOT_DIR}/}"
    else
      doctor_fail "Missing or non-executable script: ${script#${ROOT_DIR}/}" "Run chmod +x or restore script file."
    fi
  done

  if command -v docker >/dev/null 2>&1; then
    if docker info >/dev/null 2>&1; then
      doctor_pass "Docker daemon is running"
    else
      doctor_fail "Docker daemon is not running" "Start Docker Desktop or Docker Engine."
    fi
  else
    doctor_fail "Docker CLI not installed" "Install Docker and ensure docker command is in PATH."
  fi

  if command -v gh >/dev/null 2>&1; then
    doctor_pass "gh CLI installed"
    if gh auth status >/dev/null 2>&1; then
      doctor_pass "gh authenticated"
    else
      doctor_fail "gh not authenticated" "Run ./scripts/gh-bootstrap.sh"
    fi
  else
    doctor_fail "gh CLI not installed" "Install gh: https://cli.github.com/"
  fi

  if command -v jq >/dev/null 2>&1; then
    doctor_pass "jq installed"
  else
    doctor_fail "jq not installed" "Install jq for project/status automation."
  fi

  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    if gh repo view "${GITHUB_REPO}" --json nameWithOwner >/dev/null 2>&1; then
      doctor_pass "Repo access OK (${GITHUB_REPO})"
    else
      doctor_fail "Repo access failed (${GITHUB_REPO})" "Check repo permissions and default remote."
    fi

    if gh project view "${PROJECT_NUMBER}" --owner "${PROJECT_OWNER}" >/dev/null 2>&1; then
      doctor_pass "Project access OK (${PROJECT_OWNER}#${PROJECT_NUMBER})"
    else
      doctor_fail "Project access failed (${PROJECT_OWNER}#${PROJECT_NUMBER})" "Run ./scripts/gh-bootstrap.sh and ensure project scope."
    fi

    local required_labels=(slice phase-0 contracts api geometry frontend infra security phase-5)
    local labels_json
    labels_json="$(gh label list --repo "${GITHUB_REPO}" --limit 200 --json name 2>/dev/null || true)"
    for label in "${required_labels[@]}"; do
      if echo "${labels_json}" | jq -e --arg l "${label}" '.[] | select(.name==$l)' >/dev/null 2>&1; then
        doctor_pass "Label exists: ${label}"
      else
        doctor_fail "Missing label: ${label}" "Run ./scripts/create-p0-issues.sh and/or ./scripts/create-security-issues.sh"
      fi
    done
  fi

  collect_slice_worktrees
  if [[ "${#SLICE_WORKTREE_LINES[@]}" -eq 0 ]]; then
    doctor_warn "No active slice worktrees" "Start a session from option 4 or 5 when ready."
  else
    doctor_pass "Active slice worktrees: ${#SLICE_WORKTREE_LINES[@]}"
  fi

  local seen_slices=""
  local duplicate_slices=""
  local line branch path slice
  for line in "${SLICE_WORKTREE_LINES[@]}"; do
    IFS='|' read -r branch path <<<"${line}"
    slice="$(extract_slice_from_branch "${branch}")"

    if [[ -n "${slice}" ]]; then
      if echo "${seen_slices}" | grep -qx "${slice}"; then
        duplicate_slices+="${slice} "
      else
        seen_slices="${seen_slices}"$'\n'"${slice}"
      fi
    fi

    if [[ -n "$(git -C "${path}" status --porcelain 2>/dev/null || true)" ]]; then
      doctor_warn "Dirty worktree: ${path}" "Commit or stash changes before handoff/finish."
    fi
  done

  if [[ -n "${duplicate_slices}" ]]; then
    doctor_fail "Duplicate active slices detected: ${duplicate_slices}" "Use one active worktree per slice."
  else
    doctor_pass "No duplicate active slice IDs"
  fi

  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1 && command -v jq >/dev/null 2>&1; then
    local ready_count
    ready_count=""

    if gh project view "${PROJECT_NUMBER}" --owner "${PROJECT_OWNER}" >/dev/null 2>&1; then
      local ready_lines
      ready_lines="$(recommended_ready_slices || true)"
      if [[ -n "${ready_lines}" ]]; then
        ready_count="$(printf '%s\n' "${ready_lines}" | sed '/^$/d' | wc -l | tr -d ' ')"
      else
        ready_count="0"
      fi
    else
      doctor_warn "Project access unavailable for Ready-depth check" "Run ./scripts/gh-bootstrap.sh and confirm project permissions."
    fi

    if [[ -n "${ready_count}" ]]; then
      if (( ready_count >= 3 )); then
        doctor_pass "Ready queue depth: ${ready_count}"
      else
        doctor_fail "Ready queue depth low: ${ready_count}" "Run PM replenishment prompt / next phase issue seeding."
      fi
    fi
  fi

  echo
  if (( fail_count == 0 )); then
    echo "Doctor result: PASS"
  else
    echo "Doctor result: FAIL (${fail_count} issue(s), ${warn_count} warning(s))"
  fi
}

create_direct_session() {
  local slice slug slot

  read -r -p "Slice ID (example P0-WEB-1): " slice
  [[ -n "${slice}" ]] || fail "Slice ID is required"

  read -r -p "Topic slug (example app-shell): " slug
  [[ -n "${slug}" ]] || fail "Slug is required"

  read -r -p "Port slot (Enter for auto): " slot

  local cmd=( "${NEW_SLICE_SCRIPT}" --slice "${slice}" --slug "${slug}" --enter )
  if [[ -n "${slot}" ]]; then
    cmd+=( --slot "${slot}" )
  fi

  echo
  echo "Running: ${cmd[*]}"
  "${cmd[@]}"
}

start_guided_session() {
  if confirm "Auto-enter selected/created worktree shell?"; then
    run_script "${START_SCRIPT}" --enter
  else
    run_script "${START_SCRIPT}"
  fi
}

collect_slice_worktrees() {
SLICE_WORKTREE_LINES=()
PR_SELECTED_NUMBER=""
PR_SELECTED_TITLE=""
PR_SELECTED_URL=""
PR_SELECTED_BRANCH=""
PR_SELECTED_STATE=""
MERGE_FLAG=""
  local wt_path="" wt_branch="" line
  while IFS= read -r line; do
    if [[ "${line}" == worktree\ * ]]; then
      wt_path="${line#worktree }"
      wt_branch=""
    elif [[ "${line}" == branch\ refs/heads/* ]]; then
      wt_branch="${line#branch refs/heads/}"
    elif [[ -z "${line}" ]]; then
      if [[ "${wt_branch}" == codex/* ]]; then
        SLICE_WORKTREE_LINES+=("${wt_branch}|${wt_path}")
      fi
      wt_path=""
      wt_branch=""
    fi
  done < <(git -C "${ROOT_DIR}" worktree list --porcelain; echo)
}

pick_slice_worktree() {
  collect_slice_worktrees
  if [[ "${#SLICE_WORKTREE_LINES[@]}" -eq 0 ]]; then
    fail "No active slice worktrees found."
  fi

  local pr_heads_json=""
  if command -v jq >/dev/null 2>&1; then
    pr_heads_json="$(gh_retry pr list \
      --repo "${GITHUB_REPO}" \
      --state all \
      --limit 200 \
      --json number,title,headRefName,state,url 2>/dev/null || echo '[]')"
  fi

  echo "Select slice worktree:"
  local idx=1 line branch path pr_title pr_number pr_state pr_info
  for line in "${SLICE_WORKTREE_LINES[@]}"; do
    IFS='|' read -r branch path <<<"${line}"
    pr_info=""
    if [[ -n "${pr_heads_json}" ]]; then
      pr_title="$(echo "${pr_heads_json}" | jq -r --arg b "${branch}" 'map(select(.headRefName==$b))[0].title // empty' 2>/dev/null || true)"
      pr_number="$(echo "${pr_heads_json}" | jq -r --arg b "${branch}" 'map(select(.headRefName==$b))[0].number // empty' 2>/dev/null || true)"
      pr_state="$(echo "${pr_heads_json}" | jq -r --arg b "${branch}" 'map(select(.headRefName==$b))[0].state // empty' 2>/dev/null || true)"
      if [[ -n "${pr_title}" && -n "${pr_number}" ]]; then
        pr_info=" :: PR #${pr_number} (${pr_state}): ${pr_title}"
      fi
    fi
    echo "  ${idx}) ${branch}${pr_info} :: ${path}"
    idx=$((idx + 1))
  done

  local choice
  read -r -p "Choice: " choice
  [[ "${choice}" =~ ^[0-9]+$ ]] || fail "Invalid choice"
  (( choice >= 1 && choice <= ${#SLICE_WORKTREE_LINES[@]} )) || fail "Choice out of range"

  local selected="${SLICE_WORKTREE_LINES[$((choice - 1))]}"
  IFS='|' read -r SELECTED_BRANCH SELECTED_PATH <<<"${selected}"
}

pick_open_pr() {
  require_gh_auth
  command -v jq >/dev/null 2>&1 || fail "jq is required"

  local prs_json
  prs_json="$(gh_retry pr list \
    --repo "${GITHUB_REPO}" \
    --state open \
    --limit 50 \
    --json number,title,url,headRefName,reviewDecision,mergeStateStatus,mergeable,isDraft)"

  local count
  count="$(echo "${prs_json}" | jq 'length')"
  if (( count == 0 )); then
    fail "No open PRs found."
  fi

  mapfile -t PR_LINES < <(echo "${prs_json}" | jq -r '
    .[] | [
      .number,
      .headRefName,
      .title,
      (if (.reviewDecision // "")=="" then "-" else .reviewDecision end),
      (if (.mergeable // "")=="" then "-" else .mergeable end),
      (if (.mergeStateStatus // "")=="" then "-" else .mergeStateStatus end),
      .url
    ] | @tsv
  ')

  echo "Select open PR:"
  local idx=1 line number branch title decision mergeable merge_state url
  for line in "${PR_LINES[@]}"; do
    IFS=$'\t' read -r number branch title decision mergeable merge_state url <<<"${line}"
    echo "  ${idx}) #${number} [${mergeable}/${merge_state}] [decision:${decision}] ${title}"
    idx=$((idx + 1))
  done

  local choice
  read -r -p "Choice: " choice
  [[ "${choice}" =~ ^[0-9]+$ ]] || fail "Invalid choice"
  (( choice >= 1 && choice <= ${#PR_LINES[@]} )) || fail "Choice out of range"

  local selected="${PR_LINES[$((choice - 1))]}"
  IFS=$'\t' read -r PR_SELECTED_NUMBER PR_SELECTED_BRANCH PR_SELECTED_TITLE _ _ _ PR_SELECTED_URL <<<"${selected}"
  PR_SELECTED_STATE="OPEN"
}

pick_pr_for_merge_cleanup() {
  require_gh_auth
  command -v jq >/dev/null 2>&1 || fail "jq is required"

  local open_json merged_json all_json
  open_json="$(gh_retry pr list \
    --repo "${GITHUB_REPO}" \
    --state open \
    --limit 50 \
    --json number,title,url,headRefName,state,mergeStateStatus,mergeable 2>/dev/null || echo '[]')"
  merged_json="$(gh_retry pr list \
    --repo "${GITHUB_REPO}" \
    --state merged \
    --limit 50 \
    --json number,title,url,headRefName,state,mergeStateStatus,mergeable 2>/dev/null || echo '[]')"
  all_json="$(jq -s '.[0] + .[1]' <(echo "${open_json}") <(echo "${merged_json}"))"

  local count
  count="$(echo "${all_json}" | jq 'length')"
  if (( count == 0 )); then
    fail "No open/merged PRs found."
  fi

  mapfile -t PR_LINES < <(echo "${all_json}" | jq -r '
    .[] | [
      .number,
      .headRefName,
      .title,
      (if (.state // "")=="" then "-" else .state end),
      (if (.mergeable // "")=="" then "-" else .mergeable end),
      (if (.mergeStateStatus // "")=="" then "-" else .mergeStateStatus end),
      .url
    ] | @tsv
  ')

  echo "Select PR for merge/cleanup:"
  local idx=1 line number branch title state mergeable merge_state url
  for line in "${PR_LINES[@]}"; do
    IFS=$'\t' read -r number branch title state mergeable merge_state url <<<"${line}"
    echo "  ${idx}) #${number} [${state}] [${mergeable}/${merge_state}] ${title}"
    idx=$((idx + 1))
  done

  local choice
  read -r -p "Choice: " choice
  [[ "${choice}" =~ ^[0-9]+$ ]] || fail "Invalid choice"
  (( choice >= 1 && choice <= ${#PR_LINES[@]} )) || fail "Choice out of range"

  local selected="${PR_LINES[$((choice - 1))]}"
  IFS=$'\t' read -r PR_SELECTED_NUMBER PR_SELECTED_BRANCH PR_SELECTED_TITLE PR_SELECTED_STATE _ _ PR_SELECTED_URL <<<"${selected}"
}

pick_merged_pr() {
  require_gh_auth
  command -v jq >/dev/null 2>&1 || fail "jq is required"

  local merged_json
  merged_json="$(gh_retry pr list \
    --repo "${GITHUB_REPO}" \
    --state merged \
    --limit 50 \
    --json number,title,url,headRefName,state 2>/dev/null || echo '[]')"

  local count
  count="$(echo "${merged_json}" | jq 'length')"
  if (( count == 0 )); then
    fail "No merged PRs found."
  fi

  mapfile -t PR_LINES < <(echo "${merged_json}" | jq -r '
    .[] | [.number, .headRefName, .title, .state, .url] | @tsv
  ')

  echo "Select merged PR:"
  local idx=1 line number branch title state url local_flag
  for line in "${PR_LINES[@]}"; do
    IFS=$'\t' read -r number branch title state url <<<"${line}"
    if git -C "${ROOT_DIR}" show-ref --verify --quiet "refs/heads/${branch}"; then
      local_flag="local"
    else
      local_flag="remote"
    fi
    echo "  ${idx}) #${number} [${state}] [${local_flag}] ${title}"
    idx=$((idx + 1))
  done

  local choice
  read -r -p "Choice: " choice
  [[ "${choice}" =~ ^[0-9]+$ ]] || fail "Invalid choice"
  (( choice >= 1 && choice <= ${#PR_LINES[@]} )) || fail "Choice out of range"

  local selected="${PR_LINES[$((choice - 1))]}"
  IFS=$'\t' read -r PR_SELECTED_NUMBER PR_SELECTED_BRANCH PR_SELECTED_TITLE PR_SELECTED_STATE PR_SELECTED_URL <<<"${selected}"
}

find_worktree_for_branch() {
  local target_branch="$1"
  local wt_path="" wt_branch="" line
  while IFS= read -r line; do
    if [[ "${line}" == worktree\ * ]]; then
      wt_path="${line#worktree }"
      wt_branch=""
    elif [[ "${line}" == branch\ refs/heads/* ]]; then
      wt_branch="${line#branch refs/heads/}"
    elif [[ -z "${line}" ]]; then
      if [[ "${wt_branch}" == "${target_branch}" ]]; then
        echo "${wt_path}"
        return 0
      fi
      wt_path=""
      wt_branch=""
    fi
  done < <(git -C "${ROOT_DIR}" worktree list --porcelain; echo)
  return 1
}

ensure_worktree_for_branch() {
  local branch="$1"
  local pr_number="$2"

  local existing_path
  existing_path="$(find_worktree_for_branch "${branch}" || true)"
  if [[ -n "${existing_path}" ]]; then
    echo "${existing_path}"
    return 0
  fi

  if ! git -C "${ROOT_DIR}" show-ref --verify --quiet "refs/heads/${branch}"; then
    git -C "${ROOT_DIR}" fetch origin "${branch}:${branch}" >/dev/null 2>&1 || \
      git -C "${ROOT_DIR}" fetch origin "${branch}" >/dev/null 2>&1
  fi

  if ! git -C "${ROOT_DIR}" show-ref --verify --quiet "refs/heads/${branch}"; then
    fail "Branch '${branch}' is not available locally or on origin."
  fi

  local path slug
  slug="$(echo "${branch}" | sed -E 's#[^a-zA-Z0-9]+#-#g; s#^-+|-+$##g' | tr '[:upper:]' '[:lower:]')"
  path="${ROOT_DIR}/../${REPO_NAME}-pr-${pr_number}-${slug}"
  if [[ -e "${path}" ]]; then
    path="${ROOT_DIR}/../${REPO_NAME}-pr-${pr_number}-$(date +%s)"
  fi

  git -C "${ROOT_DIR}" worktree add "${path}" "${branch}" >/dev/null
  echo "${path}"
}

enter_shell_at_path() {
  local path="$1"
  [[ -d "${path}" ]] || fail "Cannot enter missing path: ${path}"
  echo
  echo "Opening shell in: ${path}"
  echo "Tip: type 'exit' to return."
  cd "${path}"
  exec "${SHELL:-bash}" -l
}

post_pr_feedback_round_comment() {
  local pr_number="$1"
  local pr_url="$2"
  local pr_head="$3"
  local mergeable="$4"
  local merge_state="$5"
  local failing_checks_count="$6"
  local pending_checks_count="$7"
  local changes_requested_count="$8"
  local unresolved_threads_count="$9"

  local round_title fixed_md deferred_md rationale_md next_md body
  read -r -p "Round title [PR feedback round]: " round_title
  round_title="${round_title:-PR feedback round}"

  fixed_md="$(read_multiline_block "Fixed now (Markdown allowed):")"
  deferred_md="$(read_multiline_block "Left as-is (Markdown allowed):")"
  rationale_md="$(read_multiline_block "Why left as-is (Markdown allowed):")"
  next_md="$(read_multiline_block "Next actions (Markdown allowed):")"

  [[ -n "${fixed_md//[$'\n'[:space:]]/}" ]] || fixed_md="- None this round."
  [[ -n "${deferred_md//[$'\n'[:space:]]/}" ]] || deferred_md="- Nothing deferred."
  [[ -n "${rationale_md//[$'\n'[:space:]]/}" ]] || rationale_md="- No special rationale required."
  [[ -n "${next_md//[$'\n'[:space:]]/}" ]] || next_md="- Re-run checks and review state."

  body="$(cat <<EOF
### ${round_title}

PR: ${pr_url}
Branch: \`${pr_head}\`
Mergeability: \`${mergeable}\` / \`${merge_state}\`
Checks: fail=${failing_checks_count}, pending=${pending_checks_count}
Feedback: changes_requested=${changes_requested_count}, unresolved_threads=${unresolved_threads_count}

#### Fixed now
${fixed_md}

#### Left as-is
${deferred_md}

#### Why left as-is
${rationale_md}

#### Next actions
${next_md}
EOF
)"

  gh_retry pr comment "${pr_number}" --repo "${GITHUB_REPO}" --body "${body}" >/dev/null
  echo "Posted PR feedback round comment."
}

pr_feedback_loop_flow() {
  require_gh_auth
  command -v jq >/dev/null 2>&1 || fail "jq is required"
  pick_open_pr

  local pr_json
  pr_json="$(gh_retry pr view "${PR_SELECTED_NUMBER}" --repo "${GITHUB_REPO}" \
    --json number,title,url,headRefName,baseRefName,reviewDecision,mergeStateStatus,mergeable,isDraft)"

  local pr_number pr_title pr_url pr_head pr_base review_decision merge_state mergeable is_draft
  pr_number="$(echo "${pr_json}" | jq -r '.number')"
  pr_title="$(echo "${pr_json}" | jq -r '.title')"
  pr_url="$(echo "${pr_json}" | jq -r '.url')"
  pr_head="$(echo "${pr_json}" | jq -r '.headRefName')"
  pr_base="$(echo "${pr_json}" | jq -r '.baseRefName')"
  review_decision="$(echo "${pr_json}" | jq -r 'if (.reviewDecision // "")=="" then "UNSPECIFIED" else .reviewDecision end')"
  merge_state="$(echo "${pr_json}" | jq -r 'if (.mergeStateStatus // "")=="" then "UNKNOWN" else .mergeStateStatus end')"
  mergeable="$(echo "${pr_json}" | jq -r 'if (.mergeable // "")=="" then "UNKNOWN" else .mergeable end')"
  is_draft="$(echo "${pr_json}" | jq -r '.isDraft')"

  local checks_json reviews_json review_comments_json threads_payload unresolved_threads_json
  checks_json="$(gh_retry pr checks "${pr_number}" --repo "${GITHUB_REPO}" --json name,state,bucket,link 2>/dev/null || echo '[]')"
  reviews_json="$(gh_retry api "repos/${GITHUB_REPO}/pulls/${pr_number}/reviews" --paginate 2>/dev/null || echo '[]')"
  review_comments_json="$(gh_retry api "repos/${GITHUB_REPO}/pulls/${pr_number}/comments" --paginate 2>/dev/null || echo '[]')"

  local owner repo
  owner="${GITHUB_REPO%%/*}"
  repo="${GITHUB_REPO##*/}"
  threads_payload="$(gh_retry api graphql \
    -F owner="${owner}" \
    -F repo="${repo}" \
    -F number="${pr_number}" \
    -f query='query($owner:String!,$repo:String!,$number:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$number){reviewThreads(first:100){nodes{id isResolved isOutdated path line originalLine comments(last:1){nodes{author{login} body}}}}}}}' 2>/dev/null || echo '{}')"

  unresolved_threads_json="$(echo "${threads_payload}" | jq '
    [.data.repository.pullRequest.reviewThreads.nodes[]? | select((.isResolved|not) and (.isOutdated|not))]
  ' 2>/dev/null || echo '[]')"

  local failing_checks_count pending_checks_count changes_requested_count review_comments_count unresolved_threads_count
  failing_checks_count="$(echo "${checks_json}" | jq '[.[] | select((.bucket // "")=="fail" or ((.state // "")|ascii_downcase=="failure"))] | length')"
  pending_checks_count="$(echo "${checks_json}" | jq '[.[] | select((.bucket // "")=="pending" or ((.state // "")|ascii_downcase=="pending"))] | length')"
  changes_requested_count="$(echo "${reviews_json}" | jq '[.[] | select(.state=="CHANGES_REQUESTED")] | length')"
  review_comments_count="$(echo "${review_comments_json}" | jq 'length')"
  unresolved_threads_count="$(echo "${unresolved_threads_json}" | jq 'length')"

  echo
  echo "== PR Feedback Loop =="
  echo "PR:      #${pr_number} ${pr_title}"
  echo "URL:     ${pr_url}"
  echo "Branch:  ${pr_head} -> ${pr_base}"
  echo "Draft:   ${is_draft}"
  echo "Review:  ${review_decision}"
  echo "Merge:   ${mergeable} / ${merge_state}"
  echo "Checks:  fail=${failing_checks_count}, pending=${pending_checks_count}"
  echo "Reviews: changes_requested=${changes_requested_count}, inline_comments=${review_comments_count}, unresolved_threads=${unresolved_threads_count}"

  local -a action_items=()
  local status_target="In Progress"
  if [[ "${is_draft}" == "true" ]]; then
    action_items+=("PR is draft; convert to ready when feedback cycle is complete.")
  fi
  if (( failing_checks_count > 0 )); then
    action_items+=("Fix failing CI checks (${failing_checks_count}).")
  fi
  if (( pending_checks_count > 0 )); then
    action_items+=("Wait for pending checks (${pending_checks_count}) or investigate stuck runs.")
  fi
  if (( changes_requested_count > 0 )); then
    action_items+=("Address requested review changes (${changes_requested_count}).")
  fi
  if (( unresolved_threads_count > 0 )); then
    action_items+=("Resolve inline review threads (${unresolved_threads_count}).")
  fi
  if [[ "${mergeable}" == "CONFLICTING" || "${merge_state}" == "DIRTY" ]]; then
    action_items+=("Resolve merge conflicts against ${pr_base}.")
    status_target="Blocked"
  fi

  echo
  if (( ${#action_items[@]} == 0 )); then
    echo "No blocking feedback signals detected. This PR appears merge-ready."
    if confirm "Post a PR feedback round comment now (what was fixed/left as-is/why)?"; then
      post_pr_feedback_round_comment \
        "${pr_number}" \
        "${pr_url}" \
        "${pr_head}" \
        "${mergeable}" \
        "${merge_state}" \
        "${failing_checks_count}" \
        "${pending_checks_count}" \
        "${changes_requested_count}" \
        "${unresolved_threads_count}"
    fi
    return 0
  fi

  echo "Action items:"
  local i item
  i=1
  for item in "${action_items[@]}"; do
    echo "  ${i}) ${item}"
    i=$((i + 1))
  done

  if (( failing_checks_count > 0 )); then
    echo
    echo "Failing checks:"
    echo "${checks_json}" | jq -r '.[] | select((.bucket // "")=="fail" or ((.state // "")|ascii_downcase=="failure")) | "  - \(.name): \(.link // "")"'
  fi

  if (( changes_requested_count > 0 )); then
    echo
    echo "Change-request reviews:"
    echo "${reviews_json}" | jq -r '.[] | select(.state=="CHANGES_REQUESTED") | "  - \(.user.login): \((.body // "" | gsub("\\s+"; " ") | .[0:180]))"'
  fi

  if (( unresolved_threads_count > 0 )); then
    echo
    echo "Unresolved threads (first 10):"
    echo "${unresolved_threads_json}" | jq -r '
      .[:10][] |
      .comments.nodes[0] as $c |
      "  - \(.path // "?"):\((.line // .originalLine // 0)) by \($c.author.login // "unknown"): \((($c.body // "") | gsub("\\s+"; " ") | .[0:160]))"
    '
  fi

  if confirm "Post a PR feedback round comment now (what will be fixed/left as-is/why)?"; then
    post_pr_feedback_round_comment \
      "${pr_number}" \
      "${pr_url}" \
      "${pr_head}" \
      "${mergeable}" \
      "${merge_state}" \
      "${failing_checks_count}" \
      "${pending_checks_count}" \
      "${changes_requested_count}" \
      "${unresolved_threads_count}"
  fi

  if ! confirm "Create/resume a local PR feedback session for this branch now?"; then
    return 0
  fi

  local worktree_path
  worktree_path="$(ensure_worktree_for_branch "${pr_head}" "${pr_number}")"
  echo "Worktree: ${worktree_path}"

  local prompt_dir prompt_file
  prompt_dir="${worktree_path}/.sessions/pr-feedback"
  mkdir -p "${prompt_dir}"
  prompt_file="${prompt_dir}/pr-${pr_number}.md"

  {
    echo "PR: #${pr_number} ${pr_title}"
    echo "URL: ${pr_url}"
    echo "Branch: ${pr_head}"
    echo
    echo "Feedback loop goals:"
    for item in "${action_items[@]}"; do
      echo "- ${item}"
    done
    echo
    echo "Required steps:"
    echo "1) Address reviewer comments and requested changes."
    echo "2) Resolve merge conflicts (if any)."
    echo "3) Run targeted tests/lint for changed files."
    echo "4) Push updates and reply/resolve review threads."
    echo "5) Post a PR comment with: fixed now, left as-is, and why."
    echo "6) Re-run this PR feedback loop and confirm no blockers remain."
  } > "${prompt_file}"

  local slice_id
  slice_id="$(extract_slice_from_title "${pr_title}")"
  if [[ -n "${slice_id}" ]]; then
    resolve_issue_by_slice "${slice_id}"
    if [[ -n "${ISSUE_URL}" ]]; then
      set_project_status_for_issue_url "${ISSUE_URL}" "${status_target}"
    fi
  fi

  echo "Prompt: ${prompt_file}"
  if confirm "Open shell in PR feedback worktree now?"; then
    enter_shell_at_path "${worktree_path}"
  fi
}

close_slice_flow() {
  require_gh_auth
  pick_slice_worktree

  local slice_id test_cmd_input test_cmd done_text next_text blockers_text assignee
  slice_id="$(extract_slice_from_branch "${SELECTED_BRANCH}")"
  [[ -n "${slice_id}" ]] || fail "Could not infer slice ID from branch ${SELECTED_BRANCH}"

  test_cmd="$(default_test_cmd_for_slice "${slice_id}")"

  echo
  echo "Closing slice ${slice_id} from ${SELECTED_PATH}"
  read -r -p "Test command [${test_cmd}] (type 'skip' to skip): " test_cmd_input
  if [[ -n "${test_cmd_input}" ]]; then
    test_cmd="${test_cmd_input}"
  fi

  if [[ -n "${test_cmd}" && "${test_cmd}" != "skip" ]]; then
    echo "Running tests: ${test_cmd}"
    (
      cd "${SELECTED_PATH}"
      bash -lc "${test_cmd}"
    )
  else
    echo "Skipping tests by operator request."
  fi

  if [[ -n "$(git -C "${SELECTED_PATH}" status --porcelain)" ]]; then
    echo
    git -C "${SELECTED_PATH}" status --short
    if confirm "Worktree is dirty. Commit all current changes now?"; then
      local commit_msg
      read -r -p "Commit message [feat(${slice_id}): complete slice]: " commit_msg
      commit_msg="${commit_msg:-feat(${slice_id}): complete slice}"
      (
        cd "${SELECTED_PATH}"
        git add -A
        git commit -m "${commit_msg}"
      )
    else
      fail "Cannot close slice with uncommitted changes."
    fi
  fi

  read -r -p "Done summary: " done_text
  [[ -n "${done_text}" ]] || fail "Done summary is required"
  read -r -p "Next action [Ready for review and merge]: " next_text
  next_text="${next_text:-Ready for review and merge}"
  read -r -p "Blockers [None]: " blockers_text
  blockers_text="${blockers_text:-None}"
  read -r -p "PR assignee [@me]: " assignee
  assignee="${assignee:-@me}"

  (
    cd "${SELECTED_PATH}"
    "${FINISH_SCRIPT}" \
      --done "${done_text}" \
      --next "${next_text}" \
      --blockers "${blockers_text}" \
      --assignee "${assignee}"
  )

  resolve_issue_by_slice "${slice_id}"
  if [[ -n "${ISSUE_URL}" ]]; then
    set_project_status_for_issue_url "${ISSUE_URL}" "Review"
  fi

  local pr_url
  pr_url="$(gh_retry pr list --repo "${GITHUB_REPO}" --head "${SELECTED_BRANCH}" --state open --json url --jq '.[0].url // empty' 2>/dev/null || true)"
  if [[ -z "${pr_url}" ]]; then
    pr_url="$(gh_retry pr list --repo "${GITHUB_REPO}" --head "${SELECTED_BRANCH}" --state all --json url --jq '.[0].url // empty' 2>/dev/null || true)"
  fi

  if [[ -n "${ISSUE_NUMBER}" ]]; then
    gh_retry issue comment "${ISSUE_NUMBER}" --repo "${GITHUB_REPO}" --body "$(cat <<EOF_SUMMARY
### Slice Completion Summary
Slice: ${slice_id}
Branch: ${SELECTED_BRANCH}
Status: Review
Tests: ${test_cmd:-<none>}
PR: ${pr_url:-<not found>}
Done: ${done_text}
Next: ${next_text}
Blockers: ${blockers_text}
EOF_SUMMARY
)" >/dev/null
  fi

  echo
  echo "Close-slice complete."
  if [[ -n "${pr_url}" ]]; then
    echo "PR: ${pr_url}"
  fi
}

pick_merge_method() {
  local method
  echo "Merge method:"
  echo "  1) squash (recommended)"
  echo "  2) merge commit"
  echo "  3) rebase"
  read -r -p "Choose [1]: " method
  method="${method:-1}"
  case "${method}" in
    1) MERGE_FLAG="--squash" ;;
    2) MERGE_FLAG="--merge" ;;
    3) MERGE_FLAG="--rebase" ;;
    *) fail "Invalid merge method" ;;
  esac
}

start_next_recommended_slice() {
  local lines fallback_lines line number title url slice slug

  lines="$(recommended_ready_slices || true)"
  if [[ -z "${lines}" ]]; then
    fallback_lines="$(gh_retry issue list --repo "${GITHUB_REPO}" --label slice --state open --search "no:assignee" --limit 20 --json number,title,url --jq '.[] | "\(.number)\t\(.title)\t\(.url)"' 2>/dev/null || true)"
    lines="${fallback_lines}"
  fi

  local found="false"
  while IFS=$'\t' read -r number title url; do
    [[ -n "${title}" ]] || continue
    slice="$(extract_slice_from_title "${title}")"
    [[ -n "${slice}" ]] || continue

    echo
    echo "Recommended next slice: ${slice} (#${number})"
    echo "Title: ${title}"
    echo "URL:   ${url}"

    if confirm "Start this slice now?"; then
      slug="$(echo "${title}" | sed -E 's/^P[0-9]+-[A-Z0-9]+-[0-9]+:[[:space:]]*//')"
      slug="$(to_slug "${slug}")"
      [[ -n "${slug}" ]] || slug="session"
      "${NEW_SLICE_SCRIPT}" --slice "${slice}" --slug "${slug}" --enter
    fi

    found="true"
    break
  done <<< "${lines}"

  if [[ "${found}" != "true" ]]; then
    echo "No recommended slice found. Run PM replenishment if needed."
  fi
}

merge_and_clean_flow() {
  require_gh_auth
  pick_pr_for_merge_cleanup

  local slice_id
  slice_id="$(extract_slice_from_branch "${PR_SELECTED_BRANCH}")"

  local open_pr_url merged_pr_url
  open_pr_url="$(gh_retry pr list --repo "${GITHUB_REPO}" --head "${PR_SELECTED_BRANCH}" --state open --json url --jq '.[0].url // empty' 2>/dev/null || true)"

  if [[ -n "${open_pr_url}" ]]; then
    echo "Open PR: ${open_pr_url}"
    pick_merge_method
    if ! confirm "Merge this PR now?"; then
      echo "Cancelled."
      return 0
    fi

    gh_retry pr merge "${open_pr_url}" --repo "${GITHUB_REPO}" "${MERGE_FLAG}"
    merged_pr_url="${open_pr_url}"
  else
    merged_pr_url="$(gh_retry pr list --repo "${GITHUB_REPO}" --head "${PR_SELECTED_BRANCH}" --state merged --json url --jq '.[0].url // empty' 2>/dev/null || true)"
    [[ -n "${merged_pr_url}" ]] || fail "No open or merged PR found for ${PR_SELECTED_BRANCH}"
    echo "PR already merged: ${merged_pr_url}"
  fi

  if [[ -n "${slice_id}" ]]; then
    resolve_issue_by_slice "${slice_id}"
  fi
  if [[ -n "${slice_id}" && -n "${ISSUE_URL}" ]]; then
    set_project_status_for_issue_url "${ISSUE_URL}" "Done"
    gh_retry issue comment "${ISSUE_NUMBER}" --repo "${GITHUB_REPO}" --body "$(cat <<EOF_DONE
### Merge and Cleanup Summary
Slice: ${slice_id}
Branch: ${PR_SELECTED_BRANCH}
PR: ${merged_pr_url}
Status: Done
Next: Cleanup executed and next slice recommendation generated.
EOF_DONE
)" >/dev/null
  fi

  local cleanup_cmd=("${CLEANUP_SCRIPT}" --branch "${PR_SELECTED_BRANCH}" --yes --force)
  if confirm "Delete remote branch too?"; then
    cleanup_cmd+=(--delete-remote)
  fi

  echo "Running cleanup..."
  run_script "${cleanup_cmd[@]}"

  start_next_recommended_slice
}

cleanup_flow() {
  local slice_id="" branch_name="" delete_remote="false" mode

  echo "Cleanup mode:"
  echo "  1) Pick active slice worktree (recommended)"
  echo "  2) Pick merged PR"
  echo "  3) Manual entry"
  read -r -p "Choose [1]: " mode
  mode="${mode:-1}"

  case "${mode}" in
    1)
      pick_slice_worktree
      branch_name="${SELECTED_BRANCH}"
      ;;
    2)
      pick_merged_pr
      branch_name="${PR_SELECTED_BRANCH}"
      if ! git -C "${ROOT_DIR}" show-ref --verify --quiet "refs/heads/${branch_name}"; then
        git -C "${ROOT_DIR}" fetch origin "${branch_name}:${branch_name}" >/dev/null 2>&1 || \
          git -C "${ROOT_DIR}" fetch origin "${branch_name}" >/dev/null 2>&1 || true
      fi
      ;;
    3)
      read -r -p "Slice ID (Enter to use branch instead): " slice_id
      if [[ -z "${slice_id}" ]]; then
        read -r -p "Branch name (example codex/p0-web-1-app-shell): " branch_name
        [[ -n "${branch_name}" ]] || fail "Either slice ID or branch is required"
      fi
      ;;
    *)
      fail "Invalid cleanup mode"
      ;;
  esac

  if confirm "Delete remote branch too?"; then
    delete_remote="true"
  fi

  echo
  echo "Dry run:"
  if [[ -n "${slice_id}" ]]; then
    run_script "${CLEANUP_SCRIPT}" --slice "${slice_id}" --dry-run
  else
    run_script "${CLEANUP_SCRIPT}" --branch "${branch_name}" --dry-run
  fi

  if ! confirm "Execute cleanup now?"; then
    echo "Cancelled."
    return 0
  fi

  local cmd=( "${CLEANUP_SCRIPT}" --yes )
  if [[ -n "${slice_id}" ]]; then
    cmd+=( --slice "${slice_id}" )
  else
    cmd+=( --branch "${branch_name}" )
  fi
  if [[ "${delete_remote}" == "true" ]]; then
    cmd+=( --delete-remote )
  fi

  run_script "${cmd[@]}"
}

menu() {
  while true; do
    print_header
    cat <<'MENU'
1) Bootstrap GitHub CLI/project access
2) Seed Phase 0 issues
3) Seed Security issues
4) Start/Resume guided session
5) Create new session directly (and enter worktree shell)
6) Close slice (tests -> optional commit -> finish -> set Review)
7) PR feedback loop (comments/requests/checks/conflicts)
8) Merge and clean (merge PR -> set Done -> cleanup -> start next)
9) Cleanup merged slice worktree/branch (standalone)
10) Run agentic doctor (deep checks)
11) Run health/status checks (quick)
12) Exit
MENU
    echo

    local choice
    read -r -p "Choose an option: " choice

    case "${choice}" in
      1) run_script "${BOOTSTRAP_SCRIPT}" ;;
      2) run_script "${P0_SCRIPT}" ;;
      3) run_script "${SECURITY_SCRIPT}" ;;
      4) start_guided_session ;;
      5) create_direct_session ;;
      6) close_slice_flow ;;
      7) pr_feedback_loop_flow ;;
      8) merge_and_clean_flow ;;
      9) cleanup_flow ;;
      10) agentic_doctor ;;
      11) show_checks ;;
      12) echo "Bye."; exit 0 ;;
      *) echo "Invalid option." ;;
    esac
    pause
  done
}

main() {
  if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
    exit 0
  fi
  menu
}

main "$@"
