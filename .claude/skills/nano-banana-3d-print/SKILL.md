---
name: nano-banana-3d-print
description: >
  Generate 3D-printable objects from natural language descriptions using the Nano Banana (Google Gemini Flash Image)
  text-to-image pipeline combined with Blender MCP for mesh reconstruction and cleanup. Covers the full workflow
  from idea to STL-ready file: multi-angle reference image generation with print-ready surface prompts,
  image-to-3D mesh reconstruction via Hyper3D Rodin, Blender MCP cleanup for printability, and STL export.
  Supports FDM, Resin/SLA, and SLS print technologies. Use this skill whenever the user wants to create a
  3D-printable object from a description, vibe-code a 3D print, turn an idea into a physical object, generate
  multi-angle references for 3D reconstruction, use Nano Banana for 3D printing workflows, or connect AI image
  generation to Blender for manufacturing. Also trigger when the user mentions "idea to print", "vibe-code 3D",
  "nano banana 3D", "print-ready model", or any combination of text-to-image with 3D printing intent.
---

# Nano Banana → 3D Print Pipeline

Turn a natural language idea into a physical 3D-printed object using AI image generation and Blender MCP.

## Pipeline Overview

```
IDEA → Nano Banana (multi-angle renders) → Image-to-3D (Hyper3D Rodin) → Blender MCP (cleanup) → STL → PRINT
```

Each stage feeds the next. The key insight is that **print constraints are encoded upstream** at the image
generation stage — Nano Banana's multimodal reasoning understands material finishes, manufacturing limits, and
physical plausibility, so the generated reference images already bias the 3D reconstruction toward printable
geometry.

## Stage 1: Idea Capture

Start by understanding what the user wants to print. Gather:

1. **Object description** — what is it? (e.g., "a low-poly fox figurine," "a custom phone stand")
2. **Print technology** — FDM, Resin/SLA, or SLS (this determines surface prompts)
3. **Approximate size** — affects detail level and structural requirements
4. **Aesthetic** — low-poly, organic, mechanical, stylized, realistic
5. **Functional requirements** — is it decorative or does it need to bear load, snap-fit, etc.

If the user is vague, suggest sensible defaults: FDM at 10cm tall, low-poly aesthetic, decorative.

## Stage 2: Nano Banana Multi-Angle Reference Generation

This is the core innovation. Generate consistent reference views using Nano Banana (via fal.ai API or
Google AI Studio) with **print-technology-specific surface prompts** baked in.

### Why Encode Print Constraints in the Prompt

Traditional workflow: generate pretty images → reconstruct mesh → discover it's unprintable → fix in CAD.

This workflow: generate images that LOOK like printed objects → reconstruction inherits printable geometry →
minimal cleanup needed. The T2I model does the printability thinking for you.

### The I2I-First Workflow (Recommended)

The most reliable way to get consistent multi-angle references is NOT to generate 4 separate images
from text. Instead, use this two-step approach:

1. **Generate ONE hero image** (text-to-image) — a three-quarter view of your object with print-surface
   prompts baked in. Review it, regenerate until it's perfect. This is your source of truth.

2. **Generate remaining angles via I2I** — feed the hero image back into Nano Banana's image-to-image
   mode and ask for different viewing angles. The model SEES the actual object and rotates it,
   maintaining perfect consistency in design, materials, and proportions.

   Or even better: feed the hero image and ask for a **multi-angle grid in one shot**:
   ```
   Create a 4-angle technical reference sheet of this exact object: front view (top-left),
   side profile (top-right), three-quarter view (bottom-left), top-down view (bottom-right),
   maintaining identical design and materials, white background, orthographic projection
   ```

This works because Nano Banana is built on Gemini's multimodal reasoning — it understands 3D structure
from a single reference image and can extrapolate other viewpoints while preserving every detail.

**Read `references/prompt-templates.md` for the full I2I workflow, T2I fallback techniques,
and the complete prompt library organized by print technology.**

### API Integration

Nano Banana is available through multiple providers. Read `references/api-integration.md` for
setup instructions, code snippets, and pricing for fal.ai, WaveSpeedAI, and Google AI Studio.

The recommended approach for multi-angle generation:

1. **Nano Banana 2** (fal.ai: `fal-ai/nano-banana-2`) — best balance of quality and speed at ~$0.08/image
2. **Nano Banana Pro Multi** (WaveSpeedAI) — batch generation at ~$0.07/image, ideal for 4-angle sheets
3. **Google AI Studio** — free tier available, good for prototyping

Generate these 4 views for every object:
- Front view (0°)
- Side view (90°)
- Three-quarter view (45°)
- Top-down view (overhead)

Use a white/neutral background and consistent lighting across all views. Include "orthographic projection"
or "technical reference sheet" in prompts for cleaner reconstruction input.

## Stage 3: Image-to-3D Mesh Reconstruction

Convert the multi-angle references into a 3D mesh. Two paths:

### Path A: Hyper3D Rodin via Blender MCP (Recommended)

Blender MCP integrates directly with Hyper3D Rodin for image-to-3D generation. This is the smoothest
path because reconstruction and cleanup happen in the same environment.

```
In Claude Desktop / Cursor / VS Code with Blender MCP:
"Generate a 3D model from these reference images using Hyper3D"
```

Blender MCP will call the Hyper3D API and import the result directly into Blender.

### Path B: Standalone Reconstruction APIs

If Blender MCP is not available, use these services directly:

- **Hyper3D Rodin** (hyper3d.ai) — best for multi-view reconstruction
- **TripoSR** (Stability AI) — fast single-image to 3D
- **InstantMesh** — open source, runs locally
- **Meshy.ai** — web-based, good for quick prototypes

