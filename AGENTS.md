# idea2real — Agent Instructions

This file is read by Codex, Claude Code, GitHub Copilot, and any other AI agent working on this codebase.

## Project

Web platform for 3D-printer users to convert images into printable STL models. See `docs/project/DEVELOPMENT_PLAN.md` for the full roadmap.

## Architecture

- **Frontend** (`apps/web`): React 19, TypeScript, Vite, Tailwind v4, shadcn/ui, React Three Fiber
- **Core API** (`apps/api`): Hono, Drizzle ORM, PostgreSQL, BullMQ, fal.ai SDK
- **Geometry service** (`services/geometry`): FastAPI, trimesh, pymeshlab
- **Shared contracts** (`packages/contracts`): Zod schemas, generated types, API clients
- **Design system** (`packages/ui`): Shared UI components

## Rules for All Agents

### Ownership Boundaries

Each agent works within its assigned slice. Do NOT modify files outside your slice's declared paths without updating the contract first.

| Domain | Paths | Notes |
|--------|-------|-------|
| Frontend | `apps/web/**` | UI, viewer, state, frontend tests |
| Core API | `apps/api/**` | Auth, orchestration, provider adapters |
| Geometry | `services/geometry/**` | Mesh processing, geometry tests |
| Contracts | `packages/contracts/**` | Shared schemas, generated types |
| UI Kit | `packages/ui/**` | Design system components |
| Infra | `docker-compose*.yml`, `.github/**`, `scripts/**` | CI, local dev, deployment |

**Only one agent owns database migrations at a time.**

### Local Parallel Mode (Default)

This repo is operated locally with parallel sessions (Codex threads and Claude Code terminals).

- One session = one branch + one git worktree
- Never share a branch across active sessions
- Shared infra services run once from the integration worktree
- Session-level ports must be unique to avoid conflicts

Detailed runbook: `docs/project/LOCAL_PARALLEL_WORKFLOW.md`

Human operator scripts (do not run these as an agent):
- `scripts/start-agent-session.sh` — interactive session launcher
- `scripts/new-slice-worktree.sh` — worktree/branch/env setup
- `scripts/gh-bootstrap.sh` — one-time GitHub CLI setup

### Branch Naming

```
codex/<phase>-<slice>-<short-topic>
```

Examples: `codex/p0-web-1-app-shell`, `codex/p0-api-1-hono-skeleton`

### Commit Style

- Conventional commits: `feat:`, `fix:`, `test:`, `chore:`, `docs:`
- Prefix with slice ID: `feat(P0-WEB-1): add app shell and routing`
- Keep commits atomic — one logical change per commit

### PR Requirements

- Under 500 lines net change when possible
- Include a behavior contract (`Given/When/Then`) in the PR body
- Include a "Risk note" section
- All tests must pass before requesting review
- Use the PR template at `.github/PULL_REQUEST_TEMPLATE.md`

### TDD Workflow

Every non-trivial change follows this loop:

1. Write behavior contract (`Given/When/Then`)
2. Write failing test
3. Implement minimal code to pass
4. Refactor safely
5. Verify test quality

See `docs/project/MEANINGFUL_TDD_PLAYBOOK.md` for details.

### Contract-First Development

1. Schemas in `packages/contracts` are defined FIRST
2. Consumer agents stub against contract types before provider lands
3. Integration PRs merge only when contract tests pass in all touched services

### Code Style

- TypeScript: strict mode, no `any`, prefer `unknown`
- Python: type hints, ruff for formatting
- Tests: behavior-descriptive names, not implementation details
- No unnecessary comments, docstrings, or abstractions

### What NOT to Do

- Don't modify another slice's public interface without updating contracts first
- Don't change lockfiles unless you're the infra slice owner
- Don't cross domain boundaries during feature work
- Don't add dependencies without justification in the PR description
- Don't skip tests to ship faster

## Slice Template

When picking up work, look for GitHub Issues with this structure:

```
Slice ID: P{phase}-{domain}-{n}
Owner: <agent or person>
Depends on: <slice IDs>
Touches: <explicit paths>
Behavior contract: Given/When/Then
Test plan: <test files to add/update>
Definition of done: <user-visible result>
```

## Key References

- `docs/project/DEVELOPMENT_PLAN.md` — full phase roadmap
- `docs/project/PARALLEL_AGENT_EXECUTION.md` — merge strategy and integration cadence
- `docs/project/LOCAL_PARALLEL_WORKFLOW.md` — local worktree/session operations
- `docs/project/MEANINGFUL_TDD_PLAYBOOK.md` — TDD workflow
- `docs/project/FRONTEND_UI_DIRECTION.md` — UI specs and component map
- `docs/project/SECURITY_BASELINE.md` — production security controls and secure defaults
- `CONTRIBUTING.md` — universal contribution rules
