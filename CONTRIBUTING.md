# Contributing to idea2real

These rules apply to all contributors — human and AI agents alike.

If you are operating multiple AI sessions locally, start with `HUMANS.md`.
Fastest way to bootstrap a session: `./scripts/start-agent-session.sh`.
One-time gh setup: `./scripts/gh-bootstrap.sh`.
Security slice seeding: `./scripts/create-security-issues.sh`.

## Getting Started

```bash
# Clone and enter
git clone git@github.com:luisnomad/idea2real.git
cd idea2real

# Start local stack (after Phase 0 infra is ready)
docker compose up -d
pnpm install
pnpm dev
```

## Picking Up Work

1. Find an unassigned GitHub Issue tagged with a slice ID (e.g., `P0-WEB-1`).
2. Assign yourself (or declare ownership in a comment).
3. Create a branch/worktree (recommended):
   `./scripts/new-slice-worktree.sh --slice P0-WEB-1 --slug app-shell`
4. Work within the declared paths only.
5. Open a PR when your definition of done is met.

For local multi-session setup and worktree commands, see `docs/project/LOCAL_PARALLEL_WORKFLOW.md`.

## Development Workflow

### 1. Contract First

If your work touches API boundaries, update `packages/contracts` first and get that merged (or at least PR'd) before building against it.

### 2. TDD Loop

```
Write behavior contract → Write failing test → Implement → Refactor → Verify
```

No exceptions for non-trivial code. See `docs/project/MEANINGFUL_TDD_PLAYBOOK.md`.

### 3. Branch and Commit

- Branch: `codex/<phase>-<slice>-<short-topic>`
- Commits: `feat(P0-WEB-1): add app shell and routing`
- Keep commits atomic and self-contained
- One active session owns one branch/worktree at a time

### 4. Pull Requests

Use the PR template. Every PR must include:

- [ ] Behavior contract (`Given/When/Then`)
- [ ] Risk note (what could go wrong)
- [ ] All tests passing
- [ ] No files outside your declared paths modified

Target: under 500 lines net change.

## Ownership Boundaries

| Domain | Paths |
|--------|-------|
| Frontend | `apps/web/**` |
| Core API | `apps/api/**` |
| Geometry | `services/geometry/**` |
| Contracts | `packages/contracts/**` |
| UI Kit | `packages/ui/**` |
| Infra | `docker-compose*.yml`, `.github/**`, `scripts/**` |

Only one agent/person owns database migrations at a time.

## Code Quality

- TypeScript: strict mode, no `any`, prefer `unknown`
- Python: type hints, ruff formatting
- Tests: behavior-descriptive names
- No unnecessary comments, docstrings, or abstractions
- No dependencies added without justification

## Integration Cadence

- Daily: contract sync window for `packages/contracts`
- Twice weekly: integration window for `apps/api` ↔ `services/geometry`
- End of phase: hardening window (bug fixes and tests only)
