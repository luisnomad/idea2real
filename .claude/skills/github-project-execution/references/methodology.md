# Methodology Reference

## Board Hygiene Checklist

Run weekly:

- Every `In Progress` issue has a recent activity update.
- Every `Review` issue has an active PR or explicit reviewer block.
- Every merged PR's issue is in `Done`.
- Every `Blocked` issue has blocker details and owner.
- `Ready` has enough unassigned issues for next sprint wave.

## Planning Cadence

- Keep roadmap updates small and periodic.
- Split large outcomes into independent slices with explicit dependencies.
- Ensure each slice has one owner and clear path boundaries.

## Suggested Output Format (LLM)

When making project updates, report:

```text
Created:
- <issue-id> <title>

Updated:
- <issue-id> <what changed>

Skipped:
- <issue-id> <reason>

Project Status Moves:
- <issue-id> <from> -> <to>

Follow-ups:
- <next actions>
```
