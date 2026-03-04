#!/usr/bin/env bash
# Finalize a slice session:
# - validates branch/slice state
# - pushes branch
# - creates (or reuses) PR
# - comments handoff summary on the slice issue
# - writes local handoff note
#
# Usage:
#   ./scripts/finish-slice-session.sh --done "..." --next "..."
#
# Optional env vars:
#   REPO=luisnomad/idea2real
#   BASE_BRANCH=main
#   PR_ASSIGNEE=@me
#   PROJECT_OWNER=luisnomad
#   PROJECT_NUMBER=1
#   STATUS_FIELD_NAME=Status

set -euo pipefail

REPO=""
BASE_BRANCH="${BASE_BRANCH:-main}"
PR_ASSIGNEE="${PR_ASSIGNEE:-@me}"
PROJECT_OWNER="${PROJECT_OWNER:-}"
PROJECT_NUMBER="${PROJECT_NUMBER:-1}"
STATUS_FIELD_NAME="${STATUS_FIELD_NAME:-Status}"
SLICE_ID=""
ISSUE_NUMBER=""
DONE_TEXT=""
NEXT_TEXT=""
BLOCKERS_TEXT="None"
NO_PUSH="false"
NO_PR="false"
NO_ISSUE_COMMENT="false"
NO_PROJECT_STATUS="false"
PROJECT_STATUS_UPDATED="false"

usage() {
  cat <<'EOF'
Finalize a slice session and open PR + handoff.

Usage:
  ./scripts/finish-slice-session.sh --done "Implemented X" --next "Await review"

Options:
  --repo <owner/name>      Override GitHub repo (auto-detected from origin if omitted)
  --base <branch>          PR base branch (default: main)
  --assignee <user>        PR assignee (default: @me)
  --project-owner <owner>  GitHub Project owner (default: repo owner)
  --project-number <num>   GitHub Project number (default: 1)
  --status-field-name <n>  Project status field name (default: Status)
  --slice <slice-id>       Override inferred slice (example: P0-INFRA-1)
  --issue <number>         Override resolved issue number
  --done <text>            Handoff "Done" summary
  --next <text>            Handoff "Next" action
  --blockers <text>        Handoff blockers (default: None)
  --no-push                Skip git push
  --no-pr                  Skip PR creation
  --no-issue-comment       Skip issue handoff comment
  --no-project-status      Skip project status move to Review
  -h, --help               Show help
EOF
}

fail() {
  echo "Error: $*" >&2
  exit 1
}

warn() {
  echo "Warning: $*" >&2
}

require_tools() {
  command -v git >/dev/null 2>&1 || fail "git is required"
  command -v gh >/dev/null 2>&1 || fail "gh is required"
  gh auth status >/dev/null 2>&1 || fail "gh is not authenticated. Run: gh auth login"
}

to_slice_id() {
  echo "$1" | tr '[:lower:]' '[:upper:]'
}

detect_repo() {
  if [[ -n "${REPO}" ]]; then
    return 0
  fi

  local remote_url
  remote_url="$(git remote get-url origin 2>/dev/null || true)"
  [[ -n "${remote_url}" ]] || fail "Could not detect origin remote URL. Use --repo."

  REPO="$(echo "${remote_url}" | sed -E 's#^git@github.com:##; s#^https://github.com/##; s#\.git$##')"
  [[ -n "${REPO}" ]] || fail "Could not parse repo from origin URL."

  if [[ -z "${PROJECT_OWNER}" ]]; then
    PROJECT_OWNER="${REPO%%/*}"
  fi
}

detect_branch() {
  CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  [[ "${CURRENT_BRANCH}" != "HEAD" ]] || fail "Detached HEAD is not supported."
  [[ "${CURRENT_BRANCH}" != "main" && "${CURRENT_BRANCH}" != "master" ]] || fail "Run this from your slice branch, not ${CURRENT_BRANCH}."
}