Export as OBJ or GLB, then import into Blender manually for cleanup.

## Stage 4: Blender MCP Setup & Cleanup

**Read `references/blender-mcp-setup.md` for the complete installation and configuration guide.**

This covers: installing the Blender addon, configuring the MCP server for Claude Desktop / Cursor / VS Code,
connecting to Hyper3D and Poly Haven, and troubleshooting common issues.

### Print-Ready Cleanup Commands

Once the mesh is in Blender, use these natural language commands through Blender MCP to prepare for printing.
Each command maps to specific bpy operations that Claude will execute:

**Geometry Fixes:**
- "Make the mesh manifold" — closes holes, removes non-manifold edges
- "Remove internal faces" — eliminates geometry the slicer can't handle
- "Merge vertices by distance, threshold 0.001" — cleans up duplicate verts
- "Recalculate normals outside" — ensures correct face orientation

**Printability:**
- "Add a flat base to the object, 2mm thick" — ensures bed adhesion
- "Check minimum wall thickness, highlight areas below 1.2mm" — FDM minimum
- "Apply remesh modifier, voxel size 0.5mm" — uniform topology for printing
- "Smooth the mesh with 2 iterations, factor 0.5" — removes reconstruction artifacts

**Technology-Specific Prep:**

For FDM:
- "Split overhangs greater than 45 degrees into separate parts"
- "Add 1mm chamfer to the bottom edge" — prevents elephant's foot
- "Hollow is NOT recommended for FDM — keep solid"

For Resin/SLA:
- "Hollow the model with 1.5mm wall thickness"
- "Add 1mm drain holes at the lowest points"
- "Add support contact points at overhang areas"

For SLS:
- "Ensure minimum wall thickness of 0.7mm"
- "Check for trapped powder volumes and add escape holes"
- "No supports needed — SLS is self-supporting"

### Export

```
"Export the model as STL to [path]"
"Set the scale so the model is [X]cm tall"
"Apply all modifiers before exporting"
```

Blender MCP will execute the export with correct settings. Always apply modifiers and check scale before export.

## Stage 5: Slice & Print

The STL is ready for your slicer. Recommended settings by technology:

**FDM (Cura / PrusaSlicer / OrcaSlicer):**
- Layer height: 0.16-0.20mm for speed, 0.08-0.12mm for detail
- Infill: 15-20% for figurines, 40%+ for functional parts
- Supports: tree supports for organic shapes
- First layer: 0.28mm for adhesion

**Resin/SLA (Chitubox / Lychee):**
- Layer height: 0.03-0.05mm
- Exposure: per-resin calibration (use exposure test)
- Supports: light/medium auto-generate, then manually add to islands
- Lift speed: slow for detailed prints

**SLS (provider-dependent):**
- Usually handled by the print service
- Ensure minimum feature sizes per provider specs
- Orient for best surface finish on visible faces

## Quick Start Example

User says: "I want to 3D print a tiny cyberpunk cat figurine, about 5cm tall, on my Ender 3"

1. **Capture**: cyberpunk cat, FDM (Ender 3), 5cm, stylized/detailed, decorative
2. **Nano Banana prompts** (4 views):
   ```
   A cyberpunk cat figurine with neon circuit patterns, matte PLA plastic finish
   with subtle visible layer lines, chunky geometric details suitable for FDM
   3D printing, flat circular base for bed adhesion, no thin protruding parts,
   front view, orthographic projection, white background, studio lighting
   ```
   (repeat for side, three-quarter, top views)
3. **Reconstruct** via Hyper3D Rodin through Blender MCP
4. **Cleanup**: manifold check, flat base, wall thickness ≥1.2mm, no overhangs >45°
5. **Export** STL at 5cm height
6. **Slice** in Cura: 0.16mm layers, 15% infill, tree supports

## Advanced: Exploded View → Multi-Part Print Kit

Beyond single objects, this pipeline supports generating entire **multi-part assembly kits**
from a single exploded view prompt. Nano Banana's spatial reasoning can produce photorealistic
exploded diagrams showing every internal component in correct relative position — motors,
frames, shells, fasteners — all floating in 3D space.

The core prompt template:
```
product design, [OBJECT with MATERIAL accents], exploded view diagram,
white background, three-dimensional, highly detailed internal components,
studio lighting, product photography, best quality
```

This produces a complete visual BOM (bill of materials). From there, isolate individual
components, reconstruct each as a separate mesh, test-fit in Blender, and print as a
snap-together model kit.

**Read `references/prompt-templates.md` → "Exploded View Assembly Prompts" for the full
template library, variations by product type, and the step-by-step multi-part pipeline.**

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| Inconsistent views | Nano Banana generating different interpretations | Add "character sheet, consistent design" to prompt, use same seed if API supports it |
| Mesh has holes | Reconstruction artifacts | "Make mesh manifold" in Blender MCP |
| Thin walls | Over-detailed source images | Use lower-poly aesthetic prompt, or remesh in Blender |
| Bad overhangs | Organic shapes not print-optimized | Split into parts, or switch to resin |
| Scale is wrong | Reconstruction has arbitrary units | Set scale explicitly before STL export |
| Blender MCP won't connect | Server not running | Check addon is enabled, port 9876 is free |

## File Organization

When working through this pipeline, organize files as:
```
project-name/
├── references/          # Nano Banana generated images
│   ├── front.png
│   ├── side.png
│   ├── three-quarter.png
│   └── top.png
├── mesh/                # Reconstruction output
│   ├── raw.obj          # Direct from Hyper3D
│   └── cleaned.stl      # After Blender cleanup
└── print/               # Slicer files
    └── sliced.gcode
```
