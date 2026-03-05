# idea2real by NotJustPrompts

Turn any image into a 3D-printable STL from Blender, with an optional web pipeline under active development.

## Core Product

`idea2real` focuses on image-to-3D generation and print-ready cleanup:

1. Upload or generate an input image
2. Generate 3D with Hunyuan3D (via fal.ai)
3. Run cleanup for printability
4. Export STL for your slicer

## What Lives Here

- Blender add-on: `nb3dp_addon.py`
- Web app (in progress): `apps/web`, `apps/api`, `services/geometry`, `packages/contracts`
- 3D prompts and PoCs: `prompts/`, `poc/`
- Product and architecture docs: `docs/`

## Repository Structure

```text
idea2real/
├── nb3dp_addon.py
├── apps/
│   ├── web/
│   └── api/
├── services/
│   └── geometry/
├── packages/
│   └── contracts/
├── docs/
│   ├── ARCHITECTURE.md
│   └── project/
├── prompts/
├── poc/
└── scripts/
```

## Documentation

- [Architecture & Decisions](docs/ARCHITECTURE.md)
- [Project Development Plan](docs/project/DEVELOPMENT_PLAN.md)
- [Frontend UI Direction](docs/project/FRONTEND_UI_DIRECTION.md)
- [Security Baseline](docs/project/SECURITY_BASELINE.md)
- [Contributing](CONTRIBUTING.md)

## Note on Agentic Tooling

The local multi-agent orchestration tooling was extracted to:
`/Volumes/SSD_Storage2TB/Users/luisnomad/Projects/agentic-ai-project-template`

This repository is now intentionally product-focused for 3D workflows.

## License

Private project by NotJustPrompts.