infer_slice_from_branch() {
  if [[ -n "${SLICE_ID}" ]]; then
    SLICE_ID="$(to_slice_id "${SLICE_ID}")"
    return 0
  fi

  if [[ "${CURRENT_BRANCH}" =~ ^codex/([a-z0-9]+-[a-z0-9]+-[0-9]+) ]]; then
    SLICE_ID="$(to_slice_id "${BASH_REMATCH[1]}")"
    return 0
  fi

  fail "Could not infer slice ID from branch '${CURRENT_BRANCH}'. Use --slice."
}

ensure_clean_worktree() {
  if [[ -n "$(git status --porcelain)" ]]; then
    fail "Working tree has uncommitted changes. Commit or stash before finishing."
  fi
}

resolve_issue() {
  if [[ -n "${ISSUE_NUMBER}" ]]; then
    local issue_line=""
    issue_line="$(gh issue view "${ISSUE_NUMBER}" --repo "${REPO}" --json number,title,url --template '{{.number}}{{"\t"}}{{.title}}{{"\t"}}{{.url}}' 2>/dev/null || true)"
    if [[ -n "${issue_line}" ]]; then
      IFS=$'\t' read -r ISSUE_NUMBER ISSUE_TITLE ISSUE_URL <<<"${issue_line}"
    else
      ISSUE_NUMBER=""
      ISSUE_TITLE=""
      ISSUE_URL=""
    fi
  else
    ISSUE_NUMBER="$(gh issue list \
      --repo "${REPO}" \
      --label "slice" \
      --state "all" \
      --search "\"${SLICE_ID}:\" in:title" \
      --limit 1 \
      --json number \
      --jq '.[0].number // empty' 2>/dev/null || true)"
    ISSUE_TITLE="$(gh issue list \
      --repo "${REPO}" \
      --label "slice" \
      --state "all" \
      --search "\"${SLICE_ID}:\" in:title" \
      --limit 1 \
      --json title \
      --jq '.[0].title // empty' 2>/dev/null || true)"
    ISSUE_URL="$(gh issue list \
      --repo "${REPO}" \
      --label "slice" \
      --state "all" \
      --search "\"${SLICE_ID}:\" in:title" \
      --limit 1 \
      --json url \
      --jq '.[0].url // empty' 2>/dev/null || true)"
  fi
}

maybe_prompt_missing_fields() {
  if [[ -z "${DONE_TEXT}" && -t 0 ]]; then
    read -r -p "Done summary: " DONE_TEXT
  fi
  if [[ -z "${NEXT_TEXT}" && -t 0 ]]; then
    read -r -p "Next action: " NEXT_TEXT
  fi
  [[ -n "${DONE_TEXT}" ]] || fail "--done is required"
  [[ -n "${NEXT_TEXT}" ]] || fail "--next is required"
}

push_branch() {
  [[ "${NO_PUSH}" == "true" ]] && return 0
  git push -u origin "${CURRENT_BRANCH}"
}

ensure_pr() {
  PR_URL="$(gh pr list --repo "${REPO}" --head "${CURRENT_BRANCH}" --state open --json url --jq '.[0].url // empty' 2>/dev/null || true)"
  if [[ -n "${PR_URL}" ]]; then
    return 0
  fi

  [[ "${NO_PR}" == "true" ]] && return 0

  local pr_title
  if [[ -n "${ISSUE_TITLE}" ]]; then
    pr_title="${ISSUE_TITLE}"
  else
    pr_title="${SLICE_ID}: complete slice implementation"
  fi

  local pr_body
  pr_body="$(cat <<EOF
## Slice
${SLICE_ID}

## Summary
${DONE_TEXT}

## Next
${NEXT_TEXT}

## Blockers
${BLOCKERS_TEXT}

EOF
)"

  if [[ -n "${ISSUE_NUMBER}" ]]; then
    pr_body="${pr_body}"$'\n'"Closes #${ISSUE_NUMBER}"$'\n'
  fi

  if ! PR_URL="$(gh pr create \
    --repo "${REPO}" \
    --base "${BASE_BRANCH}" \
    --head "${CURRENT_BRANCH}" \
    --title "${pr_title}" \
    --body "${pr_body}" \
    --assignee "${PR_ASSIGNEE}" 2>/dev/null)"; then
    PR_URL="$(gh pr create \
      --repo "${REPO}" \
      --base "${BASE_BRANCH}" \
      --head "${CURRENT_BRANCH}" \
      --title "${pr_title}" \
      --body "${pr_body}")"
  fi
}

