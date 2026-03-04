# Humans-in-the-Loop Guide

This file explains how to start and run a new agentic session locally with multiple LLM sessions (Codex + Claude Code) while you stay in control.

Technical reference for the Node control panel:

- `docs/project/AGENTIC_CONTROL_PANEL.md`

## What "Agentic Mode" Means Here

Agentic mode in this repo is:

- One slice per session.
- One git branch + one git worktree per session.
- Shared local infra services running once.
- Human operator assigns work, reviews outputs, and decides merge order.

## Recommended Entry Point

Use the root command center:

```bash
cd <your-clone-path>   # e.g. ~/Projects/idea2real
./agentic.sh
```

`agentic.sh` now launches the Node.js control panel (`tools/agentic-control`) with a Clack interactive UI.

First screen now asks for mode selection:

- `Parallel` (multi-agent slices + worktrees)
- `Solo` (single-agent sprint on one branch)
- `Operations` (setup, PM, diagnostics)

Core actions exposed in the control panel:

- Session: start or resume a slice.
- Solo: start/resume/checkpoint/finalize one-agent sprint on a single branch.
- Slice: finalize slice (tests, optional commit, finish flow, move issue to `Review`).
- PR: feedback loop and merge/cleanup.
- Cleanup: standalone worktree/branch cleanup.
- PM: seed issue sets and generate next-phase PM prompts.
  - Next-phase prompt now includes a standardized slice issue template and suggested `gh` issue creation flow.
- Diagnostics: doctor checks.

Issue status automation is baked in:

- `session start/resume` -> move slice issue to `In Progress`
- `solo start/resume` -> move linked sprint issues to `In Progress`
- `solo add-issues` -> move newly linked sprint issues to `In Progress`
- `slice finalize` -> move slice issue to `Review`
- `solo finalize` -> local review handoff OR move linked sprint issues to `Review` (when published)
- `pr merge` -> move slice issue to `Done`

Equivalent non-interactive commands:

```bash
pnpm agentic session start
pnpm agentic session resume
pnpm agentic continue
pnpm agentic solo start --phase P1 --slug api-core --issues "2,3" --delivery-mode phase-pr --review-mode local-agent
pnpm agentic solo resume
pnpm agentic solo add-issues --issues "4,5"
pnpm agentic solo checkpoint --summary "..." --next "..." --blockers "None"
pnpm agentic solo finalize --done "..." --next "Local review requested" --blockers "None"
pnpm agentic solo finalize --publish --done "..." --next "Review and merge PR" --blockers "None"
pnpm agentic setup bootstrap-gh
pnpm agentic slice finalize
pnpm agentic pr loop
pnpm agentic pr merge
pnpm agentic cleanup worktree
pnpm agentic pm seed-issues
pnpm agentic pm next-phase --phase P2
pnpm agentic pm next-phase --phase P2 --clean-old
pnpm agentic doctor --quick
```

Short aliases:

```bash
./ag session start
pnpm a:start
pnpm a:resume
pnpm a:continue
pnpm a:solo-start
pnpm a:solo-resume
pnpm a:solo-add
pnpm a:solo-checkpoint
pnpm a:solo-finalize
pnpm a:done
pnpm a:loop
pnpm a:merge
pnpm a:clean
pnpm a:pm
pnpm a:pm-next
pnpm a:doctor
```

## Solo Agent Mode

Use solo mode when one LLM should drive a whole sprint quickly (no worktree orchestration overhead).

Default delivery mode is `phase-pr`: one PR can cover multiple linked issues in the same phase.

Important nuance: "solo agent" can still orchestrate sub-agents.

- This is allowed and expected for throughput.
- Keep ownership non-overlapping (split by issue and explicit path groups).
- Integrate sub-agent outputs sequentially on the solo branch.
- Never assign the same file group to two sub-agents in the same round.

Lifecycle:

