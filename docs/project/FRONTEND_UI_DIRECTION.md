# Frontend UI Direction

## Design Intent

Build a "3D workshop cockpit" UX: fast, focused, and confidence-building for users who want printable results, not toy demos.

Core tone:

- Clean and technical.
- Premium but not flashy.
- Action-first around generation and print prep.

## Inspiration Translation (From Shared References)

The references suggest a strong product structure we should keep, while adapting it to idea2real's workflow:

- Persistent left navigation for mode switching.
- Large central workspace for the 3D scene and content-heavy views.
- Contextual right inspector panel for model settings and generation controls.
- Dense but readable card-based grids for model/gallery/history views.
- Utility toolbar at top for project context, search, and quick actions.

What we keep:

- Three-column productivity layout (`nav | workspace | inspector`).
- Dark-capable, high-contrast control surfaces for 3D work.
- Clear visual hierarchy and compact controls.

What we change:

- Strong print-focused language and controls (scale, wall thickness, manifold status, STL-ready badge).
- Prompt workflow designed for "system prompt + raw prompt + improve prompt" flow.
- Gallery/history built around provenance and re-run paths.
- Theme parity from day one (light + dark), not dark-only.

## IA and Navigation

Primary sections:

1. `Dashboard`
2. `Create` (Image to 3D workflow)
3. `Prompt Studio` (guided/raw/improve)
4. `Model Library` (gallery + versions)
5. `Generation History` (Nano Banana + Hunyuan runs)
6. `Print Prep` (cleanup presets + validation reports)
7. `Settings`

Recommended nav behavior:

- Left rail always visible on desktop.
- On smaller screens, convert to bottom nav + slide-over inspector.
- Preserve last active tab and inspector section per project.

## Layout System

Desktop layout:

- Left rail: 240px fixed.
- Center workspace: fluid.
- Right inspector: 360px default, collapsible.
- Top bar: 56px with project switcher and global search.

Tablet/mobile layout:

- 1-column flow with sticky top actions.
- 3D viewer first, settings in accordions below.
- Inspector becomes full-width sheet.

Grid rules:

- 12-column grid in workspace pages.
- 8px spacing scale.
- Card rhythm: 16px/20px interior spacing.

## Visual Language

Typography:

- Primary UI font: `Sora` (or `Manrope` fallback).
- Data/metrics font: `IBM Plex Mono`.
- Headings: semibold with tight tracking.

Color system (tokenized):

- `--bg-canvas`: neutral deep slate.
- `--bg-surface`: elevated charcoal/graphite.
- `--fg-primary`: near-white in dark, near-black in light.
- `--accent-primary`: electric cyan-blue.
- `--accent-success`: mint-green.
- `--accent-warning`: amber.
- `--accent-danger`: coral-red.

Notes:

- Avoid purple-dominant palettes.
- Keep component contrast WCAG AA minimum.

Depth and effects:

- Subtle gradient backdrops in workspace.
- Soft inner borders for panels.
- Minimal glass effect only in top-level shells.

## Motion and Interaction

Use motion for orientation, not decoration:

- Page transition: 180ms fade/slide.
- Inspector section expand: 140ms.
- Card hover elevation: 120ms.
- Staggered gallery reveal: 30ms offsets.

3D-specific interactions:

- Smooth camera tween for preset views.
- Loading states with progressive asset readiness:
- `Uploading -> Generating -> Cleaning -> Ready`.

## Screen Blueprints

## 1) Create (Image to 3D)

Left: workflow steps.
Center: large viewer + upload target.
Right inspector:

- Input image uploader.
- Model generation profile.
- Output quality presets.
- Generate CTA and cost/time estimate.

Bottom status rail:

- Job timeline.
- Download actions (`source`, `glb`, `stl`).

## 2) Prompt Studio

Split mode tabs:

- Guided prompts (system templates by object type).
- Raw prompt editor.
- Improved prompt diff view.

Must-have actions:

- `Improve my prompt`.
- `Save template`.
- `Send to Nano Banana`.

## 3) Model Library

Views:

- Dense card grid.
- List mode with sortable columns.

Card metadata:

- Thumbnail + small 3D preview.
- Print readiness badge.
- Scale and mesh health summary.
- Source lineage (upload/nano-banana/sketchfab/poly-haven).

## 4) Generation History

Timeline with filters:

- Provider, model, status, date.
- Quick re-run and compare outputs.
- Prompt and settings snapshot.

## Component Map (React + shadcn + R3F)

Shell:

- `AppShell`, `LeftNav`, `TopBar`, `InspectorPanel`.

Creation flow:

- `ImageDropzone`, `GenerationPresetCard`, `JobStatusRail`, `ArtifactActions`.

Prompt tools:

- `PromptTemplatePicker`, `PromptEditor`, `PromptDiff`, `ImprovePromptButton`.

Library:

- `ModelCard`, `ModelGrid`, `ModelFilters`, `ModelDetailDrawer`.

3D viewer:

- `SceneCanvas`, `MeshStage`, `CameraControls`, `DimensionOverlay`, `WireframeToggle`.

## Accessibility and Usability Baseline

- Full keyboard traversal for navigation and inspector controls.
- Focus states visible on all actionable components.
- Color is never the only status signal.
- All status chips include icon + text.
- File upload states announced with `aria-live`.

## Implementation Slices (Parallel)

UI-1 Shell and tokens:

- Theme tokens, typography, app shell, responsive breakpoints.

UI-2 Create screen:

- Upload, generation controls, status timeline, artifact actions.

UI-3 Prompt Studio:

- Guided/raw modes, prompt improvement flow, prompt history list.

UI-4 Library and history:

- Gallery grid/list, filters, version chain, run history timeline.

UI-5 R3F viewer upgrades:

- Lighting presets, camera presets, dimension overlays, loading pipeline visuals.

## TDD Contracts for Frontend

Contract A:

```text
Given a user uploads an image and starts generation
When the job transitions through backend statuses
Then the UI shows the correct step state and enables download only at Ready
And failed status shows retry and error reason
```

Contract B:

```text
Given a user writes a raw prompt
When they click Improve my prompt
Then the improved prompt appears without overwriting the original
And the user can choose which prompt to send to generation
```

Contract C:

```text
Given a user opens the model library
When they filter by print readiness and source
Then only matching models appear with stable card metadata
And selecting a model opens the correct version details
```
