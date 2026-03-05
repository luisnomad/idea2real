# idea2real by NotJustPrompts

## Project Overview

idea2real has two product tracks:

1. **Blender Add-on** (`nb3dp_addon.py`) — image to printable STL inside Blender.
2. **Web App** (`apps/web`, `apps/api`, `services/geometry`) — web-based pipeline for the same goal.

Core flow:
Image -> Hunyuan3D -> cleanup -> STL export.

## Primary References

- `docs/ARCHITECTURE.md`
- `docs/project/DEVELOPMENT_PLAN.md`
- `docs/project/FRONTEND_UI_DIRECTION.md`
- `docs/project/SECURITY_BASELINE.md`
- `docs/project/SECURITY_CONTINUATION_GUIDE.md`
- `CONTRIBUTING.md`
- `.claude/skills/github-project-execution/SKILL.md`

## Expectations for Changes

- Keep changes scoped to the feature being implemented.
- Add or update tests for non-trivial behavior changes.
- Prefer small, reviewable commits.
- Keep TypeScript strict and avoid `any`.
- Use Python type hints in Python code.
- Follow `docs/project/SECURITY_CONTINUATION_GUIDE.md` for all endpoint/auth/upload changes.

## Planning and Tracking (Required)

For planning, issue creation/refinement, or project-board status updates:

1. Use `.claude/skills/github-project-execution/SKILL.md`.
2. Keep roadmap strategy in Markdown docs.
3. Keep executable work in GitHub Issues + Project columns.
4. Ensure every touched issue is moved to the correct status column.

## 3D/Print Domain Constraints

- Optimize outputs for printability, not visual realism.
- Favor robust, manifold geometry over fragile detail.
- Preserve millimeter-based assumptions for print dimensions.
- Keep provider credentials server-side or in Blender preferences only.
