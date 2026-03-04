## Slice

<!-- e.g., P0-WEB-1 -->

## Behavior Contract

```
Given <starting state>
When <user action or system event>
Then <user-visible outcome>
And <negative/boundary expectation>
```

## Changes

<!-- Bullet list of what changed and why -->

## Risk Note

<!-- What could go wrong? What should reviewers watch for? -->

## Test Plan

- [ ] New tests added/updated
- [ ] All tests passing locally
- [ ] Contract tests pass (if touching shared schemas)

## Checklist

- [ ] Paths touched are within my slice's ownership
- [ ] No lockfile changes (unless I'm the infra slice owner)
- [ ] No new dependencies without justification
- [ ] Commit messages follow convention: `type(SLICE-ID): description`
