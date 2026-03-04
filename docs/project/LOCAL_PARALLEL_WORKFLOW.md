# Local Parallel Workflow

Multiple agents can work on this repository simultaneously by owning separate slices.
This document explains how to run slices in parallel without conflicts.

## Slice isolation

Each slice has a defined set of allowed paths (see `AGENTS.md`). Slices must not write
outside their allowed paths. The orchestrator assigns slices before work begins.

## Branch naming

Each slice works on its own branch:

```
<agent-id>/<slice-id>-<description>
# e.g.
codex/p0-infra-1-docker-compose-stack-ci-matrix-and-local-bootstrap
```

Branches are merged to `main` via PR after CI passes.

## Running multiple slices locally

Open one terminal per slice:

```bash
# Terminal 1 — P0-INFRA-1
git worktree add ../idea2real-p0-infra-1 codex/p0-infra-1-...
cd ../idea2real-p0-infra-1
make test

# Terminal 2 — P0-ADDON-2 (example)
git worktree add ../idea2real-p0-addon-2 codex/p0-addon-2-...
cd ../idea2real-p0-addon-2
make test
```

Using `git worktree` means each slice has its own working tree — no stashing or branch
switching needed.

## Conflict avoidance rules

1. Slices own disjoint file sets — overlapping edits should not happen by design.
2. If a slice needs to read a file owned by another slice, it does so read-only.
3. If a genuine shared file must change (e.g. `README.md`), the orchestrator coordinates.

## Kickoff files

The orchestrator writes `.sessions/kickoff-<SLICE>.md` before an agent starts.
Agents read this file first and do not modify it.

## Merging

PRs are merged in dependency order. P0 slices (infrastructure) merge before P1 slices
that depend on them. CI must be green before merge.
