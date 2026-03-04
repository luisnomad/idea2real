---
name: agentic-solo-operator
description: Operate idea2real in single-agent sprint mode using the `agentic solo` command set (start/resume/checkpoint/finalize) and PM prep (`agentic pm next-phase`). Use when one LLM should self-manage a sprint branch without worktrees while keeping GitHub issues and project statuses synchronized.
---

# Agentic Solo Operator

Use this skill when the user wants one agent to drive a whole sprint with minimal human orchestration.

## Preconditions

1. Run `agentic doctor --quick --json` and stop on `status=error`.
2. Confirm repo is clean before `solo start` or `solo finalize`.

## Core Workflow

1. Start or resume sprint:
- `agentic solo start --phase Pn --slug <topic> --issues "1,2,3" --non-interactive --json`
- If already active: `agentic solo resume --non-interactive --json`

2. Implement sprint scope on solo branch:
- Branch naming: `codex/solo-<phase>-<slug>`
- Use meaningful TDD and atomic commits.
- Sub-agents may be used, but only with explicit non-overlapping ownership (by issue or path group).
- Never run two sub-agents against the same file group in the same round; integrate outputs sequentially.

3. Checkpoint regularly:
- `agentic solo checkpoint --summary "..." --next "..." --blockers "None" --json`

4. Finalize when PR-ready:
- `agentic solo finalize --done "..." --next "Review and merge PR" --blockers "None" --json`

5. Review loop if needed:
- `agentic pr loop --pr auto --json`

6. Merge step remains human-approved unless user explicitly delegates it:
- `agentic pr merge --pr auto --method squash --json`

## Status Lifecycle (Expected)

- Solo start/resume => `In Progress`
- Solo finalize => `Review`
- PR merge => `Done`

If status transitions fail, report and continue implementation unless blocked.

## PM Handoff Support

When sprint is near completion, prepare next phase context:
- `agentic pm next-phase --phase P{n+1} --json`

Use generated PM prompt file to create/refine next sprint issues.

## Output Contract

For each command execution, capture and report:

- `status`
- `artifacts` (`branch`, `pr`, `issue`, `handoffFile`)
- `nextSteps`
- any `errors`

## Guardrails

- Do not delete branches/worktrees without explicit user request.
- Do not merge PRs without explicit user permission.
- Do not move issues to `Done` manually; let merge flow handle it.

For command examples and sequencing patterns, see `references/commands.md`.
