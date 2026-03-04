#!/usr/bin/env bash
# Human-in-the-loop orchestrator for local agentic sessions.
# - Finds available slice issues per domain
# - Finds resumable sessions from local worktrees and GitHub handoff comments
# - Runs local preflight checks (including Docker daemon)
# - Creates a worktree via scripts/new-slice-worktree.sh
# - Prints and stores a kickoff prompt for Codex/Claude sessions

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && git rev-parse --show-toplevel 2>/dev/null)"
NEW_SLICE_SCRIPT="${REPO_ROOT}/scripts/new-slice-worktree.sh"
LOCAL_HANDOFF_DIR="${REPO_ROOT}/.sessions/handoffs"
mkdir -p "${LOCAL_HANDOFF_DIR}"

REPO_NAME="$(basename "${REPO_ROOT}")"
REMOTE_URL="$(git -C "${REPO_ROOT}" remote get-url origin 2>/dev/null || true)"
if [[ -n "${REMOTE_URL}" ]]; then
  GITHUB_REPO="$(echo "${REMOTE_URL}" | sed -E 's#^git@github.com:##; s#^https://github.com/##; s#\.git$##')"
else
  GITHUB_REPO="luisnomad/idea2real"
fi

HAS_GH="false"
HAS_DOCKER="false"
AUTO_ENTER="false"

ITEM_LINES=()

usage() {
  cat <<'EOF'
Start a local agentic session with human-in-the-loop orchestration.

Usage:
  ./scripts/start-agent-session.sh [--enter]

Options:
  --enter   Open a new shell in the selected/created worktree
  -h        Show help

What it does:
  1) Preflight checks (git, docker, docker daemon, gh auth)
  2) Discovers:
     - Resumable local sessions (worktrees + local handoff files)
     - Resumable GitHub issue handoffs
     - Available open slices (grouped by domain)
  3) Asks what to do
  4) Creates worktree for new slice (if chosen)
  5) Prints and writes kickoff prompt to worktree
EOF
}

fail() {
  echo "Error: $*" >&2
  exit 1
}

to_slug() {
  echo "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g'
}

to_slice_id() {
  echo "$1" | tr '[:lower:]' '[:upper:]'
}

extract_slice_id() {
  local text="$1"
  if [[ "$text" =~ (P[0-9]+-[A-Z]+-[0-9]+) ]]; then
    echo "${BASH_REMATCH[1]}"
  else
    echo ""
  fi
}

domain_from_slice() {
  local slice="$1"
  case "$slice" in
    *-WEB-*) echo "frontend" ;;
    *-API-*) echo "backend-api" ;;
    *-GEOM-*) echo "python-microservice" ;;
    *-CONTRACTS-*) echo "contracts" ;;
    *-UI-*) echo "ui-kit" ;;
    *-INFRA-*) echo "infra" ;;
    *) echo "unknown" ;;
  esac
}

parse_handoff_field() {
  local body="$1"
  local field="$2"
  printf '%s\n' "$body" | awk -v f="$field" '
    index($0, f ":") == 1 {
      sub("^" f ":[[:space:]]*", "", $0)
      print
      exit
    }
  '
}

confirm_continue() {
  local prompt="$1"
  local ans
  read -r -p "$prompt [y/N]: " ans
  case "${ans}" in
    y|Y|yes|YES) return 0 ;;
    *) return 1 ;;
  esac
}

enter_worktree_shell() {
  local path="$1"
  [[ -d "${path}" ]] || fail "Cannot enter missing worktree: ${path}"

  echo
  echo "Opening shell in: ${path}"
  echo "Tip: type 'exit' to return."
  cd "${path}"
  exec "${SHELL:-bash}" -l
}

