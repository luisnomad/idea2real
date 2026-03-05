# GitHub Copilot Instructions for idea2real

You are working on idea2real, a platform for turning images into 3D-printable models.

## Read First

- `README.md` for project scope
- `docs/ARCHITECTURE.md` for architectural constraints
- `docs/project/DEVELOPMENT_PLAN.md` for roadmap context
- `CONTRIBUTING.md` for contribution rules
- `.claude/skills/github-project-execution/SKILL.md` for planning/issues/project-board workflow

## Quick Rules

- Keep changes scoped to the requested behavior.
- Add tests for non-trivial logic or regressions.
- Prefer contract-first updates for shared API boundaries.
- Avoid adding dependencies without clear justification.
- For planning and task-tracking work: keep strategy in Markdown, execution in GitHub Issues + Project columns.
- When creating/updating issues, include dependencies, paths touched, behavior contract, test plan, and definition of done.
- Move every touched issue to the correct project status column.

## Stack

- Frontend: React + TypeScript + Vite
- API: Hono + TypeScript
- Geometry: FastAPI + Python
- Contracts: Zod schemas + shared TS types

## Style

- TypeScript strict, no `any`
- Python with type hints
- Behavior-focused tests
- Avoid unnecessary abstractions
