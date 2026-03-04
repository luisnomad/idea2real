# Meaningful TDD Playbook

This project follows behavior-first TDD. Tests must protect product behavior and failure modes, not just increase coverage.

## Mandatory Loop (Per Change)

1. Define behavior contract in `Given/When/Then`.
2. Choose the lowest test layer that can catch the risk.
3. Write one failing test first and confirm failure reason.
4. Implement minimal code to pass.
5. Refactor safely, re-running targeted tests.
6. Verify test quality before merge.

## Behavior Contract Template

Use this block in PR descriptions and ticket comments:

```text
Given <starting state>
When <user action or system event>
Then <user-visible outcome>
And <negative/boundary expectation>
```

## Test Layer Matrix

Unit tests:

- Prompt transforms and validation.
- Geometry math and settings conversion.
- Job state transitions.

Integration tests:

- API to DB interactions.
- API to queue interactions.
- API to geometry service request/response handling.

E2E tests:

- Upload -> generate -> preview -> download STL.
- Prompt improve -> generate image -> generate model.
- Gallery/history browse and rerun flow.

## Required Regression Targets

Every phase includes at least one regression test for its highest-risk failure:

- Phase 1: job status mismatch or stale artifact linkage.
- Phase 2: prompt improvement overwriting original prompt.
- Phase 3: incorrect model/version shown in gallery card.
- Phase 4: geometry cleanup producing non-manifold mesh.
- Phase 5: duplicate job execution after retry.
- Phase 6: imported external asset missing license metadata.

## Quality Checklist (Before Merge)

- [ ] Test fails on pre-change behavior.
- [ ] Assertions check user-visible behavior.
- [ ] External boundaries are mocked; domain behavior is not.
- [ ] Includes at least one boundary or negative path for non-trivial logic.
- [ ] Test names describe behavior, not implementation details.
- [ ] Changed area has targeted tests and relevant suite pass.

## Suggested Commands (Planned Monorepo)

- `pnpm test --filter web`
- `pnpm test --filter api`
- `pnpm test --filter geometry`
- `pnpm test:integration`
- `pnpm test:e2e`