preflight() {
  echo "== Preflight =="
  command -v git >/dev/null 2>&1 || fail "git is required"
  [[ -x "${NEW_SLICE_SCRIPT}" ]] || fail "Missing executable: ${NEW_SLICE_SCRIPT}"

  if command -v docker >/dev/null 2>&1; then
    HAS_DOCKER="true"
    echo "docker: found"
    if docker info >/dev/null 2>&1; then
      echo "docker daemon: up"
    else
      echo "docker daemon: DOWN"
      if ! confirm_continue "Continue anyway?"; then
        fail "Docker daemon is required for normal local workflow."
      fi
    fi
  else
    echo "docker: not found"
    if ! confirm_continue "Continue anyway?"; then
      fail "Install Docker, then retry."
    fi
  fi

  if command -v gh >/dev/null 2>&1; then
    if gh auth status >/dev/null 2>&1; then
      HAS_GH="true"
      echo "gh: authenticated (${GITHUB_REPO})"
    else
      echo "gh: installed but not authenticated"
    fi
  else
    echo "gh: not installed"
  fi
  echo
}

add_item() {
  # Fields:
  # type|slice|domain|label|extra|issue_number|issue_url|branch|path|next
  ITEM_LINES+=("$1|$2|$3|$4|$5|$6|$7|$8|$9|${10}")
}

has_resume_item_for_slice() {
  local target_slice="$1"
  local line typ slice
  for line in "${ITEM_LINES[@]}"; do
    IFS='|' read -r typ slice _ <<<"${line}"
    if [[ "${slice}" == "${target_slice}" && "${typ}" == resume_* ]]; then
      return 0
    fi
  done
  return 1
}

