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
agentic setup bootstrap-gh
agentic slice finalize
agentic pr loop
agentic pr merge
agentic cleanup worktree
agentic pm seed-issues
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
- `src/adapters/gh.ts`: GitHub CLI wrapper with transient retry handling
- `src/adapters/scripts.ts`: parity wrapper for existing bash scripts
- `src/core/status-moves.ts`: project status transitions (`In Progress` -> `Review` -> `Done`)
- `src/core/templates/**`: PR feedback comment templates

## Current Migration Stage

Parity-first hybrid:

1. New Node control plane handles command UX and orchestration.
2. Existing scripts remain execution backend for stable paths.
3. `scripts/agentic-legacy.sh` remains fallback implementation.

## Phase 2 (Ink)

`agentic ui dashboard` exists as a preview command.

Planned upgrade:

- Ink-based live dashboard with refreshable views for slices, PRs, and check states.
- Keyboard shortcuts for quick routing (resume slice, open PR loop, merge candidate review).
