# 🏎️ DeLorean 3D Print — Nano Banana Prompt Library

> **16 prompts** — 2 models × 2 print techs × 4 angles
> Ready to paste into Nano Banana via fal.ai, Google AI Studio, or WaveSpeedAI.

---

## 🔧 How To Use

### ⭐ RECOMMENDED: The I2I-First Workflow (Easiest & Most Consistent)

1. Pick ONE hero prompt from any section below (three-quarter view works best)
2. Generate it in Nano Banana — iterate until the car looks perfect
3. Feed that image back into Nano Banana's **image-to-image mode** with:
   - *"Show me this exact car from a front view, same design, white background, orthographic projection"*
   - *"Show me this exact car from a side profile, same design, white background, orthographic projection"*
   - *"Show me this exact car from a top-down overhead view, same design, white background, orthographic projection"*
4. **Or even better** — feed the hero image and ask for all 4 at once:
   - *"Create a 4-angle reference sheet of this exact car: front (top-left), side (top-right), three-quarter (bottom-left), top-down (bottom-right), white background, orthographic projection, consistent design"*
5. Feed the 4 views into Hyper3D Rodin → Blender MCP → STL → print

This works because Nano Banana SEES the car in the reference image and understands its 3D
structure. No consistency hacks needed — the model rotates the same car, not imagining a new one.

### Alternative: Pure T2I (All 16 Prompts Below)

1. Copy any prompt below into Nano Banana (fal.ai, Google AI Studio, or WaveSpeedAI)
2. Set aspect ratio to **1:1** and resolution to **1K** minimum
3. Generate all 4 views of your chosen model + print tech combo
4. Feed the 4 images into Hyper3D Rodin (via Blender MCP or standalone)
5. Clean up mesh → export STL → slice → print

For the **multi-image sheet** approach (all 4 views in one generation), see
the combined prompts at the end of each section.

---

## 1. STOCK DMC-12 — FDM Print

Classic stainless steel DeLorean. Chunky, printable geometry optimized for
FDM layer-by-layer construction. Think desk display piece.

### Front View
```
product design, 1982 DeLorean DMC-12 sports car with brushed stainless steel body panels
and black rubber trim accents, matte PLA plastic finish with subtle visible horizontal
layer lines, chunky solid proportions suitable for FDM 3D printing, flat rectangular base
2mm thick for bed adhesion, simplified wheel geometry, no thin protruding parts thinner
than 2mm, sealed gullwing doors in closed position, front view, straight-on camera angle,
centered in frame, orthographic projection, white background, even studio lighting,
technical reference sheet style, isolated object, no environment, best quality
```

### Side View
```
product design, 1982 DeLorean DMC-12 sports car with brushed stainless steel body panels
and black rubber trim accents, matte PLA plastic finish with subtle visible horizontal
layer lines, chunky solid proportions suitable for FDM 3D printing, flat rectangular base
2mm thick for bed adhesion, simplified wheel geometry, no thin protruding parts thinner
than 2mm, sealed gullwing doors in closed position, right side profile view, perpendicular
to front, centered in frame, orthographic projection, white background, even studio
lighting, technical reference sheet style, isolated object, no environment, best quality
```

### Three-Quarter View
```
product design, 1982 DeLorean DMC-12 sports car with brushed stainless steel body panels
and black rubber trim accents, matte PLA plastic finish with subtle visible horizontal
layer lines, chunky solid proportions suitable for FDM 3D printing, flat rectangular base
2mm thick for bed adhesion, simplified wheel geometry, no thin protruding parts thinner
than 2mm, sealed gullwing doors in closed position, three-quarter view from front-right
at 45 degrees, slightly elevated camera angle, orthographic projection, white background,
even studio lighting, technical reference sheet style, isolated object, no environment,
best quality
```

