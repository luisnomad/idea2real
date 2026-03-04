# idea2real by NotJustPrompts

## Project Overview

idea2real has two components:

1. **Blender Addon** (`nb3dp_addon.py`) — standalone addon that turns images into 3D-printable STLs from Blender's sidebar. No LLM needed at runtime.
2. **Web App** (in development) — production web platform for the same workflow, with prompt tools, 3D preview, model gallery, and print prep features.

**Addon pipeline:** Image (upload or generate) → Hunyuan3D v3 (fal.ai) → GLB import → Auto cleanup → Scale → STL export

**Architecture & decision log:** See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for addon architecture and Blender API limitations.

## Web App Development

The web app is built by multiple agents working in parallel. **All agents must read `AGENTS.md`** for:

- Ownership boundaries (who touches what paths)
- Branch and PR conventions
- Contract-first workflow
- TDD requirements

Execution model is local-first: parallel Codex threads + Claude Code sessions using separate git worktrees.

Key documents:

- `AGENTS.md` — universal agent rules (Codex, Claude Code, Copilot)
- `docs/project/DEVELOPMENT_PLAN.md` — phase roadmap
- `docs/project/PARALLEL_AGENT_EXECUTION.md` — merge strategy
- `docs/project/LOCAL_PARALLEL_WORKFLOW.md` — local worktree/session operations
- `scripts/new-slice-worktree.sh` — one-command branch/worktree/env setup
- `scripts/start-agent-session.sh` — interactive human launcher (preflight + slice discovery + kickoff)
- `scripts/gh-bootstrap.sh` — one-time gh auth/scope/repo/project setup
- `docs/project/MEANINGFUL_TDD_PLAYBOOK.md` — TDD workflow
- `docs/project/FRONTEND_UI_DIRECTION.md` — UI specs
- `docs/project/SECURITY_BASELINE.md` — security controls for VPS deployment and provider integrations
- `CONTRIBUTING.md` — contribution rules for humans and agents

## Core Concept

The key innovation is **encoding print constraints upstream** at the image generation stage. Instead of generating pretty images and discovering they're unprintable, we prompt Nano Banana with material finishes, layer lines, wall thicknesses, and structural constraints so the T2I model produces images that already look like physical printed objects. This biases the 3D reconstruction toward printable geometry from the start.

## Skill Location

The Claude Skill lives at `.claude/skills/nano-banana-3d-print/` and contains:

```
nano-banana-3d-print/
├── SKILL.md                              # Main pipeline guide (5 stages)
└── references/
    ├── prompt-templates.md               # Prompt library by print tech (FDM/Resin/SLS)
    ├── api-integration.md                # fal.ai, WaveSpeedAI, Google AI Studio setup
    └── blender-mcp-setup.md              # Blender MCP installation & cleanup commands
```

Always read `SKILL.md` first when working on this project. Reference docs are loaded on-demand — follow the pointers in SKILL.md.

## Key Workflows

### I2I-First Workflow (Primary — Always Prefer This)

1. Generate ONE hero image via text-to-image with print-surface prompts
2. Feed it back to Nano Banana I2I to get remaining angles or a 4-angle reference grid
3. This guarantees consistency — the model SEES the object and rotates it

### Pure T2I Workflow (Fallback)

Generate 4 separate views from text using identical object descriptions with different view angle suffixes. Less consistent but works without I2I access.

### Exploded View Workflow (Multi-Part Kits)

Use the exploded view prompt template to generate a full component breakdown, then reconstruct each part as a separate STL for snap-together assembly kits.

## Print Technologies

The project supports three print technologies, each with distinct prompt strategies:

- **FDM** — matte PLA finish, visible layer lines, chunky proportions, 1.2mm min wall, 45° overhang limit
- **Resin/SLA** — smooth finish, fine detail, 1.5mm hollow walls, drain holes, sharp edges allowed
- **SLS** — powdery nylon surface, 0.7mm min wall, self-supporting, powder escape holes

## External Dependencies

- **Hunyuan3D v3** — Image-to-3D via fal.ai (`fal-ai/hunyuan3d-v3/image-to-3d`). Primary 3D generation engine.
- **Nano Banana** — Google Gemini Flash Image model via fal.ai (`fal-ai/nano-banana-2`). Optional T2I step.
- **Blender MCP** — github.com/ahujasid/blender-mcp — connects Blender to Claude via MCP (used for dev/exploration, not needed by the addon)
- **Blender 3.6+** — 3D modeling and STL export
- **Slicer** — Cura, PrusaSlicer, OrcaSlicer (FDM) or Chitubox, Lychee (Resin)

## Project Context

This is a side project exploring the intersection of AI image generation and 3D printing. The immediate use case is generating custom car models (DeLoreans, Scalextric slot cars, hypercars) for printing via Tower Print. The skill and pipeline are designed to be general-purpose — any object that can be described can be printed.

## Code Style & Conventions

- Python for API integration scripts and batch generation
- Prompts are stored as markdown with code blocks for easy copy-paste
- Blender operations are expressed as natural language commands (for Blender MCP) with underlying bpy code documented for reference
- All measurements in millimeters for print dimensions, Blender uses meters internally

## When Working on This Project

- Always consult the skill at `.claude/skills/nano-banana-3d-print/SKILL.md` for pipeline decisions
- Prefer the I2I-first workflow over pure T2I for multi-angle generation
- When writing new prompts, always include the print-surface texture and technical setup suffix
- Test prompts should produce images that look like actual 3D prints, not photorealistic renders
- Keep Blender MCP commands in natural language — Claude translates to bpy at runtime
- When in doubt about printability constraints, err on the side of chunkier geometry