discover_local_worktrees() {
  local wt_path=""
  local wt_branch=""
  while IFS= read -r line; do
    if [[ "$line" == worktree\ * ]]; then
      wt_path="${line#worktree }"
      wt_branch=""
    elif [[ "$line" == branch\ refs/heads/* ]]; then
      wt_branch="${line#branch refs/heads/}"
    elif [[ -z "$line" ]]; then
      if [[ "$wt_branch" == codex/* ]]; then
        local slice_raw
        slice_raw="$(echo "$wt_branch" | sed -E 's#^codex/([a-z0-9]+-[a-z0-9]+-[0-9]+).*$#\1#')"
        local slice
        slice="$(to_slice_id "${slice_raw}")"
        local domain
        domain="$(domain_from_slice "${slice}")"
        add_item "resume_local" "${slice}" "${domain}" "Local worktree" "${wt_branch}" "" "" "${wt_branch}" "${wt_path}" ""
      fi
      wt_path=""
      wt_branch=""
    fi
  done < <(git -C "${REPO_ROOT}" worktree list --porcelain; echo)
}

discover_local_handoffs() {
  local file
  for file in "${LOCAL_HANDOFF_DIR}"/*.md; do
    [[ -e "${file}" ]] || break
    local body
    body="$(cat "${file}")"
    local slice
    slice="$(parse_handoff_field "${body}" "Slice")"
    local branch
    branch="$(parse_handoff_field "${body}" "Branch")"
    local next
    next="$(parse_handoff_field "${body}" "Next")"
    [[ -n "${slice}" ]] || continue
    local domain
    domain="$(domain_from_slice "${slice}")"
    add_item "resume_handoff_file" "${slice}" "${domain}" "Local handoff file" "${file}" "" "" "${branch}" "" "${next}"
  done
}

discover_github_issues() {
  [[ "${HAS_GH}" == "true" ]] || return 0

  local line
  while IFS=$'\t' read -r number title assignees url; do
    [[ -n "${number}" ]] || continue
    local slice
    slice="$(extract_slice_id "${title}")"
    [[ -n "${slice}" ]] || continue
    local domain
    domain="$(domain_from_slice "${slice}")"

    if [[ "${assignees}" == "0" ]] && ! has_resume_item_for_slice "${slice}"; then
      add_item "start_issue" "${slice}" "${domain}" "#${number} ${title}" "" "${number}" "${url}" "" "" ""
    fi

    local handoff_body
    handoff_body="$(gh issue view "${number}" --repo "${GITHUB_REPO}" \
      --json comments \
      --jq '.comments | map(select((.body|test("(?m)^Slice:")) and (.body|test("(?m)^Next:")))) | last | .body // ""' \
      2>/dev/null || true)"

    if [[ -n "${handoff_body}" ]]; then
      local handoff_next
      handoff_next="$(parse_handoff_field "${handoff_body}" "Next")"
      local handoff_branch
      handoff_branch="$(parse_handoff_field "${handoff_body}" "Branch")"
      add_item "resume_handoff_issue" "${slice}" "${domain}" "#${number} ${title}" "" "${number}" "${url}" "${handoff_branch}" "" "${handoff_next}"
    fi
  done < <(
    gh issue list \
      --repo "${GITHUB_REPO}" \
      --label "slice" \
      --state "open" \
      --limit 200 \
      --json number,title,assignees,url \
      --template '{{range .}}{{.number}}{{"\t"}}{{.title}}{{"\t"}}{{len .assignees}}{{"\t"}}{{.url}}{{"\n"}}{{end}}'
  )
}

print_discovery() {
  echo "== Discovered Sessions/Slices =="
  if [[ "${#ITEM_LINES[@]}" -eq 0 ]]; then
    echo "No items discovered."
    return
  fi

  local i=1
  local line
  for line in "${ITEM_LINES[@]}"; do
    IFS='|' read -r typ slice domain label extra issue_num issue_url branch path next <<<"${line}"
    case "${typ}" in
      resume_local)
        echo "  ${i}) [RESUME][local][${domain}] ${slice} :: ${branch} :: ${path}"
        ;;
      resume_handoff_file)
        echo "  ${i}) [RESUME][handoff-file][${domain}] ${slice} :: next='${next}'"
        ;;
      resume_handoff_issue)
        echo "  ${i}) [RESUME][handoff-issue][${domain}] ${slice} :: ${label} :: next='${next}'"
        ;;
      start_issue)
        echo "  ${i}) [START][available][${domain}] ${slice} :: ${label}"
        ;;
      *)
        echo "  ${i}) [UNKNOWN] ${line}"
        ;;
    esac
    i=$((i + 1))
  done
  echo
}

write_kickoff_prompt() {
  local slice="$1"
  local issue_label="$2"
  local issue_url="$3"
  local worktree_path="$4"
  local next_hint="$5"

  local kickoff_dir="${worktree_path}/.sessions"
  mkdir -p "${kickoff_dir}"
  local kickoff_file="${kickoff_dir}/kickoff-${slice}.md"

  cat > "${kickoff_file}" <<EOF
You own slice ${slice}.

Reference:
- ${issue_label}
- ${issue_url}

Rules:
- Follow AGENTS.md, CONTRIBUTING.md, docs/project/LOCAL_PARALLEL_WORKFLOW.md.
- Touch only allowed paths for this slice.
- Use meaningful TDD (Given/When/Then -> failing test -> minimal fix -> refactor).
- Keep commits atomic and include slice ID in commit message.

First actions:
1) Restate the behavior contract for ${slice}.
2) List files you plan to touch before editing.
3) Implement using the TDD loop and run targeted tests.
4) Summarize changes, residual risks, and next step.
5) Commit all changes on the slice branch.
6) Ensure working tree is clean.
7) Finalize session by running:
   ./scripts/finish-slice-session.sh --done "<summary>" --next "Ready for review and merge" --blockers "None"

Prior handoff hint:
${next_hint}
EOF

  echo "Kickoff prompt written: ${kickoff_file}"
}

choose_item() {
  if [[ "${#ITEM_LINES[@]}" -eq 0 ]]; then
    fail "No discovered items. Create/open slice issues first or add handoff files."
  fi

  local choice
  read -r -p "Choose an item number (q to quit): " choice
  [[ "${choice}" == "q" || "${choice}" == "Q" ]] && exit 0
  [[ "${choice}" =~ ^[0-9]+$ ]] || fail "Invalid choice"
  (( choice >= 1 && choice <= ${#ITEM_LINES[@]} )) || fail "Choice out of range"

  local selected="${ITEM_LINES[$((choice - 1))]}"
  IFS='|' read -r typ slice domain label extra issue_num issue_url branch path next <<<"${selected}"

  case "${typ}" in
    resume_local)
      echo
      echo "Resume local session:"
      echo "  cd \"${path}\""
      echo "  git status --short"
      [[ -n "${next}" ]] && echo "Next hint: ${next}"
      if [[ "${AUTO_ENTER}" == "true" ]]; then
        enter_worktree_shell "${path}"
      fi
      ;;

    resume_handoff_file)
      echo
      echo "Resume from local handoff file: ${extra}"
      if [[ -n "${branch}" && ! -d "${path}" ]]; then
        echo "Branch in handoff: ${branch}"
      fi
      echo "Next hint: ${next}"
      ;;

    resume_handoff_issue|start_issue)
      local default_slug
      default_slug="$(echo "${label}" | sed -E 's/^#[0-9]+[[:space:]]+//; s/^[^:]+:[[:space:]]*//')"
      default_slug="$(to_slug "${default_slug}")"
      [[ -n "${default_slug}" ]] || default_slug="session"

      local slug_input
      read -r -p "Slug [${default_slug}]: " slug_input
      local slug="${slug_input:-${default_slug}}"

      local slot_input
      read -r -p "Port slot (>=1, Enter for auto): " slot_input

      local cmd=( "${NEW_SLICE_SCRIPT}" "--slice" "${slice}" "--slug" "${slug}" )
      if [[ -n "${slot_input}" ]]; then
        cmd+=( "--slot" "${slot_input}" )
      fi

      echo
      echo "Running: ${cmd[*]}"
      "${cmd[@]}"

      local slice_slug
      slice_slug="$(to_slug "${slice}")"
      local worktree_path="${REPO_ROOT}/../${REPO_NAME}-${slice_slug}"

      local next_hint="${next:-No prior handoff available. Start from issue definition of done.}"
      write_kickoff_prompt "${slice}" "${label}" "${issue_url}" "${worktree_path}" "${next_hint}"

      echo
      echo "Session started:"
      echo "  cd \"${worktree_path}\""
      echo "  cat .env.local"
      echo "  cat .sessions/kickoff-${slice}.md"
      if [[ "${AUTO_ENTER}" == "true" ]]; then
        enter_worktree_shell "${worktree_path}"
      fi
      ;;

    *)
      fail "Unsupported item type: ${typ}"
      ;;
  esac
}

manual_start() {
  echo
  echo "No discovered item selected. Manual start mode."
  local slice
  read -r -p "Slice ID (e.g. P0-WEB-1): " slice
  [[ -n "${slice}" ]] || fail "Slice ID required"
  local slug
  read -r -p "Slug: " slug
  [[ -n "${slug}" ]] || fail "Slug required"
  local cmd=( "${NEW_SLICE_SCRIPT}" --slice "${slice}" --slug "${slug}" )
  if [[ "${AUTO_ENTER}" == "true" ]]; then
    cmd+=( --enter )
  fi
  "${cmd[@]}"
}

main() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --enter)
        AUTO_ENTER="true"
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        fail "Unknown argument: $1"
        ;;
    esac
  done

  preflight
  discover_local_worktrees
  discover_local_handoffs
  discover_github_issues
  print_discovery

  if [[ "${#ITEM_LINES[@]}" -eq 0 ]]; then
    if confirm_continue "No discovered items. Start manual mode?"; then
      manual_start
      exit 0
    fi
    exit 0
  fi

  if confirm_continue "Pick from discovered items?"; then
    choose_item
  else
    manual_start
  fi
}

main "$@"
