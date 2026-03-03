# Nano Banana Prompt Templates for 3D Printing

Tested prompt templates optimized for generating multi-angle reference images that produce
clean, printable 3D reconstructions. Each template encodes manufacturing constraints
directly into the visual output.

## Table of Contents

1. [Universal Prompt Structure](#universal-prompt-structure)
2. [View Angle Specifications](#view-angle-specifications)
3. [FDM Print Prompts](#fdm-print-prompts)
4. [Resin/SLA Print Prompts](#resinsla-print-prompts)
5. [SLS Print Prompts](#sls-print-prompts)
6. [Consistency Techniques](#consistency-techniques)
7. [Advanced: Functional Part Prompts](#advanced-functional-part-prompts)

---

## Universal Prompt Structure

Every prompt follows this formula:

```
[OBJECT], [MATERIAL/SURFACE], [PRINT CONSTRAINTS], [VIEW], [TECHNICAL SETUP]
```

The components:

- **OBJECT**: What you're making, with aesthetic descriptors (e.g., "low-poly fox figurine with geometric facets")
- **MATERIAL/SURFACE**: How the printed surface should look — this is what encodes printability
- **PRINT CONSTRAINTS**: Structural rules like "flat base," "no thin spikes," "chunky proportions"
- **VIEW**: Camera angle (front, side, three-quarter, top)
- **TECHNICAL SETUP**: "orthographic projection, white background, studio lighting, technical reference sheet"

The TECHNICAL SETUP suffix is critical — it tells Nano Banana to render clean, reconstruction-friendly images
rather than artistic compositions with dramatic lighting and perspective distortion.

---

## View Angle Specifications

Generate these 4 views for every object. Use these exact angle descriptions for consistency:

### Front View (0°)
```
... front view, straight-on camera angle, centered in frame ...
```

### Side View (90°)
```
... right side profile view, perpendicular to front, centered in frame ...
```

### Three-Quarter View (45°)
```
... three-quarter view from front-right at 45 degrees, slightly elevated camera angle ...
```

### Top-Down View
```
... top-down overhead view, bird's eye perspective, looking straight down ...
```

For all views, always append:
```
orthographic projection, white background, even studio lighting, no shadows on background,
technical reference sheet style, isolated object, no environment
```

---

## FDM Print Prompts

FDM prints have visible layer lines, matte finishes, and need chunky geometry with minimal overhangs.
The prompts should produce images that look like actual FDM prints.

### Surface Texture Keywords
```
matte PLA plastic finish, subtle visible horizontal layer lines, slightly rough texture,
3D printed appearance, FDM manufactured look
```

### Structural Constraint Keywords
```
flat circular base for 3D printer bed adhesion, chunky proportions, no thin protruding
parts thinner than 2mm, no unsupported overhangs greater than 45 degrees, solid
construction, rounded edges where possible, minimum wall thickness 1.2mm
```

### FDM Template — Figurine/Decorative
```
A [OBJECT DESCRIPTION] with [AESTHETIC DETAILS], matte PLA plastic finish with subtle
visible horizontal layer lines, chunky solid proportions suitable for FDM 3D printing,
flat circular base 2mm thick for bed adhesion, no thin protruding elements, no
unsupported overhangs, rounded edges, [VIEW ANGLE], orthographic projection, white
background, even studio lighting, technical reference sheet, isolated object
```

### FDM Template — Functional Part
```
A [FUNCTIONAL PART DESCRIPTION], matte gray PLA plastic, visible layer lines typical of
FDM 3D printing, engineering tolerances with 0.2mm clearance on moving parts, flat bottom
surface for print bed, reinforced stress points with fillets, chamfered bottom edges
to prevent elephant's foot, [VIEW ANGLE], orthographic projection, white background,
even studio lighting, technical reference sheet, isolated object
```

### FDM Color Variations
To suggest specific filament colors (helps the reconstruction understand material):
```
... matte [COLOR] PLA filament finish ...
```
Common: "matte white PLA," "matte gray PLA," "matte black PLA," "translucent PETG"

---

## Resin/SLA Print Prompts

Resin prints are smooth, high-detail, with sharp edges. Prompts should produce images
that look like professional resin miniatures.

### Surface Texture Keywords
```
smooth resin print finish, high detail resolution, sharp crisp edges, SLA 3D printed
appearance, matte or semi-gloss resin surface, no visible layer lines
```

### Structural Constraint Keywords
```
thin flat base or integrated support nubs, fine detail preserved, hollow-compatible
geometry with minimum 1.5mm wall thickness, drain hole locations at lowest points,
delicate features allowed down to 0.3mm, sharp edges permitted
```

### Resin/SLA Template — Miniature/Figurine
```
A [OBJECT DESCRIPTION] with [FINE DETAILS], smooth matte resin finish, SLA 3D printed
miniature appearance, extremely fine surface detail, sharp crisp edges, thin flat base,
delicate features preserved, high-resolution print quality, [VIEW ANGLE], orthographic
projection, white background, even studio lighting, technical reference sheet, isolated object
```

### Resin/SLA Template — Jewelry/Precision
```
A [OBJECT DESCRIPTION], smooth polished resin surface, jewelry-quality detail, precise
sharp edges, thin walls with uniform thickness around 1.5mm, castable resin appearance,
intricate surface patterns clearly defined, [VIEW ANGLE], orthographic projection,
white background, even studio lighting, technical reference sheet, isolated object
```

---

## SLS Print Prompts

SLS prints have a characteristic powdery/granular surface, no support structures needed,
and can achieve complex interlocking geometry.

### Surface Texture Keywords
```
matte powdery nylon surface, SLS 3D printed finish, slightly granular texture,
uniform matte white or gray appearance, sintered powder look
```

### Structural Constraint Keywords
```
self-supporting geometry (no supports needed), minimum wall thickness 0.7mm, escape
holes for trapped powder, interlocking parts allowed, living hinges possible at 0.5mm,
complex internal channels permitted
```

### SLS Template — Functional/Mechanical
```
A [OBJECT DESCRIPTION], matte white nylon SLS 3D printed finish, slightly granular
powdery surface texture, complex geometry with internal features, self-supporting
structure, minimum 0.7mm wall thickness throughout, powder escape holes visible,
engineering-grade appearance, [VIEW ANGLE], orthographic projection, white background,
even studio lighting, technical reference sheet, isolated object
```

### SLS Template — Artistic/Complex
```
A [OBJECT DESCRIPTION] with [COMPLEX FEATURES], matte nylon SLS printed surface,
intricate interlocking or nested geometry, no support structures visible, granular
matte finish, complex lattice or organic structures, [VIEW ANGLE], orthographic
projection, white background, even studio lighting, technical reference sheet, isolated object
```

---

## Consistency: The I2I-First Workflow (Recommended)

The biggest challenge with multi-angle generation is keeping the object identical across
views. The solution is simple and elegant: **don't generate 4 separate images from text.
Generate ONE hero image, then use Nano Banana's image-to-image (I2I) mode to produce
the other angles from that reference.**

This works because Nano Banana is built on Gemini's multimodal reasoning — it can SEE
the object in the reference image and understand its 3D structure, materials, and
proportions. When you ask for a different angle, it rotates the same object rather than
imagining a new one.

### The Primary Workflow

**Step 1: Generate one perfect hero image (T2I)**

Use the text-to-image prompts from this document to generate a single three-quarter
view. This is your "source of truth" for the object's design.

```
[Full T2I prompt for your object], three-quarter view from front-right at 45 degrees,
slightly elevated camera angle, [technical setup suffix]
```

Review it. Regenerate if needed. Get it right — everything else flows from this image.

**Step 2: Generate remaining angles via I2I**

Feed the hero image back into Nano Banana's image-to-image mode with angle-change prompts:

```
Show me this exact same object from a front view, straight-on camera angle,
maintaining identical design, materials, and proportions, orthographic projection,
white background, studio lighting
```

```
Show me this exact same object from a right side profile view, perpendicular to
the front, maintaining identical design, materials, and proportions, orthographic
projection, white background, studio lighting
```

```
Show me this exact same object from a top-down overhead view, bird's eye perspective,
looking straight down, maintaining identical design, materials, and proportions,
orthographic projection, white background, studio lighting
```

**Step 3: Or generate a multi-angle grid in one shot (even better)**

Feed the hero image and ask Nano Banana to produce all views at once:

```
Create a 4-angle technical reference sheet of this exact object: front view (top-left),
side profile (top-right), three-quarter view (bottom-left), top-down view (bottom-right),
maintaining identical design and materials across all views, white background,
orthographic projection, studio lighting, product photography
```

This is the most consistent approach because all 4 views are generated in a single pass
with the reference image anchoring the design.

### Why I2I-First Beats Pure T2I for Multi-Angle

- **Perfect consistency** — the model sees the actual object, not just a text description
- **No seed hacking** — consistency is structural, not probabilistic
- **Faster iteration** — change one hero image, regenerate all angles
- **Works for complex designs** — intricate details that are hard to describe in text
  are preserved visually from the reference
- **Material accuracy** — surface textures, colors, and finishes carry over exactly

### Fallback: Pure T2I Consistency Techniques

If I2I is unavailable or you prefer pure text-to-image, these techniques help:

**Anchor Description**: Start every prompt with the EXACT same object description, word
for word. Only change the view angle.

**Character Sheet Framing**: Add to every prompt:
```
character design reference sheet, model sheet, consistent design across all views
```

**Multi-Image Batch**: Use Nano Banana Pro Multi endpoint for all 4 views in one call:
```
Technical reference sheet showing a [OBJECT] from four angles: front view (top-left),
side view (top-right), three-quarter view (bottom-left), top-down view (bottom-right),
[SURFACE/MATERIAL], white background, orthographic projection, consistent design
```

**Seed Control** (API): Set a consistent seed across separate generations:
```json
{ "seed": 42, "prompt": "..." }
```
Same seed + similar prompt = more consistent output (not guaranteed with all models).

---

## Advanced: Functional Part Prompts

For parts that need to actually work (brackets, enclosures, snap-fits):

### Snap-Fit Joint
```
A 3D printed snap-fit enclosure box, matte gray PLA, visible FDM layer lines,
two-piece design with snap hooks and catches visible, 1.5mm wall thickness,
0.3mm clearance gaps at joints, chamfered entry ramps on hooks, flat base,
[VIEW], orthographic projection, white background, technical reference sheet
```

### Threaded Connection
```
A 3D printed threaded bottle cap and neck, matte PLA plastic, visible thread
profile with 2mm pitch, M20 thread size, chamfered thread entry, knurled grip
texture on cap exterior, [VIEW], orthographic projection, white background,
technical reference sheet
```

### Living Hinge (SLS only)
```
A 3D printed nylon box with living hinge, SLS sintered powder finish, thin
flexible hinge section at 0.5mm, rigid body walls at 2mm, rounded hinge
transition to prevent stress concentration, [VIEW], orthographic projection,
white background, technical reference sheet
```

### Electronics Enclosure
```
A 3D printed Raspberry Pi enclosure, matte black PLA, FDM layer lines visible,
ventilation slots on sides, micro USB and HDMI port cutouts, snap-fit lid,
mounting standoffs inside, flat base with rubber foot recesses, [VIEW],
orthographic projection, white background, technical reference sheet
```

---

## Exploded View Diagrams (Multi-Part Assemblies)

This is one of Nano Banana's superpowers. A single prompt can generate a fully labeled,
spatially accurate exploded view showing every internal component of a complex object.
This is invaluable for designing multi-part 3D print kits (snap-fit assemblies, model kits,
mechanical devices with moving parts).

### The Core Formula

```
product design, [OBJECT with MATERIAL accents], exploded view diagram,
white background, three-dimensional, highly detailed internal components,
studio lighting, product photography, best quality
```

This prompt architecture works because each element serves the 3D reconstruction pipeline:

- **"product design"** — triggers industrial/engineering visual language
- **"exploded view diagram"** — spatially separates components along assembly axes
- **"three-dimensional"** — forces depth and perspective, not flat illustration
- **"highly detailed internal components"** — exposes internal structure for part separation
- **"white background"** — clean isolation for image-to-3D reconstruction
- **"studio lighting, product photography"** — neutral, even lighting with no dramatic shadows
- **"best quality"** — pushes generation toward maximum detail and coherence

### Exploded View Templates

**Vehicle / Complex Mechanical:**
```
product design, [VEHICLE TYPE] with [MATERIAL] accents, exploded view diagram,
white background, three-dimensional, highly detailed internal components,
labeled parts, studio lighting, product photography, best quality
```

**Consumer Product:**
```
product design, [PRODUCT] with [FINISH] accents, exploded view diagram,
white background, three-dimensional, all internal mechanisms visible,
studio lighting, product photography, best quality
```

**Wearable / Small Device:**
```
product design, [DEVICE] with [MATERIAL] housing, exploded view diagram,
white background, three-dimensional, PCB and internal electronics visible,
studio lighting, product photography, best quality
```

**Architectural / Furniture:**
```
product design, [FURNITURE/STRUCTURE] with [WOOD/METAL] joinery, exploded view
diagram, white background, three-dimensional, all joints and fasteners visible,
studio lighting, product photography, best quality
```

### Multi-Part Print Kit Workflow

The exploded view approach enables a powerful extension of the standard pipeline:

1. Generate exploded view with Nano Banana using the formula above
2. Each visible component becomes a separate mesh in reconstruction
3. In Blender MCP: "Separate the mesh by loose parts"
4. Clean each part individually for printability
5. Add alignment pins / snap-fit features between mating surfaces
6. Export each part as a separate STL
7. Print, assemble, enjoy your AI-generated model kit

### Adding Print-Technology Surface to Exploded Views

Combine the exploded view formula with print surface keywords:

**FDM Kit:**
```
product design, [OBJECT] with matte PLA plastic finish accents, exploded view
diagram, white background, three-dimensional, highly detailed internal components,
chunky printable proportions, no thin fragile parts, studio lighting,
product photography, best quality
```

**Resin Kit:**
```
product design, [OBJECT] with smooth resin finish accents, exploded view diagram,
white background, three-dimensional, highly detailed internal components,
fine crisp details, sharp edges, studio lighting, product photography, best quality
```

### Example Prompts (Tested)

**EV Hypercar:**
```
product design, aero-EV sports coupe with carbon fiber accents, exploded view
diagram, white background, three-dimensional, highly detailed internal components,
studio lighting, product photography, best quality
```

**Mechanical Watch:**
```
product design, luxury chronograph watch with brushed titanium accents, exploded
view diagram, white background, three-dimensional, highly detailed internal
components, gears and springs visible, studio lighting, product photography,
best quality
```

**Gaming Controller:**
```
product design, ergonomic gaming controller with translucent shell accents,
exploded view diagram, white background, three-dimensional, highly detailed
internal components, buttons triggers PCB visible, studio lighting, product
photography, best quality
```

**Drone:**
```
product design, compact racing drone with carbon fiber frame accents, exploded
view diagram, white background, three-dimensional, highly detailed internal
components, motors ESCs flight controller visible, studio lighting, product
photography, best quality
```

---

## Exploded View Assembly Prompts

This is a powerful advanced technique. Instead of generating 4 angles of a single object,
you generate a single exploded view diagram that shows every internal component in its
correct spatial position. This is ideal for:

- **Multi-part print kits** — each component becomes a separate STL
- **Understanding internal structure** before deciding what to print
- **Assembly documentation** — the exploded view IS the build guide
- **Complex mechanical objects** — vehicles, engines, gadgets, electronics

### The Core Exploded View Template

This proven template produces stunning results with Nano Banana:

```
product design, [OBJECT with MATERIAL accents], exploded view diagram,
white background, three-dimensional, highly detailed internal components,
studio lighting, product photography, best quality
```

The key phrases and why they matter:

- **"product design"** — primes the model for industrial/manufacturing aesthetics
- **"exploded view diagram"** — triggers the spatial separation of components
- **"with [MATERIAL] accents"** — gives Nano Banana material cues that translate to
  distinct printable parts (carbon fiber body vs aluminum frame vs rubber seals)
- **"three-dimensional"** — ensures depth and correct spatial relationships, not flat illustration
- **"highly detailed internal components"** — forces the model to generate actual internals,
  not just a shell
- **"studio lighting, product photography"** — clean, even lighting for reconstruction
- **"best quality"** — quality booster that improves detail and coherence

### Exploded View Variations

**Vehicle / Mechanical:**
```
product design, [electric sports car / motorcycle / drone] with carbon fiber
and brushed aluminum accents, exploded view diagram, white background,
three-dimensional, highly detailed internal components including motors
and electronics, studio lighting, product photography, best quality
```

**Consumer Product:**
```
product design, [wireless headphones / smartwatch / game controller] with
matte plastic and metal accents, exploded view diagram, white background,
three-dimensional, showing PCB and battery and speakers, studio lighting,
product photography, best quality
```

**Architecture / Model:**
```
product design, [miniature building / space station module / robot] with
metallic and composite material accents, exploded view cutaway diagram,
white background, three-dimensional, highly detailed structural components,
studio lighting, product photography, best quality
```

**Printable Assembly Kit:**
Add print-specific cues to make each component directly reconstructable:
```
product design, [OBJECT] with [MATERIAL] accents, exploded view diagram
showing snap-fit assembly, chunky solid components suitable for 3D printing,
visible connection points between parts, white background, three-dimensional,
highly detailed internal components, studio lighting, product photography,
best quality
```

### Pipeline: Exploded View → Multi-Part Print Kit

1. **Generate** the exploded view with Nano Banana
2. **Identify** individual components visually (body, frame, motor, wheels, etc.)
3. **Generate separate reference views** for each component you want to print:
   ```
   product design, isolated [COMPONENT NAME] from [OBJECT], same style as
   technical diagram, [PRINT SURFACE PROMPT], front view, orthographic
   projection, white background, studio lighting, best quality
   ```
4. **Reconstruct** each component separately via Hyper3D
5. **Test-fit** in Blender MCP: import all parts and verify they align
6. **Export** each as a separate STL
7. **Print** and physically assemble — you've got a model kit from a text prompt

### Labeled vs Unlabeled

Nano Banana can generate clean technical labels on the diagram (as seen in the
EV hypercar example). This is useful for documentation but can confuse mesh
reconstruction. Strategy:

- **With labels** → for documentation, README, assembly guide
- **Without labels** → for mesh reconstruction input
  Add "no text, no labels, no annotations" to suppress text rendering