build_handoff_body() {
  local commit_sha
  commit_sha="$(git rev-parse HEAD)"

  HANDOFF_BODY="$(cat <<EOF
Slice: ${SLICE_ID}
Branch: ${CURRENT_BRANCH}
Commit: ${commit_sha}
Done: ${DONE_TEXT}
Next: ${NEXT_TEXT}
Blockers: ${BLOCKERS_TEXT}
EOF
)"

  if [[ -n "${PR_URL}" ]]; then
    HANDOFF_BODY="${HANDOFF_BODY}"$'\n'"PR: ${PR_URL}"
  fi
}

comment_issue() {
  [[ "${NO_ISSUE_COMMENT}" == "true" ]] && return 0
  [[ -n "${ISSUE_NUMBER}" ]] || return 0
  gh issue comment "${ISSUE_NUMBER}" --repo "${REPO}" --body "${HANDOFF_BODY}" >/dev/null
}

write_local_handoff() {
  mkdir -p ".sessions/handoffs"
  local handoff_file=".sessions/handoffs/${SLICE_ID}.md"
  {
    echo "${HANDOFF_BODY}"
    if [[ -n "${ISSUE_URL}" ]]; then
      echo "Issue: ${ISSUE_URL}"
    fi
  } > "${handoff_file}"
  echo "Local handoff written: ${handoff_file}"
}

