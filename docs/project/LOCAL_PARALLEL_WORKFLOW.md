# Local Parallel Workflow (Codex + Claude Code)

## Goal

Run multiple agents on one machine without collisions:

- Codex in multiple threads.
- Claude Code in one or more terminals.
- Shared local infra (`postgres`, `redis`, `s3-compatible`) running once.

This workflow is local-first and does not require cloud agent orchestration.

## Recommended Topology

- One **integration worktree**: stable baseline and final verification.
- One **slice worktree per active agent/thread**.
- One shared Docker stack for infra services.

Example directory layout:

```text
/Projects/
  idea2real/                      # integration worktree (main)
  idea2real-p0-web-1/             # slice worktree
  idea2real-p0-api-1/             # slice worktree
  idea2real-p0-geom-1/            # slice worktree
```

## Worktree Setup

Human-first launcher (recommended):

```bash
cd <your-clone-path>   # e.g. ~/Projects/idea2real
./agentic.sh
```

This opens the human command center. Choose "Start/Resume guided session" to run discovery + preflight + worktree setup.

Direct guided launcher (still available):

```bash
./scripts/start-agent-session.sh --enter
```

One-time GitHub CLI setup:

```bash
./scripts/gh-bootstrap.sh
```

Preferred (one command):

```bash
cd <your-clone-path>   # e.g. ~/Projects/idea2real
./scripts/new-slice-worktree.sh --slice P0-WEB-1 --slug app-shell
./scripts/new-slice-worktree.sh --slice P0-API-1 --slug hono-skeleton --slot 2
./scripts/new-slice-worktree.sh --slice P0-GEOM-1 --slug fastapi-skeleton --slot 3
```

The script creates:

- A branch named `codex/<slice>-<slug>`.
- A sibling worktree directory (`../idea2real-<slice>` by default).
- A `.env.local` file with a per-slot `WEB/API/GEOM` port map.

Manual fallback:

Create a worktree per slice branch:

```bash
cd <your-clone-path>   # e.g. ~/Projects/idea2real
git fetch origin
git worktree add ../idea2real-p0-web-1 -b codex/p0-web-1-app-shell
git worktree add ../idea2real-p0-api-1 -b codex/p0-api-1-hono-skeleton
git worktree add ../idea2real-p0-geom-1 -b codex/p0-geom-1-fastapi-skeleton
```

If branch already exists:

```bash
git worktree add ../idea2real-p0-web-1 codex/p0-web-1-app-shell
```

## Session Assignment

Assign one agent session per worktree:

- Codex Thread A -> `idea2real-p0-web-1`
- Codex Thread B -> `idea2real-p0-api-1`
- Claude Code Session -> `idea2real-p0-geom-1`

Rule: one session owns one slice branch at a time.

## Shared Services (Run Once)

Start infra in the integration worktree only:

```bash
cd <your-clone-path>   # e.g. ~/Projects/idea2real
docker compose up -d postgres redis minio
```

All slice worktrees point to the same shared service endpoints.

Default local endpoints/credentials:

- Postgres: `postgres://idea2real:idea2real@localhost:5432/idea2real`
- Redis: `redis://localhost:6379`
- MinIO S3 endpoint: `http://localhost:9000` (console: `http://localhost:9001`)
- MinIO root credentials: `minioadmin` / `minioadmin`

## Port Allocation Strategy

Avoid local port clashes by reserving per-worktree app ports.

Suggested map:

- Integration: `WEB=5173`, `API=3000`, `GEOM=8000`
- Slice A: `WEB=5174`, `API=3001`, `GEOM=8001`
- Slice B: `WEB=5175`, `API=3002`, `GEOM=8002`
- Slice C: `WEB=5176`, `API=3003`, `GEOM=8003`

Use per-worktree `.env.local` values so each session can run concurrently.

## Dependency and Lockfile Rules

- Only infra/dependency slice updates lockfiles.
- Other slices use frozen installs where possible (`pnpm install --frozen-lockfile`).
- Python service uses pinned requirements.
- If a slice needs a new dependency, hand off or coordinate with infra slice.

## Local Integration Loop

At least once per day:

1. Rebase each slice branch on latest `main`.
2. Run targeted tests in that slice worktree.
3. Merge slice branches into integration worktree for cross-slice verification.
4. Run integration smoke tests from integration worktree.

Before merging any PR, run `./agentic.sh` option `7` (PR feedback loop) to triage comments, CI failures, and conflicts.

## Codex <-> Claude Handoff Protocol

When handing off a slice between tools/sessions, add a short note in PR description or issue comment with:

- Current commit SHA.
- What is done.
- What is blocked.
- Exact next command to run.

Optional local file template:

```text
Slice: P0-API-1
Branch: codex/p0-api-1-hono-skeleton
Commit: <sha>
Done: <completed items>
Next: <single next step>
Blockers: <if any>
```

Automated option (recommended):

```bash
./scripts/finish-slice-session.sh \
  --done "Implemented <slice output>" \
  --next "Ready for review and merge" \
  --blockers "None"
```

This command pushes branch, opens/assigns PR, comments on the slice issue, and writes local handoff metadata.

Post-merge cleanup:

```bash
./scripts/cleanup-slice-worktree.sh --slice <SLICE_ID> --dry-run
./scripts/cleanup-slice-worktree.sh --slice <SLICE_ID> --delete-remote --yes
```

## Conflict Avoidance Rules (Local)

- No shared branch between sessions.
- No touching files outside declared slice paths.
- One owner for migrations and lockfile changes.
- Contract updates land before dependent implementation.
- Re-run tests after every rebase.

## Minimum Daily Checks

- [ ] All active slices have a single owner session.
- [ ] Shared services are healthy (`docker compose ps`).
- [ ] Port map has no collisions.
- [ ] Each slice rebased on latest `main`.
- [ ] Targeted tests pass in each slice.
- [ ] Integration smoke test passes in integration worktree.