### Top-Down View
```
product design, 1982 DeLorean DMC-12 sports car with brushed stainless steel body panels
and black rubber trim accents, matte PLA plastic finish with subtle visible horizontal
layer lines, chunky solid proportions suitable for FDM 3D printing, flat rectangular base
2mm thick for bed adhesion, simplified wheel geometry, no thin protruding parts thinner
than 2mm, sealed gullwing doors in closed position, top-down overhead view, bird's eye
perspective, looking straight down, orthographic projection, white background, even studio
lighting, technical reference sheet style, isolated object, no environment, best quality
```

### Combined Multi-Image Sheet
```
technical reference sheet showing a 1982 DeLorean DMC-12 with brushed stainless steel
body and black trim from four angles: front view (top-left), side profile (top-right),
three-quarter view (bottom-left), top-down view (bottom-right), matte PLA 3D printed
appearance with visible layer lines, chunky FDM-ready proportions, flat base, white
background, orthographic projection, consistent design across all views, studio lighting,
product photography, best quality
```

---

## 2. STOCK DMC-12 — Resin/SLA Print

Same classic DeLorean but optimized for resin printing — smooth surface, sharp panel
lines, fine details preserved. Perfect for 1:32 Scalextric scale.

### Front View
```
product design, 1982 DeLorean DMC-12 sports car with brushed stainless steel body panels
and black rubber trim accents, smooth matte resin finish, SLA 3D printed miniature
appearance, extremely fine surface detail, sharp crisp panel lines and body creases,
visible door seams and headlight bezels, thin flat base, high-resolution print quality,
gullwing doors in closed position, front view, straight-on camera angle, centered in
frame, orthographic projection, white background, even studio lighting, technical
reference sheet style, isolated object, no environment, best quality
```

### Side View
```
product design, 1982 DeLorean DMC-12 sports car with brushed stainless steel body panels
and black rubber trim accents, smooth matte resin finish, SLA 3D printed miniature
appearance, extremely fine surface detail, sharp crisp panel lines and body creases,
visible door seams and window frames, thin flat base, high-resolution print quality,
gullwing doors in closed position, right side profile view, perpendicular to front,
centered in frame, orthographic projection, white background, even studio lighting,
technical reference sheet style, isolated object, no environment, best quality
```

### Three-Quarter View
```
product design, 1982 DeLorean DMC-12 sports car with brushed stainless steel body panels
and black rubber trim accents, smooth matte resin finish, SLA 3D printed miniature
appearance, extremely fine surface detail, sharp crisp panel lines and body creases,
visible door seams and air intakes, thin flat base, high-resolution print quality,
gullwing doors in closed position, three-quarter view from front-right at 45 degrees,
slightly elevated camera angle, orthographic projection, white background, even studio
lighting, technical reference sheet style, isolated object, no environment, best quality
```

### Top-Down View
```
product design, 1982 DeLorean DMC-12 sports car with brushed stainless steel body panels
and black rubber trim accents, smooth matte resin finish, SLA 3D printed miniature
appearance, extremely fine surface detail, sharp crisp panel lines, visible roof louvers
and rear deck detail, thin flat base, high-resolution print quality, gullwing doors in
closed position, top-down overhead view, bird's eye perspective, looking straight down,
orthographic projection, white background, even studio lighting, technical reference
sheet style, isolated object, no environment, best quality
```

### Combined Multi-Image Sheet
```
technical reference sheet showing a 1982 DeLorean DMC-12 with brushed stainless steel
body and black trim from four angles: front view (top-left), side profile (top-right),
three-quarter view (bottom-left), top-down view (bottom-right), smooth SLA resin printed
miniature appearance with sharp panel lines and fine detail, thin flat base, white
background, orthographic projection, consistent design across all views, studio lighting,
product photography, best quality
```

---

## 3. BACK TO THE FUTURE DELOREAN — FDM Print

The time machine. Flux capacitor housing, Mr. Fusion on the engine lid, time circuit
cables running along the body, vented hood, modified rear deck. FDM-optimized with
chunky details that survive layer-based printing.