1. `agentic solo start` (creates/checkout sprint branch from `main`, writes kickoff file, sets issues to `In Progress`)
2. `agentic continue` (resume active solo sprint, or pick/start next solo slice if none is active)
3. `agentic solo add-issues` (optional: absorb more same-phase issues into the active solo sprint/PR)
4. `agentic solo checkpoint` (records progress and optionally comments linked issues)
5. `agentic solo finalize` (in `local-agent` review mode: creates local review handoff, no commit/push/PR)
6. `agentic solo finalize --publish` (after local review: commits/publishes PR, updates PR body, moves issues to `Review`)
7. `agentic pr merge` (moves to `Done` after merge)

Important:

- `agentic continue` resumes active solo sprint if one exists; otherwise it offers to start the next solo slice from discovered issues.
- In parallel mode, use `agentic session start` to pick the next slice.

Solo state files:

- `.sessions/solo/state.json`
- `.sessions/solo/kickoff-<phase>-<slug>.md`
- `.sessions/solo/checkpoints/*.md`

LLM automation skill (repo-local):

- `.claude/skills/agentic-solo-operator/SKILL.md`

Cleanup safety behavior:

- Cleanup checks dirty worktrees and local-ahead commits before deletion.
- If risk is detected, it prints warnings and asks for explicit destructive confirmation.
- Without `--force`, risky cleanup is blocked.

All commands support machine-readable output:

```bash
pnpm agentic pr loop --pr auto --json
```

JSON contract:

- `status`: `ok | warn | error`
- `action`: command id
- `artifacts`: `issue | pr | branch | worktree | handoffFile`
- `nextSteps`: ordered next actions
- `errors`: normalized error list with retryability

If you only want session discovery/start, you can still run:

```bash
./scripts/start-agent-session.sh
```

Guided/start scripts can auto-enter worktree shell with:

```bash
./scripts/start-agent-session.sh --enter
```

Session startup does:

1. Run preflight checks (`docker`, daemon health, `gh` auth, required scripts).
2. Discover options:
   - available open slices (grouped by domain),
   - resumable local sessions (existing worktrees),
   - resumable issue handoffs (from GitHub comments with `Slice:` + `Next:`).
3. Ask you what to do.
4. Create the worktree for a new slice when needed.
5. Generate a kickoff prompt in the target worktree (`.sessions/kickoff-<slice>.md`).

## GitHub CLI Setup (One Time)

Run:

```bash
cd <your-clone-path>
./scripts/gh-bootstrap.sh
```

This validates:

- `gh` authentication.
- `project` scope.
- default repo (`luisnomad/idea2real`).
- access to project `luisnomad#1` (`idea2real Web UI`).

## 60-Second Session Start

Menu-driven:

```bash
./agentic.sh
```

Then choose either:

- `Session / Start or resume guided session` for parallel slice mode.
- `Solo / Start single-agent sprint` for one-agent sprint mode.

Direct command flow:

1. Pick a slice (example: `P0-WEB-1`) and confirm owner.
2. Create branch + worktree + `.env.local`:

```bash
cd <your-clone-path>
./scripts/new-slice-worktree.sh --slice P0-WEB-1 --slug app-shell --enter
```

3. Start shared infra (once, from integration worktree):

```bash
docker compose up -d postgres redis minio
```

4. Open that worktree in a new Codex thread or Claude Code terminal.
5. Paste the kickoff prompt template below.

Launch examples:

- Codex Desktop:
  - Open a new thread and set workspace to the slice worktree path.
- Claude Code CLI:

```bash
cd ../idea2real-p0-web-1
claude
```

## Kickoff Prompt Template (Copy/Paste)

```text
You own slice P0-WEB-1.

Rules:
- Follow AGENTS.md, CONTRIBUTING.md, docs/project/LOCAL_PARALLEL_WORKFLOW.md.
- Touch only allowed paths for this slice.
- Use meaningful TDD (Given/When/Then -> failing test -> minimal fix -> refactor).
- Keep commits atomic and include slice ID in commit message.

Goal:
<paste issue/slice definition of done>

First actions:
1) Restate behavior contract.
2) List files you plan to touch.
3) Implement and validate with targeted tests.
4) Summarize changes + residual risks.
```

## Starting Sessions in Parallel

Run one command per slice:

```bash
./scripts/new-slice-worktree.sh --slice P0-WEB-1 --slug app-shell --slot 1
./scripts/new-slice-worktree.sh --slice P0-API-1 --slug hono-skeleton --slot 2
./scripts/new-slice-worktree.sh --slice P0-GEOM-1 --slug fastapi-skeleton --slot 3
```

Then assign:

- Codex thread A -> `../idea2real-p0-web-1`
- Codex thread B -> `../idea2real-p0-api-1`
- Claude Code session -> `../idea2real-p0-geom-1`

## Issue and Project Automation

- To create Phase 0 slice issues and auto-add them to the project board:

```bash
./scripts/create-p0-issues.sh
```

- To create security slices and auto-place them in `Ready` / `Backlog`:

```bash
./scripts/create-security-issues.sh
```

## PM Replenishment Loop (Required)

Treat issue creation as an ongoing PM activity.

Trigger PM replenishment when any of these are true:

- `Ready` has fewer than 3 unassigned slices.
- A phase/sprint closes (its done criteria are met).
- New scope appears from blockers, review feedback, or production findings.

Human PM loop:

1. Review `docs/project/DEVELOPMENT_PLAN.md` and decide next phase/sprint target.
2. Generate or update slice issues for that target.
3. Ensure each issue includes: Slice ID, Depends On, Paths Touched, Behavior Contract, Test Plan, Definition of Done.
4. Add slices to GitHub Project and set status:
   - Immediate candidates -> `Ready`
   - Not yet started -> `Backlog`
5. Re-run `./scripts/start-agent-session.sh` so agents can pick up newly available slices.

Current seed scripts:

- `./scripts/create-p0-issues.sh`
- `./scripts/create-security-issues.sh`

Recommended next scripts:

- `./scripts/create-p1-issues.sh`
- `./scripts/create-p2-issues.sh`
- `./scripts/create-p3-issues.sh`

## PM Agent Prompt (Copy/Paste)

Use this when you want a PM-agent session to prepare the next sprint/phase slices:

```text
You are the PM agent for idea2real.

Goal:
- Replenish GitHub Project "idea2real Web UI" so Ready always has at least 3 unassigned slices.
- Prepare the next phase based on docs/project/DEVELOPMENT_PLAN.md.

Instructions:
1) Read docs/project/DEVELOPMENT_PLAN.md and identify the next unfinished phase.
2) Propose a slice list grouped by domain (frontend, api, geometry, contracts, infra, security).
3) For each slice, produce:
   - Slice ID
   - Title
   - Depends On
   - Paths Touched
   - Behavior Contract (Given/When/Then)
   - Test Plan
   - Definition of Done
4) Create GitHub issues with label "slice" plus phase/domain labels.
5) Add each issue to project luisnomad#1 and set status:
   - Ready for immediately actionable slices
   - Backlog for deferred slices
6) Avoid duplicates by searching existing issue titles with the same Slice ID before creating.
7) Output:
   - Created issue URLs
   - Skipped duplicates
   - Final Ready count
   - Suggested first 3 slices to start now
```

The script uses:

- `REPO=luisnomad/idea2real`
- `PROJECT_OWNER=luisnomad`
- `PROJECT_NUMBER=1`
- `AUTO_ADD_PROJECT=true`

You can override these via env vars.

## GitHub Actions or Local Script?

Use the local script for this workflow.

Why not `.github/workflows` for session start:

- GitHub Actions runs on remote runners, not your laptop context.
- It cannot manage your local git worktrees.
- It cannot verify your local Docker daemon state for this machine.
- It is not a good fit for interactive "ask human what to do" prompts.

What workflows are good for:

- CI checks, test gates, lint/typecheck, deployment jobs.

How the human should trigger session start:

- Run `./scripts/start-agent-session.sh` locally in terminal.

## Human Operator Checklist

Before work:

- Confirm one owner per slice.
- Confirm no two sessions share a branch.
- Confirm shared services are healthy (`docker compose ps`).

During work:

- Enforce path ownership boundaries from `AGENTS.md`.
- Enforce contract-first changes for shared APIs.
- Request short handoff notes when switching tools/sessions.

