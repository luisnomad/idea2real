# idea2real Web App Plan

This folder defines the development plan for evolving idea2real from a Blender addon into a production-ready web app for 3D-printer users.

## Documents

- `DEVELOPMENT_PLAN.md`: phase-by-phase roadmap with outcomes and checklists.
- `PARALLEL_AGENT_EXECUTION.md`: how to split work safely across AI agents with low merge friction.
- `LOCAL_PARALLEL_WORKFLOW.md`: local-first runbook for parallel Codex/Claude sessions using git worktrees.
- `MEANINGFUL_TDD_PLAYBOOK.md`: behavior-first test workflow used as a delivery gate.
- `FRONTEND_UI_DIRECTION.md`: UI inspiration translated into actionable layout, visual, and component direction.
- `COMPANY_AGENTIC_SHOWCASE.md`: company-facing overview of the full human+agent orchestration model with diagrams.
- `AGENTIC_CONTROL_PANEL.md`: command contracts and architecture for Node/Clack orchestration (parallel + solo modes).
- `SECURITY_BASELINE.md`: production security controls for VPS deployment, prompt safety, and secret management.

## Scope Summary

- Input: user-uploaded images or Nano Banana generated images.
- Core generation: Hunyuan3D via fal.ai.
- Post-processing: server-side mesh cleanup with `trimesh` and `pymeshlab`.
- UX: modern React/Three.js web experience with prompt tools, generation history, and model gallery.
- Expansion: later-phase Poly Haven + Sketchfab integrations, plus Mixamo rigging exploration.