### Front View
```
product design, Back to the Future DeLorean time machine with brushed stainless steel
body, exposed flux capacitor wiring and cables along the body panels, Mr. Fusion reactor
on rear engine cover, time circuit control panel visible through windshield, modified front
bumper with extra lighting, matte PLA plastic finish with subtle visible horizontal layer
lines, chunky solid proportions suitable for FDM 3D printing, flat rectangular base 2mm
thick for bed adhesion, simplified cable geometry as raised surface detail rather than
freestanding wires, no thin protruding parts thinner than 2mm, front view, straight-on
camera angle, centered in frame, orthographic projection, white background, even studio
lighting, technical reference sheet style, isolated object, no environment, best quality
```

### Side View
```
product design, Back to the Future DeLorean time machine with brushed stainless steel
body, exposed flux capacitor wiring and cables along the body panels, Mr. Fusion reactor
on rear engine cover, time circuit cables running along the rocker panels, modified side
vents, matte PLA plastic finish with subtle visible horizontal layer lines, chunky solid
proportions suitable for FDM 3D printing, flat rectangular base 2mm thick for bed
adhesion, simplified cable geometry as raised surface detail rather than freestanding
wires, no thin protruding parts thinner than 2mm, right side profile view, perpendicular
to front, centered in frame, orthographic projection, white background, even studio
lighting, technical reference sheet style, isolated object, no environment, best quality
```

### Three-Quarter View
```
product design, Back to the Future DeLorean time machine with brushed stainless steel
body, exposed flux capacitor wiring and cables along the body panels, Mr. Fusion reactor
visible on rear, modified hood vents and extra wiring harnesses, matte PLA plastic finish
with subtle visible horizontal layer lines, chunky solid proportions suitable for FDM
3D printing, flat rectangular base 2mm thick for bed adhesion, simplified cable geometry
as raised surface detail, no thin protruding parts thinner than 2mm, three-quarter view
from front-right at 45 degrees, slightly elevated camera angle, orthographic projection,
white background, even studio lighting, technical reference sheet style, isolated object,
no environment, best quality
```

### Top-Down View
```
product design, Back to the Future DeLorean time machine with brushed stainless steel
body, exposed flux capacitor wiring and cables visible on roof and body, Mr. Fusion
reactor on rear engine cover seen from above, time circuit cables along body sides, matte
PLA plastic finish with subtle visible horizontal layer lines, chunky solid proportions
suitable for FDM 3D printing, flat rectangular base 2mm thick, simplified cable geometry
as raised surface detail, top-down overhead view, bird's eye perspective, looking straight
down, orthographic projection, white background, even studio lighting, technical reference
sheet style, isolated object, no environment, best quality
```

### Combined Multi-Image Sheet
```
technical reference sheet showing a Back to the Future DeLorean time machine with
stainless steel body, flux capacitor wiring, Mr. Fusion reactor, and time circuit cables
from four angles: front view (top-left), side profile (top-right), three-quarter view
(bottom-left), top-down view (bottom-right), matte PLA 3D printed appearance with visible
layer lines, chunky FDM-ready proportions, cables as raised surface detail, flat base,
white background, orthographic projection, consistent design across all views, studio
lighting, product photography, best quality
```

---

## 4. BACK TO THE FUTURE DELOREAN — Resin/SLA Print

The time machine in gorgeous resin detail. Every wire, every panel fastener, every
time circuit readout — preserved at 1:32 scale. The hero piece for your Tower Print demo.

### Front View
```
product design, Back to the Future DeLorean time machine with brushed stainless steel
body, finely detailed flux capacitor wiring and cables along body panels, Mr. Fusion
reactor on rear engine cover, time circuit control panel visible through windshield,
modified front bumper with miniature lighting details, smooth matte resin finish, SLA
3D printed miniature appearance, extremely fine surface detail, sharp crisp panel lines,
individual cable strands and connector details visible, thin flat base, high-resolution
print quality, front view, straight-on camera angle, centered in frame, orthographic
projection, white background, even studio lighting, technical reference sheet style,
isolated object, no environment, best quality
```

