---
name: github-project-execution
description: >
  Plan and execute work using a hybrid model: roadmap in Markdown and actionable delivery in GitHub Issues + GitHub Project columns.
  Use this skill when users ask to create phases, split work into slices/tasks, seed issues, manage project board columns,
  track status/progress, reconcile roadmap vs issue state, or define reusable planning methodology.
---

# GitHub Project Execution Methodology

Use this skill to keep planning scalable and execution auditable.

## Default Model

Use a hybrid source of truth:

1. **Roadmap docs (`.md`)** for strategy and phase outcomes.
2. **GitHub Issues + Project board** for executable work and current status.

Do not track day-to-day execution in large Markdown checklists.

## Canonical Rules

- Roadmap docs define: phases, outcomes, acceptance gates.
- Issues define: ownership, dependencies, paths touched, behavior contract, test plan, DoD.
- Project board defines: live status (`Backlog`, `Ready`, `In Progress`, `Blocked`, `Review`, `Done`).
- PRs and commits must link back to issue IDs.

## Required Issue Shape

When creating/updating execution issues, use this structure:

```text
Slice ID: P{phase}-{domain}-{n}
Owner: <agent or person>
Depends on: <slice IDs or None>
Touches: <explicit paths>
Behavior contract:
Given <starting state>
When <action>
Then <outcome>
And <boundary/negative expectation>
Test plan: <exact tests/files>
Definition of done: <user-visible result>
```

## Status Transition Policy

Use this transition model:

- `Backlog` -> `Ready`: issue is refined and unblocked.
- `Ready` -> `In Progress`: work has started.
- `In Progress` -> `Blocked`: active blocker prevents progress.
- `Blocked` -> `In Progress`: blocker removed.
- `In Progress` -> `Review`: implementation complete, awaiting review.
- `Review` -> `Done`: PR merged and acceptance checks pass.

Never skip directly from `Ready` to `Done`.

## Operational Workflow

1. Read roadmap and identify next unfinished outcomes.
2. Discover existing open issues and avoid duplicates.
3. Create or update issues using the required shape.
4. Add/update issues on project board with correct status.
5. Keep issue comments updated with handoffs (done/next/blockers).
6. Reconcile board state regularly against roadmap progress.

## LLM Behavioral Contract

When this skill applies, always:

- Check existing issues before creating new ones.
- Prefer updating stale/near-duplicate issues over creating duplicates.
- Set/confirm correct project status for every touched issue.
- Report what was created, updated, skipped, and why.
- If project status update fails (permissions/API), report it explicitly.

## Minimal `gh` Command Set

```bash
# List open issues by label
 gh issue list --repo <owner/repo> --label slice --state open

# Create issue
 gh issue create --repo <owner/repo> --title "..." --body-file /tmp/body.md --label slice

# Add issue to project
 gh project item-add <project-number> --owner <owner> --url <issue-url>

# List project items
 gh project item-list <project-number> --owner <owner> --format json

# Update project status field
 gh project item-edit --id <item-id> --project-id <project-id> --field-id <field-id> --single-select-option-id <option-id>
```

## Reuse Guidance

This skill is repository-local by default. To reuse across projects, copy this folder:

- `.claude/skills/github-project-execution/`

Then update project-specific labels/statuses if needed.

For practical templates and reconciliation checklists, see `references/methodology.md`.
