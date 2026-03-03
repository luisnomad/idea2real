# idea2real — Architecture & Decision Log

> For LLMs working on this project. Concise context on why things are the way they are.

## What This Is

A Blender addon (`nb3dp_addon.py`) that turns a single image into a 3D-printable STL. No LLM needed at runtime — the user drives everything from a sidebar panel in Blender.

**Flow:** Upload image → Hunyuan3D v3 (fal.ai) → GLB import → Auto cleanup → Scale → STL export

There's also an optional Nano Banana (Google Gemini Flash) text-to-image step for users who don't have a reference image.

## Key Decisions

### fal.ai only — no Replicate (v0.2.0)

We removed Replicate entirely. Reasons:
- `ResourceInsufficient` errors on Replicate were common and unrecoverable
- Higher cost per generation
- fal.ai's queue API is simpler and more reliable
- One provider = less code, fewer failure modes

If Replicate becomes compelling again, the `FalClient` pattern (submit → poll → fetch) can be cloned for a `ReplicateClient`, but don't add it speculatively.

### Hunyuan3D v3, not v2 (v0.2.0)

- Endpoint: `fal-ai/hunyuan3d-v3/image-to-3d` (was `fal-ai/hunyuan3d/v2`)
- v3 produces watertight 500K-face GLBs out of the box
- Key param change: `input_image_url` (not `image_url`) — match fal.ai v3 API
- New params: `face_count`, `enable_pbr`, `generate_type`
- `enable_pbr=False` and `generate_type="Geometry"` for print (faster, no textures needed)

### Scale by longest dimension, not height (v0.2.0)

- Old: `target_height_mm` scaled by Z only — wrong for wide/flat objects like cars
- New: `target_size_mm` scales by `max(x, y, z)`
- Works universally: cars, figurines, buildings, anything

### Cleanup pipeline (v0.2.0)

Order matters. Each phase assumes the previous one ran:

1. **Merge doubles** (threshold 0.0001) + **fix normals** + **remove loose** — basic repair
2. **Decimate** — if >150K faces, decimate to 100K. Ratio = 100000/current_count
3. **Flatten base** — bottom 5% of vertices pushed to min_z. Makes a flat contact surface for the print bed
4. **Scale** — longest dimension → target_size_mm
5. **Tech-specific** — FDM gets edge split + smooth shading; Resin gets optional solidify/hollow; SLS is minimal

Why no `fill_holes`: Hunyuan v3 meshes are watertight. `fill_holes` on already-clean meshes can create bad geometry (internal faces, inverted normals).

Why flatten before scale: the 5% threshold is relative to model height, so it works regardless of the model's native size.

### Rectangular base, not cylindrical (v0.2.0)

Cars and flat-bottomed objects look wrong on a cylinder. A box matching the XY footprint + 2mm margin is better. Uses `primitive_cube_add` scaled to `(dims.x + 4mm, dims.y + 4mm, base_thickness)`.

### Image input priority (v0.3.0)

The addon prefers `input_image_path` (user upload) over `generated_image_path`. If the user uploaded something, that's what they want to use. Only fall back to the generated image if no upload exists.

Old logic was backwards — `use_generated_as_input` defaulted True and ignored uploads.

### Panel structure (v0.3.0)

Rebranded from "NB3DP" to "idea2real by NotJustPrompts". Tab name: `idea2real`.

Panels follow the actual workflow order:
1. **Input Image** — Upload a reference image. Nano Banana T2I is a collapsed child panel here for users who need to generate one from text.
2. **Generate 3D Model** — Hunyuan3D v3 settings + button. Requires an image from step 1.
3. **Print Cleanup** — Tech selection, scale, base options, pipeline summary
4. **Export STL** — Path picker, export button, quick-export-to-desktop

Image gen is a child of the Input Image panel (not a sibling of Generate 3D) because it's an optional sub-step within "get an image", not a separate pipeline stage.

### API key storage

Keys live in Blender's addon preferences (`bpy.types.AddonPreferences`). They persist across Blender restarts automatically — stored in Blender's `userpref.blend`. No external config files needed.

The main panel shows a warning box + "Open Preferences" button when no key is set.

### Default export path

`~/Documents` (via `os.path.expanduser("~")` + `"Documents"`). Works on macOS and Windows. Was `//` (blend-file-relative) which fails when no blend file is saved.

### Button disabling during async ops

All action buttons (Generate 3D, Generate Image, Cleanup, Export, Quick Export) are disabled via `row.enabled = not props.is_processing` when an API call is in flight. Prevents double-clicks and race conditions.

## Blender Limitations to Know

- **No multi-line text input** — `StringProperty` renders as a single scrollable line in sidebar panels. No workaround exists in the Blender Python API.
- **Sidebar width is user-controlled** — no API to set it programmatically. Users drag the edge.
- **Panel registration order matters** — parent panels must be registered before child panels. If a child references a `bl_parent_id` that isn't registered yet, the entire panel tree silently fails to render.
- **Thread safety** — Blender's UI can only be modified from the main thread. All state updates from background threads go through `bpy.app.timers.register()`.

## File Locations

| What | Where |
|---|---|
| Addon source | `nb3dp_addon.py` (project root) |
| Installed addon | `~/Library/Application Support/Blender/5.0/scripts/addons/nb3dp_addon.py` |
| Skill guide | `.claude/skills/nano-banana-3d-print/SKILL.md` |
| Prompt templates | `prompts/` |
| PoC results | `poc/bttf-fdm/`, `poc/bttf-fdm-v2/` |
| Scripts | `scripts/` |

## Provider & Model Reference

| Service | Model ID | Use |
|---|---|---|
| fal.ai | `fal-ai/hunyuan3d-v3/image-to-3d` | Image → 3D mesh (GLB) |
| fal.ai | `fal-ai/nano-banana-2` | Text → image (fast) |
| fal.ai | `fal-ai/nano-banana-pro/text-to-image` | Text → image (quality) |

## What's Not Built Yet

- Batch generation (generate multiple STLs from a prompt list)
- Automatic multi-angle reference grid (generate 4 views, slice, feed to Rodin)
- fal.ai API key setup via CLI script
- Integration tests (hard — needs Blender Python environment)
- Undo support in cleanup pipeline (currently destructive)