### Side View
```
product design, Back to the Future DeLorean time machine with brushed stainless steel
body, finely detailed flux capacitor wiring and cables running along rocker panels,
Mr. Fusion reactor on rear engine cover, time circuit cables with individual wire detail,
side-mounted equipment boxes, smooth matte resin finish, SLA 3D printed miniature
appearance, extremely fine surface detail, sharp crisp panel lines and seams, thin flat
base, high-resolution print quality, right side profile view, perpendicular to front,
centered in frame, orthographic projection, white background, even studio lighting,
technical reference sheet style, isolated object, no environment, best quality
```

### Three-Quarter View
```
product design, Back to the Future DeLorean time machine with brushed stainless steel
body, finely detailed flux capacitor wiring and cables, Mr. Fusion reactor visible on
rear engine cover, modified hood vents with fine mesh detail, extra wiring harnesses with
individual connectors, smooth matte resin finish, SLA 3D printed miniature appearance,
extremely fine surface detail, sharp crisp edges, thin flat base, high-resolution print
quality, three-quarter view from front-right at 45 degrees, slightly elevated camera
angle, orthographic projection, white background, even studio lighting, technical
reference sheet style, isolated object, no environment, best quality
```

### Top-Down View
```
product design, Back to the Future DeLorean time machine with brushed stainless steel
body, finely detailed flux capacitor wiring visible on roof and sides, Mr. Fusion reactor
on rear engine cover seen from above, intricate time circuit cable routing along body,
smooth matte resin finish, SLA 3D printed miniature appearance, extremely fine surface
detail from above, sharp panel lines and fastener details, thin flat base, high-resolution
print quality, top-down overhead view, bird's eye perspective, looking straight down,
orthographic projection, white background, even studio lighting, technical reference
sheet style, isolated object, no environment, best quality
```

### Combined Multi-Image Sheet
```
technical reference sheet showing a Back to the Future DeLorean time machine with
stainless steel body, detailed flux capacitor wiring, Mr. Fusion reactor, and time
circuit cables from four angles: front view (top-left), side profile (top-right),
three-quarter view (bottom-left), top-down view (bottom-right), smooth SLA resin printed
miniature with extremely fine detail, sharp panel lines, individual cable detail, thin
flat base, white background, orthographic projection, consistent design across all views,
studio lighting, product photography, best quality
```

---

## 🎯 BONUS: BTTF Exploded View (For the "Wow" Demo)

Use this single prompt to generate a jaw-dropping exploded diagram showing all the
time machine modifications as separate components. Perfect for a multi-part print kit
or just to blow your friend's mind.

```
product design, Back to the Future DeLorean time machine with brushed stainless steel
and copper wiring accents, exploded view diagram, showing separated components including
body shell, chassis frame, flux capacitor unit, Mr. Fusion reactor, time circuit display
panel, plutonium chamber, rear rocket housing, modified wheels and suspension, gullwing
doors detached, hood with cooling vents, interior bucket seats, wiring harness bundles,
white background, three-dimensional, highly detailed internal components, studio lighting,
product photography, best quality
```

---

## 📋 Slicer Cheat Sheet

### FDM (Stock or BTTF)
| Setting | Value |
|---|---|
| Layer height | 0.12mm (detail) / 0.20mm (speed) |
| Infill | 15% gyroid |
| Supports | Tree supports, 45° threshold |
| Base | Brim 5mm for bed adhesion |
| Filament | Silver/metallic PLA for authenticity |

### Resin/SLA (Stock or BTTF)
| Setting | Value |
|---|---|
| Layer height | 0.03mm |
| Exposure | Per-resin calibration |
| Supports | Light auto + manual island check |
| Orientation | 30-45° tilt for best detail |
| Post-process | IPA wash → UV cure → prime → paint |

---

## 🔗 Next Steps After Generation

1. Download all 4 views (or the multi-image sheet)
2. Open Blender with MCP server running
3. Tell Claude: *"Generate a 3D model from these reference images using Hyper3D"*
4. Clean up: *"Make the mesh manifold, add a flat 2mm base, check wall thickness"*
5. Scale: *"Set the model to [X]cm long"* (1:32 scale DeLorean ≈ 13.3cm)
6. Export: *"Export as STL"*
7. Slice with your preferred slicer
8. Print it. Hold it. Show your friend. Get a free printer. 😎