Before merge:

- Run menu option `7` (PR feedback loop) and ensure no unresolved blocking feedback remains.
- Rebase slice on latest `main`.
- Run targeted tests for the slice.
- Validate behavior contract is satisfied.
- Validate PR risk note and changed paths.

## PR Feedback Loop (Pre-Merge)

Use menu option `7` before merging any PR.

It will:

- inspect PR checks (fail/pending).
- inspect change requests and inline review threads.
- detect merge conflicts (`mergeable` / `mergeStateStatus`).
- print action items.
- post a structured PR round comment (fixed now, left as-is, why, next actions).
- optionally create/resume a local worktree for the PR branch and write a focused feedback-fix prompt.
- move linked issue status to `In Progress` or `Blocked` while feedback is being addressed.

## Security Operator Cadence

At least once per week:

- Review `docs/project/SECURITY_BASELINE.md` checklist status.
- Confirm no provider/API secrets are present in frontend-exposed config.
- Review open "Blocked" slices for unresolved security dependencies.
- Check latest handoff notes for auth, rate-limit, or prompt-safety regressions.

Before production deployment:

- Confirm Phase 5 security checklist is complete.
- Run key rotation drill and backup restore drill.
- Verify prompt-injection and malformed upload negative tests are passing.

## Handoff Note Format

Ask every session to leave this note in issue/PR comments:

```text
Slice: P0-WEB-1
Branch: codex/p0-web-1-app-shell
Commit: <sha>
Done: <what is complete>
Next: <single next action>
Blockers: <if any>
```

## Slice Completion (Automated)

When an agent finishes a slice branch, run from that slice worktree:

```bash
./scripts/finish-slice-session.sh \
  --done "Implemented Docker Compose stack, CI matrix, and bootstrap flow" \
  --next "Ready for review and merge" \
  --blockers "None"
```

This will:

- push the current slice branch.
- create or reuse a PR.
- assign the PR to `@me` by default.
- add a handoff comment to the matching slice issue.
- move project status to `Review` (best effort, if project access is available).
- write `.sessions/handoffs/<SLICE>.md` locally.

Recommended ownership:

1. Agent owns implementation + `finish-slice-session.sh`.
2. Human owns PR review/approval and merge decision.
3. After merge, human (or ops agent) removes the worktree:

```bash
./scripts/cleanup-slice-worktree.sh --slice P0-INFRA-1
```

If branch is already merged remotely and you want full cleanup:

```bash
./scripts/cleanup-slice-worktree.sh --slice P0-INFRA-1 --delete-remote
```

Safe preview first:

```bash
./scripts/cleanup-slice-worktree.sh --slice P0-INFRA-1 --dry-run
```

## Ops Agent Prompt (Cleanup)

```text
You are the ops agent. Clean up merged slice branches/worktrees.

Rules:
- Only clean slices whose PR is merged into main.
- Never delete unmerged branches unless human explicitly says so.
- Run dry-run first, show plan, then execute.

Steps:
1) Identify merged slice branch to clean (from provided slice ID).
2) Run: ./scripts/cleanup-slice-worktree.sh --slice <SLICE_ID> --dry-run
3) If plan looks correct, run: ./scripts/cleanup-slice-worktree.sh --slice <SLICE_ID> --delete-remote --yes
4) Report what was removed and what remains.
```

## Common Failure Modes (and Fix)

- Port conflict:
  - Use a different `--slot` in `new-slice-worktree.sh`.
- Wrong files changed:
  - Stop and reset session scope to allowed paths only.
- Contract drift across slices:
  - Land/update `packages/contracts` first, then continue implementation.
- Two sessions editing same branch:
  - Split immediately into separate worktrees/branches.

## Key References

- `AGENTS.md`
- `CONTRIBUTING.md`
- `docs/project/LOCAL_PARALLEL_WORKFLOW.md`
- `docs/project/PARALLEL_AGENT_EXECUTION.md`
- `docs/project/MEANINGFUL_TDD_PLAYBOOK.md`