set_project_status_review() {
  [[ "${NO_PROJECT_STATUS}" == "true" ]] && return 0
  [[ -n "${ISSUE_URL}" ]] || return 0

  if ! command -v jq >/dev/null 2>&1; then
    warn "jq is not installed; skipping project status update."
    return 0
  fi

  if ! gh project view "${PROJECT_NUMBER}" --owner "${PROJECT_OWNER}" >/dev/null 2>&1; then
    warn "Cannot access project ${PROJECT_OWNER}#${PROJECT_NUMBER}; skipping project status update."
    return 0
  fi

  local project_id fields_json status_field_id review_option_id items_json item_id add_json
  project_id="$(gh project view "${PROJECT_NUMBER}" --owner "${PROJECT_OWNER}" --format json --jq '.id // empty' 2>/dev/null || true)"
  if [[ -z "${project_id}" ]]; then
    warn "Could not resolve project id for ${PROJECT_OWNER}#${PROJECT_NUMBER}; skipping status update."
    return 0
  fi

  fields_json="$(gh project field-list "${PROJECT_NUMBER}" --owner "${PROJECT_OWNER}" --format json 2>/dev/null || true)"
  if [[ -z "${fields_json}" ]]; then
    warn "Could not read project fields; skipping status update."
    return 0
  fi

  status_field_id="$(echo "${fields_json}" | jq -r --arg n "${STATUS_FIELD_NAME}" '
    if type=="array" then
      (map(select(.name==$n))[0].id // "")
    elif has("fields") then
      (.fields | map(select(.name==$n))[0].id // "")
    else
      ""
    end
  ' 2>/dev/null || true)"
  if [[ -z "${status_field_id}" ]]; then
    warn "Status field '${STATUS_FIELD_NAME}' not found; skipping status update."
    return 0
  fi

  review_option_id="$(echo "${fields_json}" | jq -r --arg n "${STATUS_FIELD_NAME}" '
    if type=="array" then
      (map(select(.name==$n))[0].options // [] | map(select(.name=="Review"))[0].id // "")
    elif has("fields") then
      (.fields | map(select(.name==$n))[0].options // [] | map(select(.name=="Review"))[0].id // "")
    else
      ""
    end
  ' 2>/dev/null || true)"
  if [[ -z "${review_option_id}" ]]; then
    warn "Review option not found in '${STATUS_FIELD_NAME}'; skipping status update."
    return 0
  fi

  items_json="$(gh project item-list "${PROJECT_NUMBER}" --owner "${PROJECT_OWNER}" --limit 500 --format json 2>/dev/null || true)"
  item_id="$(echo "${items_json}" | jq -r --arg u "${ISSUE_URL}" '
    if type=="array" then
      (map(select((.content.url // "")==$u))[0].id // "")
    elif has("items") then
      (.items | map(select((.content.url // "")==$u))[0].id // "")
    else
      ""
    end
  ' 2>/dev/null || true)"

  if [[ -z "${item_id}" ]]; then
    add_json="$(gh project item-add "${PROJECT_NUMBER}" --owner "${PROJECT_OWNER}" --url "${ISSUE_URL}" --format json 2>/dev/null || true)"
    item_id="$(echo "${add_json}" | jq -r '.id // .item.id // empty' 2>/dev/null || true)"
  fi

  if [[ -z "${item_id}" ]]; then
    warn "Could not resolve project item for issue ${ISSUE_URL}; skipping status update."
    return 0
  fi

  if ! gh project item-edit \
    --id "${item_id}" \
    --project-id "${project_id}" \
    --field-id "${status_field_id}" \
    --single-select-option-id "${review_option_id}" >/dev/null 2>&1; then
    warn "Failed to set project status to Review for ${ISSUE_URL}."
    return 0
  fi

  PROJECT_STATUS_UPDATED="true"
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --repo) REPO="$2"; shift 2 ;;
      --base) BASE_BRANCH="$2"; shift 2 ;;
      --assignee) PR_ASSIGNEE="$2"; shift 2 ;;
      --project-owner) PROJECT_OWNER="$2"; shift 2 ;;
      --project-number) PROJECT_NUMBER="$2"; shift 2 ;;
      --status-field-name) STATUS_FIELD_NAME="$2"; shift 2 ;;
      --slice) SLICE_ID="$2"; shift 2 ;;
      --issue) ISSUE_NUMBER="$2"; shift 2 ;;
      --done) DONE_TEXT="$2"; shift 2 ;;
      --next) NEXT_TEXT="$2"; shift 2 ;;
      --blockers) BLOCKERS_TEXT="$2"; shift 2 ;;
      --no-push) NO_PUSH="true"; shift ;;
      --no-pr) NO_PR="true"; shift ;;
      --no-issue-comment) NO_ISSUE_COMMENT="true"; shift ;;
      --no-project-status) NO_PROJECT_STATUS="true"; shift ;;
      -h|--help) usage; exit 0 ;;
      *) fail "Unknown argument: $1" ;;
    esac
  done
}

main() {
  parse_args "$@"
  require_tools
  detect_repo
  detect_branch
  infer_slice_from_branch
  maybe_prompt_missing_fields
  ensure_clean_worktree
  resolve_issue
  push_branch
  ensure_pr
  build_handoff_body
  comment_issue
  set_project_status_review
  write_local_handoff

  echo
  echo "Slice session finalized."
  echo "Repo: ${REPO}"
  echo "Slice: ${SLICE_ID}"
  if [[ -n "${ISSUE_NUMBER}" ]]; then
    echo "Issue: #${ISSUE_NUMBER} ${ISSUE_URL}"
  else
    echo "Issue: not found (searched by '${SLICE_ID}:')."
  fi
  if [[ -n "${PR_URL}" ]]; then
    echo "PR: ${PR_URL}"
  else
    echo "PR: not created (--no-pr)."
  fi
  if [[ "${PROJECT_STATUS_UPDATED}" == "true" ]]; then
    echo "Project status: moved to Review (${PROJECT_OWNER}#${PROJECT_NUMBER})"
  fi
}

main "$@"
