# AGENTS.md — Instructions for AI Agents

This file tells AI coding agents (Claude Code, Codex, etc.) how to work on this repository.

## Slice ownership

Each agent works on a single named slice. Your slice ID is in `.sessions/kickoff-<SLICE>.md`.
Never edit files outside your slice's allowed paths without explicit instructions.

## Commit discipline

- Every commit message must include the slice ID: `[P0-INFRA-1] Add docker-compose.yml`
- Commits must be atomic — one logical change per commit
- Do not squash or amend commits already pushed to a branch

## TDD workflow

Follow Given/When/Then for every new behaviour:
1. Write a failing test that captures the contract
2. Write the minimal code to make it pass
3. Refactor if needed (keep tests green)

Run `make test` before committing.

## Linting

Run `make lint` before committing. The CI will enforce the same check.
`nb3dp_addon.py` is excluded from linting (Blender addon with Blender-only imports).

## Allowed paths per slice

| Slice | Allowed paths |
|---|---|
| P0-INFRA-1 | `docker-compose.yml`, `.github/`, `scripts/bootstrap.sh`, `Makefile`, `pyproject.toml`, `tests/`, `AGENTS.md`, `CONTRIBUTING.md`, `docs/project/` |

## Do not touch

- `vendor/` — third-party code, never modify
- `nb3dp_addon.py` — only modified by addon-specific slices
- `poc/` — proof-of-concept artefacts, treat as read-only
- `.sessions/` — kickoff files written by orchestrator, not agents
