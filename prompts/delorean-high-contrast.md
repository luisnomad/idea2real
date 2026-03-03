# DeLorean BTTF — High-Contrast Prompts for 3D Reconstruction

> Optimized for Hyper3D Rodin edge detection. Uses dark charcoal matte PLA
> with strong directional side lighting to create crisp shadow edges on panel
> lines and body creases. White background for clean segmentation.

---

## Hero (Three-Quarter View)

Use this FIRST to generate the reference object, then feed into I2I for remaining views.

```
Dark charcoal matte PLA 3D print of a 1982 DeLorean DMC-12 Back to the Future time machine,
strong directional side lighting creating crisp shadow edges on panel lines and body creases,
exposed flux capacitor wiring as raised surface ridges along body panels, Mr. Fusion reactor
on rear engine cover, visible horizontal layer lines, chunky solid proportions suitable for
FDM 3D printing, flat rectangular base 2mm thick, no thin protruding parts thinner than 2mm,
three-quarter view from front-right at 45 degrees, slightly elevated camera angle,
orthographic projection, clean white background, product photography, best quality
```

---

## I2I Grid Prompt

After generating the hero, feed it back into Nano Banana I2I with:

```
Create a 2x2 reference grid of this exact dark charcoal 3D printed DeLorean time machine
from four angles: front view (top-left), right side profile (top-right), three-quarter view
from front-right (bottom-left), rear view (bottom-right). Maintain identical object design,
dark charcoal matte PLA finish, strong directional side lighting with crisp shadow edges,
visible layer lines, white background, orthographic projection, consistent proportions
across all views, product photography, best quality
```

---

## Individual View Prompts (Pure T2I Fallback)

### Front View
```
Dark charcoal matte PLA 3D print of a 1982 DeLorean DMC-12 Back to the Future time machine,
strong directional side lighting creating crisp shadow edges on panel lines and body creases,
exposed flux capacitor wiring as raised surface ridges, modified front bumper with extra
lighting details, visible horizontal layer lines, chunky solid proportions suitable for
FDM 3D printing, flat rectangular base 2mm thick, no thin protruding parts thinner than 2mm,
front view, straight-on camera angle, centered in frame, orthographic projection,
clean white background, product photography, best quality
```

### Side View
```
Dark charcoal matte PLA 3D print of a 1982 DeLorean DMC-12 Back to the Future time machine,
strong directional side lighting creating crisp shadow edges on panel lines and body creases,
exposed flux capacitor wiring as raised surface ridges along rocker panels, Mr. Fusion reactor
on rear engine cover, time circuit cables as raised detail along body sides, visible horizontal
layer lines, chunky solid proportions suitable for FDM 3D printing, flat rectangular base 2mm
thick, no thin protruding parts thinner than 2mm, right side profile view, perpendicular to
front, centered in frame, orthographic projection, clean white background, product photography,
best quality
```

### Rear View
```
Dark charcoal matte PLA 3D print of a 1982 DeLorean DMC-12 Back to the Future time machine,
strong directional side lighting creating crisp shadow edges on panel lines and body creases,
Mr. Fusion reactor prominent on rear engine cover, rear exhaust and tail light detail,
exposed wiring harness along rear deck, visible horizontal layer lines, chunky solid
proportions suitable for FDM 3D printing, flat rectangular base 2mm thick, no thin protruding
parts thinner than 2mm, rear view, straight-on camera angle from behind, centered in frame,
orthographic projection, clean white background, product photography, best quality
```

### Top-Down View
```
Dark charcoal matte PLA 3D print of a 1982 DeLorean DMC-12 Back to the Future time machine,
strong directional side lighting creating crisp shadow edges on panel lines and body creases,
Mr. Fusion reactor visible on rear engine cover from above, flux capacitor wiring visible on
roof and body sides, visible horizontal layer lines, chunky solid proportions suitable for
FDM 3D printing, flat rectangular base 2mm thick, top-down overhead view, bird's eye
perspective, looking straight down, orthographic projection, clean white background,
product photography, best quality
```

---

## Key Differences from Original Prompts

| Aspect | Original | High-Contrast |
|---|---|---|
| Color | Brushed stainless steel | Dark charcoal matte PLA |
| Lighting | Even studio lighting | Strong directional side lighting |
| Shadow | Minimal | Crisp shadow edges on panel lines |
| Background | White | Clean white (same) |
| Purpose | Print realism | 3D reconstruction edge detection |

---

## Image Processing

After generating 4K 1:1 grid:
```bash
# Slice 2x2 grid into 4 separate 2048x2048 images
magick grid-4k-hc.png -crop 2048x2048+0+0 front.png
magick grid-4k-hc.png -crop 2048x2048+2048+0 side.png
magick grid-4k-hc.png -crop 2048x2048+0+2048 three-quarter.png
magick grid-4k-hc.png -crop 2048x2048+2048+2048 rear.png
```

## Rodin Settings

- **Tier:** Regular (upgrade from Sketch baseline)
- **bbox_condition:** `[4.2, 1.9, 1.1]` (corrected proportions — original was too tall)
