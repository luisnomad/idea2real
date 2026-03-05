# Contributing to idea2real

These rules apply to human and AI contributors.

## Getting Started

```bash
git clone git@github.com:luisnomad/idea2real.git
cd idea2real
pnpm install
```

Optional local infra for web/API development:

```bash
docker compose up -d postgres redis minio
```

## Workflow

1. Open or create an issue for the change.
2. Create a focused branch from `main`.
3. Implement with tests for behavior changes.
4. Run relevant test suites locally.
5. Open a PR with behavior summary and risk note.

## Development Principles

### 1. Contract First

If changing API boundaries, update `packages/contracts` before consumers/providers.

### 2. Test-Driven Changes

For non-trivial work, follow:

`Given/When/Then -> failing test -> minimal implementation -> refactor`

See `docs/project/MEANINGFUL_TDD_PLAYBOOK.md`.

### 3. Keep Changes Scoped

- Prefer small PRs.
- Avoid unrelated refactors in feature PRs.
- Document new dependencies in the PR description.

## Code Quality

- TypeScript: strict mode, no `any`, prefer `unknown`
- Python: type hints and formatted/linted code
- Tests: behavior-descriptive names

## Areas

- Frontend: `apps/web/**`
- API: `apps/api/**`
- Geometry: `services/geometry/**`
- Contracts: `packages/contracts/**`
- Shared docs/infra: `docs/**`, `scripts/**`, `.github/**`, `docker-compose*.yml`
