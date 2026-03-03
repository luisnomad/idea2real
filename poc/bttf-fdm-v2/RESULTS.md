# BTTF DeLorean FDM v2 — Quality Sprint Results

## Objective

Dramatically improve mesh quality from the PoC "melted plastic" baseline using:
1. Rodin tier upgrade (Sketch → Regular → Detail)
2. Higher-contrast reference images (dark charcoal + directional lighting)
3. Tuned bbox_condition proportions (`[4.2, 1.9, 1.1]`)

## Tier Comparison

Using **original reference images** from `poc/bttf-fdm/references/` (4× 2048×2048 PNG views):

| Tier | Raw Verts | Cleaned Verts | Cleaned Faces | STL Size | Dimensions (mm) | Visual Quality |
|---|---|---|---|---|---|---|
| Sketch (PoC baseline) | ~12K | ~50K | ~80K | 4.8 MB | 131.7 × 39.1 × 55.3 | 2/5 — Recognizable but blobby, soft edges |
| **Regular** | 31,620 | 49,968 | 79,432 | 4.8 MB | 131.7 × 39.1 × 55.2 | 3.5/5 — Sharper panels, defined wheels, cleaner lines |
| **Detail** | 32,035 | 49,978 | 77,108 | 4.8 MB | 131.8 × 34.2 × 59.0 | 4/5 — Best panel definition, sharpest edges, clearest BTTF mods |

### Key Observations

- **Regular → Detail is a visible but incremental upgrade.** Both are dramatically better than Sketch.
- Raw vertex counts are similar (~32K) but Detail produces cleaner topology that remeshes better.
- Detail tier proportions differ slightly (narrower, taller) — may need bbox_condition tuning per tier.
- Both tiers completed quickly (~30-45s) despite "Detail" being advertised as slower.

## Cleanup Pipeline

Applied to both Regular and Detail:
1. Remove doubles (threshold 0.0001) — removed ~20K duplicate verts
2. Recalculate normals (outward)
3. Voxel remesh (5mm voxel size) — produces watertight mesh
4. Decimate (target ~50K faces)
5. Flatten base (lowest Z → 0)
6. Scale to 1:32 (target 131.75mm long)

## High-Contrast Reference Images

**Status: Prompts written, images not yet generated.**

New prompts: `prompts/delorean-high-contrast.md`
Key changes:
- Dark charcoal matte PLA (vs brushed stainless steel)
- Strong directional side lighting (vs even studio lighting)
- Crisp shadow edges on panel lines (gives Rodin better edge information)

| Image Set | Tier | Vertex Count | Visual Quality (1-5) | Notes |
|---|---|---|---|---|
| High-contrast | Regular | — | —/5 | Pending image generation |
| High-contrast | Detail | — | —/5 | Pending image generation |

## bbox_condition Tuning

Real DeLorean DMC-12: 4216 × 1859 × 1140mm
- PoC bbox: `[4.2, 1.8, 1.3]` — height too tall
- v2 bbox: `[4.2, 1.9, 1.1]` — used for both Regular and Detail runs

## Best Result (So Far)

- **STL file:** `export/delorean-detail-1-32.stl`
- **Dimensions:** 131.8 × 34.2 × 59.0 mm
- **Tier:** Detail
- **Image set:** Original (matte gray, even lighting)
- **Verts/Faces:** 49,978 / 77,108

## Files

| File | Description |
|---|---|
| `export/delorean-regular-1-32.stl` | Regular tier, cleaned, 1:32 scale |
| `export/delorean-detail-1-32.stl` | Detail tier, cleaned, 1:32 scale |
| `blender/delorean-regular-raw.blend` | Regular tier raw mesh |
| `blender/delorean-regular-cleaned.blend` | Regular tier after cleanup |
| `blender/delorean-tier-comparison.blend` | Both models side-by-side |
| `screenshots/detail-closeup.png` | Detail tier closeup screenshot |

## Comparison Screenshots

See `screenshots/` directory:
- `detail-closeup.png` — Detail tier closeup with Regular visible in background

## Key Learnings

- **Tier upgrade is the single biggest quality lever.** Sketch → Regular is night and day. Regular → Detail is a meaningful incremental gain.
- **Free trial API key supports all tiers** — no paywall blocking Detail.
- **Voxel remesh at 5mm balances watertight + detail.** Smaller voxels = more detail but larger files.
- **bbox_condition affects proportions per tier differently** — Detail came out narrower/taller than Regular with same bbox. May need per-tier tuning.
- **High-contrast images are still the biggest untested variable.** The original matte gray images already produce decent results at Detail tier, but stronger edge contrast should help further.

## Next Steps

- [ ] Generate high-contrast reference images (ImagineArt or fal.ai)
- [ ] Run Detail tier with high-contrast images
- [ ] Provider shootout (Rodin vs TRELLIS vs Hunyuan3D vs TripoSG)
- [ ] Slice best STL in PrusaSlicer, check printability
- [ ] Physical print test
