# Agentic Control Panel

Node-based local control panel for idea2real agentic development.

## Runtime

- Node.js 22+
- pnpm
- `gh`, `docker`, `jq` installed locally

## Commands

```bash
pnpm agentic session start
pnpm agentic session resume
pnpm agentic continue
pnpm agentic solo start --phase P1 --slug api-core --issues "2,3" --delivery-mode phase-pr
pnpm agentic solo resume
pnpm agentic solo add-issues --issues "4,5"
pnpm agentic solo checkpoint --summary "..."
pnpm agentic solo finalize --done "..."
pnpm agentic setup bootstrap-gh
pnpm agentic slice finalize
pnpm agentic pr loop
pnpm agentic pr merge
pnpm agentic cleanup worktree
pnpm agentic pm seed-issues
pnpm agentic pm next-phase --phase P2
pnpm agentic pm next-phase --phase P2 --clean-old
pnpm agentic doctor
pnpm agentic ui dashboard
```

Add `--json` for machine-readable output.

## Architecture

- UI: `src/ui/clack/**`
- Commands: `src/core/commands/**`
- Discovery: `src/core/discovery/**`
- Adapters: `src/adapters/**`
- Status moves: `src/core/status-moves.ts`

## Migration model

This tool wraps existing scripts in `/scripts` for parity-first migration.

Legacy fallback remains available through `scripts/agentic-legacy.sh`.
