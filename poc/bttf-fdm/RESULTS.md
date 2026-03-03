# PoC Results: BTTF DeLorean FDM Pipeline

**Date:** 2026-03-03
**Goal:** Validate end-to-end pipeline from text description → AI images → 3D mesh → STL-ready file

## Pipeline Summary

```
Text Prompt → Nano Banana Pro (ImagineArt) → 4-view reference grid → Hyper3D Rodin (text-to-3D) → Blender MCP cleanup → STL
```

## Stage Results

### Stage 0: Environment Setup ✅
- Blender 5.0 installed
- Blender MCP addon (v1.26.0) installed and connected via `uvx blender-mcp` on port 9876
- `.mcp.json` configured at project root

### Stage 1: Image Generation ✅
**Workflow:** I2I-first with 2x2 grid approach

1. Generated hero image (three-quarter view) using Nano Banana Pro on ImagineArt
   - Model: Nano Banana Pro (Google Gemini 3 Pro Image)
   - Settings: 1:1, 2K, 2 variations
   - Prompt included FDM surface cues (matte PLA, layer lines, flat base)
   - Selected the cleaner variation as hero reference

2. Fed hero back as I2I reference → generated 4K 1:1 grid (4096×4096)
   - Single generation, 4 consistent views of the same car
   - Sliced into 4× 2048×2048 quadrants via ImageMagick

**Output:** 5 reference images in `references/`
- `hero-three-quarter.png` — CDN compressed (177KB), used as I2I reference
- `top-down.png` — Bird's eye overhead (2048×2048, 4.1MB)
- `front.png` — Front straight-on (2048×2048, 3.9MB)
- `side.png` — Side profile (2048×2048, 3.8MB)
- `rear.png` — Rear view (2048×2048, 3.7MB)

**Key Learning:** The 2x2 grid + 4K + slice approach is excellent. One generation = 4 consistent views. Much better than generating views separately (which produces inconsistent cars).

### Stage 2: 3D Reconstruction ✅ (with caveats)
**Path A: Text-to-3D** (Hyper3D Rodin free trial)

- Image-to-3D initially failed with "unsupported image format" error — **bug in Blender MCP addon** (see Bug Fix below)
- Fell back to text-to-3D with bbox_condition [4.2, 1.8, 1.3]
- Prompt: "Back to the Future DeLorean time machine, matte plastic 3D printed miniature with flat base"
- Result: 30,685 verts, 23,332 faces, recognizable but generic DeLorean

**Path B: Image-to-3D** (after bug fix)

- Fed all 4 reference views (front, side, rear, top-down) to Rodin with bbox_condition
- Result: 32,896 verts, 23,332 faces, better proportions than text-to-3D
- Mesh was already watertight after merge (0 non-manifold edges) — much cleaner topology
- Shape is "melted" / blobby — Rodin "Sketch" tier lacks sharp edges
- Low-contrast matte gray reference images likely contributed to softness

**Bug Fix: Blender MCP addon image upload**

Found and fixed a bug in `addon.py` line 1191. The MCP server (server.py) base64-encodes images before sending to the Blender addon. The addon then passes this base64 **text string** directly as file content to Rodin's API via `requests.post(files=...)`, but requests expects **raw bytes**. Rodin's Sharp library received ASCII text instead of binary image data.

Fix: `b64.b64decode(img)` before posting. One-line change in `vendor/blender-mcp/addon.py`.

### Stage 3: Print Cleanup & Export ✅

**Text-to-3D cleanup:**
1. **Remove doubles** (0.001m): 30,685 → 11,652 verts
2. **Recalculate normals**
3. **Voxel remesh** (0.005m): Made watertight (27,290 → 0 non-manifold), 243K verts
4. **Decimate** (0.2 ratio): → 48.5K verts, 75.5K faces
5. **Flatten base** + **Scale 1:32**
- Output: `export/delorean-bttf-1-32.stl` (4.9MB, 131.7 × 39.1 × 55.3mm)

**Image-to-3D cleanup (lighter pipeline — mesh already watertight):**
1. **Remove doubles** (0.001m): 32,896 → 11,645 verts (0 non-manifold)
2. **Recalculate normals**
3. **Flatten base** (169 bottom verts) + **Scale 1:32**
- Output: `export/delorean-i2i-1-32.stl` (1.1MB, 131.7 × 42.9 × 55.2mm)

**Comparison:**
| | Text-to-3D | Image-to-3D |
|---|---|---|
| STL size | 4.9MB (75K faces) | 1.1MB (23K faces) |
| Watertight | After voxel remesh | Naturally |
| Width | 39.1mm | 42.9mm (better proportions) |
| Detail | Smoothed by remesh | Better shape, soft edges |

## What Worked Well

1. **Nano Banana Pro image quality** — The FDM surface prompts produced images that genuinely look like 3D-printed objects
2. **2x2 grid approach** — Single 4K generation → 4 consistent views. Elegant and efficient.
3. **Blender MCP automation** — Full cleanup pipeline (remove doubles → remesh → decimate → scale → export) executed entirely via MCP commands
4. **Voxel remesh** — Instantly fixed 27K non-manifold edges to zero. The nuclear option for watertight meshes.
5. **Text-to-3D as fallback** — When image-to-3D failed, text prompt + bbox_condition still produced a recognizable result

## What Needs Improvement

1. **Image-to-3D pipeline fixed but "melted" output** — Bug found and fixed (base64 encoding). Pipeline works end-to-end, but Rodin "Sketch" tier produces soft/blobby meshes. Need to test "Regular" tier or alternative services.
2. **Low-contrast reference images** — Matte gray PLA surface prompts are great for print realism but give Rodin too little edge information. Next iteration: try higher-contrast renders (dark body + bright edge highlights) or edge-detected overlays.
3. **Rodin hardcoded to "Sketch" tier** — The addon sends `"tier": "Sketch"` which is the lowest quality. Changing to `"Regular"` or `"Pro"` may dramatically improve detail.
4. **No wheel separation** — For FDM printing, separate wheels would allow better print orientation. The current mesh is monolithic.
5. **No hollowing** — For resin printing, the model should be hollow with drain holes. Not applicable for FDM at this scale.

## Next Steps

1. **Higher-contrast reference images** — Re-generate with edge-enhancing prompts (dark body, bright highlights, or wireframe overlay)
2. **Rodin tier upgrade** — Change addon from "Sketch" to "Regular" tier, compare output quality
3. **Try Hunyuan3D local** — Set up local inference on M4 Mac (Pinokio or ComfyUI) for image-to-3D without API dependency
4. **Submit bug fix upstream** — PR the base64 decode fix to ahujasid/blender-mcp
5. **Print test** — Send STL to slicer, verify printability, send to Tower Print
6. **Compare services** — Benchmark Rodin vs Hunyuan3D vs Meshy vs TripoSR for same reference images

## Cost & Time

- **Image generation:** Free (ImagineArt credits)
- **3D reconstruction:** 1 Hyper3D Rodin free trial generation
- **Total pipeline time:** ~30 minutes (mostly automation + waiting for Rodin)
- **Manual intervention:** Enabling Blender MCP checkboxes, downloading 4K grid manually from ImagineArt
