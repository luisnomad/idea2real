# Parallel Agent Execution

## Goal

Allow multiple AI agents to implement roadmap slices concurrently with minimal conflicts and predictable integration.

Primary mode for this project is local parallel development. For local machine operations (worktrees, session ownership, ports, shared services), use `LOCAL_PARALLEL_WORKFLOW.md`.

## Repo Boundaries

Use these ownership boundaries to reduce merge collisions:

- `apps/web`: UI, viewer, state management, frontend tests.
- `apps/api`: orchestration, auth, provider adapters, API tests.
- `services/geometry`: mesh processing, geometry tests.
- `packages/contracts`: shared schemas, generated types, API clients.
- `packages/ui`: shared design system components.

Rule: only one agent owns database migrations at a time.

## Contract-First Workflow

1. Agent owning `packages/contracts` defines or updates schemas first.
2. Consumer agents stub against contract types before provider implementation lands.
3. Integration PR merges only when contract tests pass in all touched services.

## Branch and PR Strategy

- Branch naming: `codex/<phase>-<slice>-<short-topic>`.
- PR size target: under 500 lines net change when possible.
- One behavior contract per PR unless changes are tightly coupled.
- Require a short "risk note" in each PR description.

For local runs, each active session uses its own worktree and branch (never shared).

## Solo-Orchestrator Pattern

When using solo mode (`phase-pr`), one orchestrator agent may delegate work to sub-agents.

Rules:

- Delegate by issue or explicit path group only.
- Keep sub-agent path ownership disjoint in each execution round.
- Integrate sub-agent outputs sequentially on the same solo branch.
- If overlap is required, serialize ownership (one sub-agent at a time).
- Keep issue-level traceability even when one PR covers multiple issues.

## Integration Cadence

- Daily contract sync window for `packages/contracts`.
- Twice-weekly integration window for `apps/api` <-> `services/geometry`.
- End-of-phase hardening window focused only on bug fixes and tests.

## Phase Slice Template

Use this template when breaking any phase into parallel tickets:

- Slice ID: `P{phase}-{domain}-{n}`.
- Owner: one agent.
- Depends on: explicit Slice IDs.
- Touches: explicit paths only.
- Behavior contract: one `Given/When/Then`.
- Test plan: exact test files to add/update.
- Definition of done: concrete user-visible result.

## Recommended Initial Slice Set

- `P0-CONTRACTS-1`: baseline schemas and generated clients.
- `P0-API-1`: Hono health/auth skeleton and error envelope.
- `P0-GEOM-1`: FastAPI health and cleanup endpoint stubs.
- `P0-WEB-1`: app shell, routing, and design token setup.
- `P0-INFRA-1`: compose stack, CI matrix, local bootstrap scripts.

## Merge Conflict Prevention Rules

- Avoid cross-domain refactors during active feature phases.
- Do not change another slice's public interface without updating contracts first.
- Freeze package manager lockfile changes to one infra slice at a time.
- Use feature flags for partial vertical slices to keep `main` deployable.
