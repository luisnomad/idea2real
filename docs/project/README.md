# idea2real Web App Plan

This folder tracks the web product roadmap and implementation guidance for idea2real.

## Documents

- `DEVELOPMENT_PLAN.md`: phase-by-phase roadmap and milestones.
- `FRONTEND_UI_DIRECTION.md`: UI direction and component guidance.
- `MEANINGFUL_TDD_PLAYBOOK.md`: behavior-first testing workflow.
- `SECURITY_BASELINE.md`: production security controls and defaults.
- `SECURITY_CONTINUATION_GUIDE.md`: implemented controls and mandatory secure-change workflow.

## Scope Summary

- Input: user-uploaded images or Nano Banana generated images
- Core generation: Hunyuan3D via fal.ai
- Post-processing: server-side mesh cleanup with `trimesh` and `pymeshlab`
- UX: React/Three.js experience for generation, preview, and downloads
