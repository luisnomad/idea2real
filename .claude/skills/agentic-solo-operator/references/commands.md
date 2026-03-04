# Agentic Solo Commands

## Start sprint

```bash
agentic solo start --phase P1 --slug api-core --issues "2,3,9" --non-interactive --json
```

## Resume sprint

```bash
agentic solo resume --non-interactive --json
```

## Create checkpoint

```bash
agentic solo checkpoint --summary "API routes scaffolded" --next "Implement auth middleware" --blockers "None" --json
```

## Finalize sprint to PR review

```bash
agentic solo finalize --done "Core scope complete" --next "Review and merge PR" --blockers "None" --json
```

## Prepare PM next phase

```bash
agentic pm next-phase --phase P2 --json
```
