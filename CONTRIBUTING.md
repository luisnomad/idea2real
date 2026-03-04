# Contributing

## Setup

```bash
bash scripts/bootstrap.sh     # one-time local setup
source .venv/bin/activate
make test                     # verify everything works
```

Or with Docker (no local Python needed):

```bash
docker compose run --rm test
```

## Workflow

1. Check out a branch named `<agent-or-user>/<slice-id>-<short-description>`
2. Follow the TDD loop: failing test → minimal fix → refactor
3. Run `make lint && make test` before pushing
4. Open a PR targeting `main`; CI must be green

## Code style

- Python: flake8, max line length 100
- Commits: `[SLICE-ID] imperative message` (e.g. `[P0-INFRA-1] Add CI matrix`)
- One logical change per commit

## Project structure

```
idea2real/
├── nb3dp_addon.py          # Blender addon (single file)
├── scripts/                # Utility scripts (compare providers, image gen)
├── tests/                  # pytest test suite
├── docs/                   # Architecture and project docs
├── poc/                    # Proof-of-concept results (read-only)
├── prompts/                # Prompt templates
└── vendor/                 # Third-party code (never modify)
```

## Running tests

```bash
make test              # local
make docker-test       # in Docker
pytest tests/ -v -k infra   # targeted: infra tests only
```

## CI

GitHub Actions runs `lint` and `test` jobs across Python 3.10, 3.11, 3.12 on every push.
See `.github/workflows/ci.yml`.
