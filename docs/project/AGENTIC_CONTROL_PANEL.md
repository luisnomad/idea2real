# Agentic Control Panel (Node + Clack)

## Purpose

Replace the large `agentic.sh` interactive bash menu with a maintainable Node.js command surface while preserving script parity.

## Entry Points

- Human entrypoint: `./agentic.sh`
- Direct CLI: `pnpm agentic`
- Package: `tools/agentic-control`

## Command Contract

```bash
agentic session start
agentic session resume
agentic continue
agentic solo start
agentic solo resume
agentic solo add-issues
agentic solo checkpoint
agentic solo finalize
agentic setup bootstrap-gh
agentic slice finalize
agentic pr loop
agentic pr merge
agentic cleanup worktree
agentic pm seed-issues
agentic pm next-phase
agentic doctor
agentic ui dashboard
```

Global flags (supported per command):

- `--json`
- `--non-interactive`
- `--repo <owner/name>`
- `--project-owner <owner>`
- `--project-number <n>`
- `--status-field-name <name>`

Core selectors:

- `--slice <id>`
- `--issue <number>`
- `--pr <number|auto>`

## JSON Output Contract

```json
{
  "status": "ok | warn | error",
  "action": "agentic <command>",
  "artifacts": {
    "issue": 0,
    "pr": 0,
    "branch": "",
    "worktree": "",
    "handoffFile": ""
  },
  "nextSteps": [],
  "errors": [
    {
      "code": "",
      "message": "",
      "retryable": false,
      "details": ""
    }
  ]
}
```

## Modules

- `src/ui/clack/**`: interactive menu and prompts
- `src/core/commands/**`: command handlers
- `src/core/discovery/**`: slice/worktree/issue discovery and dedup
- `src/core/solo.ts`: solo sprint state persistence (`.sessions/solo/state.json`)
- `src/adapters/gh.ts`: GitHub CLI wrapper with transient retry handling
- `src/adapters/scripts.ts`: parity wrapper for existing bash scripts
- `src/core/status-moves.ts`: project status transitions (`In Progress` -> `Review` -> `Done`)
- `src/core/templates/**`: PR feedback comment templates

## Current Migration Stage

Parity-first hybrid:

1. New Node control plane handles command UX and orchestration.
2. Existing scripts remain execution backend for stable paths.
3. `scripts/agentic-legacy.sh` remains fallback implementation.

## Execution Modes

`parallel` mode:

- Worktree-per-slice.
- Best for multi-agent parallel delivery.
- Typical flow: `session start` (pick next slice) -> `slice finalize` -> PR loop/merge.

`solo` mode:

- Single sprint branch, no extra worktree.
- Commands: `solo start/resume/add-issues/checkpoint/finalize`.
- Default delivery mode: `phase-pr` (single PR with multiple linked issues).
- `continue` resumes active solo sprint or starts the next solo slice if no active solo sprint exists.
- Solo prompts explicitly allow sub-agent delegation with non-overlapping file ownership and sequential integration.
- Best for rapid scaffolding and one-agent sprints.
- Supports autonomous operation with repo-local skill:
  - `.claude/skills/agentic-solo-operator/SKILL.md`

## Phase 2 (Ink)

`agentic ui dashboard` exists as a preview command.

Planned upgrade:

- Ink-based live dashboard with refreshable views for slices, PRs, and check states.
- Keyboard shortcuts for quick routing (resume slice, open PR loop, merge candidate review).
