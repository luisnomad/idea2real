# idea2real by NotJustPrompts

Turn any image into a 3D-printable STL — directly from Blender.

**idea2real** is a Blender addon that connects AI-powered 3D reconstruction (Hunyuan3D v3) with a print-ready cleanup pipeline. Upload an image, click a button, get a printable STL.

## How It Works

1. **Upload an image** — any photo, render, or AI-generated image of the object you want to print
2. **Generate 3D** — Hunyuan3D v3 (via fal.ai) reconstructs a 500K-face watertight mesh
3. **Auto cleanup** — one-click pipeline: merge doubles, decimate, flatten base, scale to target size
4. **Export STL** — ready for your slicer (PrusaSlicer, Cura, OrcaSlicer, Chitubox, etc.)

Optionally, generate the input image from text using Nano Banana (Google Gemini Flash Image) — built into the addon.

## Requirements

- **Blender 3.6+** (tested on Blender 5.0)
- **fal.ai API key** — get one at [fal.ai/dashboard/keys](https://fal.ai/dashboard/keys)

## Installation

1. Copy `nb3dp_addon.py` to your Blender addons directory:
   - **macOS:** `~/Library/Application Support/Blender/5.0/scripts/addons/`
   - **Windows:** `%APPDATA%\Blender Foundation\Blender\5.0\scripts\addons\`
   - **Linux:** `~/.config/blender/5.0/scripts/addons/`
2. In Blender: **Edit > Preferences > Add-ons** — search "idea2real" and enable it
3. Set your fal.ai API key in the addon preferences
4. Open the sidebar (**N** key) and click the **idea2real** tab

## Supported Print Technologies

| Tech | Best For | Key Traits |
|---|---|---|
| **FDM** | Prototypes, large prints | Matte PLA, 1.2mm min wall, 45deg overhang limit |
| **Resin/SLA** | Detail, miniatures | Smooth finish, optional hollowing, fine features |
| **SLS** | Functional parts | Nylon powder, self-supporting, 0.7mm min wall |

## Project Structure

```
idea2real/
├── nb3dp_addon.py          # The Blender addon (single file)
├── CLAUDE.md               # Instructions for AI assistants
├── docs/
│   └── ARCHITECTURE.md     # Architecture decisions & technical context
├── prompts/                # Prompt templates for image generation
├── poc/                    # Proof-of-concept results (DeLorean prints)
├── scripts/                # Utility scripts (comparison, generation)
└── .claude/skills/         # Claude Code skill definitions
```

## Documentation

- **[Architecture & Decisions](docs/ARCHITECTURE.md)** — why things are the way they are, what options exist, Blender limitations
- **[CLAUDE.md](CLAUDE.md)** — project context for AI assistants working on this codebase

## Status

Active development. The addon works end-to-end: image upload through STL export. Tested with DeLorean BTTF models printed via Tower Print.

## License

Private project by NotJustPrompts.
