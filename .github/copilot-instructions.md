# GitHub Copilot Instructions for idea2real

You are working on idea2real, a web platform for 3D-printer users to convert images into printable STL models.

## Read First

- `AGENTS.md` in the repo root — contains all rules for agent behavior, ownership boundaries, branch naming, and TDD workflow.
- `docs/project/DEVELOPMENT_PLAN.md` — full phase roadmap.
- `docs/project/FRONTEND_UI_DIRECTION.md` — UI specs if working on frontend.

## Quick Rules

- Follow ownership boundaries: only touch paths assigned to your slice.
- Branch naming: `codex/<phase>-<slice>-<short-topic>`.
- Commits: conventional style prefixed with slice ID.
- Every change needs a behavior contract and test.
- Contracts in `packages/contracts` are defined before implementation.
- PRs under 500 lines, include behavior contract and risk note.

## Stack

- Frontend: React 19, TypeScript, Vite, Tailwind v4, shadcn/ui, React Three Fiber
- API: Hono, Drizzle ORM, PostgreSQL, BullMQ
- Geometry: FastAPI, trimesh, pymeshlab
- Contracts: Zod schemas with generated types

## Style

- TypeScript strict, no `any`
- Python with type hints, ruff formatting
- Behavior-descriptive test names
- Minimal abstractions, no over-engineering
