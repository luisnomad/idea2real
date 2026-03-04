# Development Plan

## Product Goal

Build a web platform for 3D-printer users to convert images into printable models, refine them for manufacturing, and manage a reusable model library.

The web app should be meaningfully better than a thin Hunyuan wrapper by combining:

- Prompt assistance (system prompts, raw prompts, and prompt improvement on demand).
- Robust print-oriented geometry cleanup.
- 3D-first UX with real-time preview.
- History and gallery workflows that make iteration easy.

## Target Architecture

- Frontend: React 19 + TypeScript, Vite, Tailwind v4, shadcn/ui + Radix, React Three Fiber + Drei, TanStack Query.
- Core backend: Hono (Node/Bun), Drizzle ORM + PostgreSQL, S3-compatible storage (AWS SDK), BullMQ queue, fal.ai JS SDK.
- Geometry backend: FastAPI + `trimesh` + `pymeshlab` + `pygltflib`.
- Auth (early): API key per user or simple email/password + JWT.
- Deployment target: single cheap VPS with Docker Compose, with optional managed object storage.

## Non-Negotiable Delivery Rules

- Every feature starts from a behavior contract (`Given/When/Then`) before implementation.
- Every non-trivial change ships with a failing test first, then minimal implementation.
- API contracts are versioned and typed before parallel implementation starts.
- Done means tested behavior, not just merged code.
- Execution mode is local-first: parallel Codex/Claude sessions with git worktrees.

UI implementation reference: `FRONTEND_UI_DIRECTION.md`.
Local execution reference: `LOCAL_PARALLEL_WORKFLOW.md`.
Security baseline reference: `SECURITY_BASELINE.md`.

## Cross-Phase Security Track

Outcome: Security controls are designed and shipped continuously across all phases, not deferred to launch week.

Checklist:

- [ ] Enforce strict prompt boundaries and output validation for prompt-improvement flows.
- [ ] Keep provider and infrastructure secrets server-side only; rotate on schedule.
- [ ] Enforce schema validation, request limits, and authorization on all public endpoints.
- [ ] Apply abuse controls (rate limits, idempotency keys, queue limits) for expensive jobs.
- [ ] Harden file upload and geometry processing paths (size/type/time/resource constraints).
- [ ] Ship VPS hardening baseline (firewall, SSH policy, non-root runtime, patch cadence).
- [ ] Add security observability and incident runbooks (key rotation, emergency disable, restore drills).
- [ ] Add security tests for auth failure paths, prompt-injection attempts, and malformed uploads.

## Phase Roadmap

### Phase 0 - Foundations and Contracts

Outcome: Monorepo and service skeletons are running locally with shared contracts, CI, and observability baseline.

Checklist:

- [ ] Create workspace layout for `apps/web`, `apps/api`, `services/geometry`, `packages/contracts`, `packages/ui`.
- [ ] Add local stack via Docker Compose (`postgres`, `redis`, `minio` or S3-compatible alternative).
- [ ] Scaffold Hono API with health, auth stub, and typed OpenAPI output.
- [ ] Scaffold FastAPI geometry service with health endpoint and request/response schemas.
- [ ] Define initial domain model in Drizzle (`users`, `prompts`, `generations`, `models`, `assets`, `jobs`).
- [ ] Set up CI for lint, typecheck, unit tests, and contract checks.
- [ ] Add baseline telemetry (request IDs, structured logs, error capture).

Parallel slices:

- Agent A: Frontend shell + design tokens + routing skeleton.
- Agent B: Hono API skeleton + OpenAPI generation.
- Agent C: FastAPI skeleton + geometry contract stubs.
- Agent D: Infra baseline (`docker-compose`, CI, local dev scripts).

### Phase 1 - End-to-End MVP (Image to Printable STL)

Outcome: User can upload an image, generate a model via Hunyuan, run basic cleanup, preview it in web UI, and download STL.

Checklist:

- [ ] Implement upload flow (presigned URL + metadata record).
- [ ] Implement generation job flow in API (`queued -> processing -> succeeded|failed`).
- [ ] Integrate fal.ai Hunyuan endpoint and persist raw results.
- [ ] Implement cleanup step: normals fix.
- [ ] Implement cleanup step: manifold repair.
- [ ] Implement cleanup step: merge vertices.
- [ ] Implement cleanup step: scale transform.
- [ ] Implement cleanup step: STL export via `trimesh.export()`.
- [ ] Implement optional base creation in geometry service.
- [ ] Render generated GLB/STL in R3F viewer with loading/error states.
- [ ] Add downloadable artifacts (source image, GLB, STL).
- [ ] Add retry and failure diagnostics for failed jobs.

Parallel slices:

- Agent A: Upload + generation UI + job polling UX.
- Agent B: Job orchestration, fal.ai adapter, persistence.
- Agent C: Geometry cleanup API + artifact outputs.
- Agent D: Viewer integration and model asset delivery.

### Phase 2 - Prompt Studio and Nano Banana History

Outcome: User can generate source images with Nano Banana, write raw prompts, improve prompts via OpenRouter free models, and reuse prompt history.

Checklist:

- [ ] Build prompt composer mode: guided mode with system prompt templates.
- [ ] Build prompt composer mode: raw prompt mode.
- [ ] Implement "Improve my prompt" endpoint backed by OpenRouter free model(s).
- [ ] Persist original prompt, improved prompt, model used, and timestamps.
- [ ] Integrate Nano Banana generation pipeline and store generated image artifacts.
- [ ] Add generation history timeline (filters by date, model, status).
- [ ] Allow "re-run from history" for fast iteration.
- [ ] Add token/cost usage tracking per generation provider.
- [ ] Add prompt-injection safeguards for prompt improvement and generation handoffs.

Parallel slices:

- Agent A: Prompt Studio UX + history screens.
- Agent B: OpenRouter adapter + prompt improvement service.
- Agent C: Nano Banana provider + storage + metadata.
- Agent D: Cost telemetry and provider abstraction layer.

### Phase 3 - Model Library and Gallery

Outcome: Users have a first-class gallery and project library for generated assets, with search/filter and consistent 3D previews.

Checklist:

- [ ] Create model gallery pages (private-by-default MVP).
- [ ] Add model metadata editing (name, tags, print notes, source prompt link).
- [ ] Add filtering (printer type, scale, has base, hollowed, date).
- [ ] Add version chain for regenerated/cleaned variants.
- [ ] Add lightweight share links (optional, feature flag).
- [ ] Improve viewer controls (lighting presets, wireframe, dimension overlay).
- [ ] Implement lifecycle states (`draft`, `ready-to-print`, `archived`).

Parallel slices:

- Agent A: Gallery and card/grid/list UI.
- Agent B: Metadata and search endpoints.
- Agent C: Viewer feature upgrades.
- Agent D: Sharing/access control hooks.

### Phase 4 - Print Prep Advanced Features

Outcome: Mesh tooling supports production-oriented controls beyond basic cleanup.

Checklist:

- [ ] Add hollowing options via `pymeshlab` solidify pipeline.
- [ ] Add wall-thickness presets by printer type (FDM/Resin/SLS defaults).
- [ ] Add base style options and parameterized dimensions.
- [ ] Add scale presets (target mm, longest-side strategy, uniform scale lock).
- [ ] Add geometry validation report (non-manifold edges, inverted normals, watertight status).
- [ ] Add pre-export confidence score with actionable warnings.
- [ ] Add regression corpus of representative models for geometry pipeline tests.

Parallel slices:

- Agent A: Print prep UI + presets.
- Agent B: Geometry processing implementations.
- Agent C: Validation and scoring logic.
- Agent D: Regression dataset and automated verification harness.

### Phase 5 - Production Hardening on Cheap VPS

Outcome: System runs reliably on low-cost infrastructure with backup, monitoring, and basic security controls.

Checklist:

- [ ] Finalize auth strategy (API keys first, JWT account mode behind flag if needed).
- [ ] Add rate limiting and abuse controls around generation endpoints.
- [ ] Add idempotency keys for generation and cleanup jobs.
- [ ] Add BullMQ retry policies and dead-letter handling.
- [ ] Add backups for PostgreSQL and object storage metadata.
- [ ] Add dashboards for queue depth, failure rate, processing duration, and storage growth.
- [ ] Implement security baseline controls from `SECURITY_BASELINE.md`.
- [ ] Add deployment recipe for single VPS (`api`, `web`, `geometry`, `redis`, `postgres`, `reverse-proxy`).
- [ ] Add runbooks for common incidents.

Parallel slices:

- Agent A: Auth/rate-limit/security middleware.
- Agent B: Queue resilience and failure recovery.
- Agent C: VPS deployment IaC and observability.
- Agent D: Backup/restore scripts and drills.

### Phase 6 - Ecosystem Expansion (Poly Haven + Sketchfab + Mixamo R&D)

Outcome: Platform evolves beyond first-party generation into a broader model ecosystem.

Checklist:

- [ ] Add Poly Haven integration for reference assets and environment resources.
- [ ] Add Sketchfab import for user-selected models (license-aware metadata preserved).
- [ ] Normalize external model metadata into internal model schema.
- [ ] Add provenance tracking (source provider, author, license, attribution).
- [ ] Add ingestion cleanup pipeline for externally sourced meshes.
- [ ] Add "remix workflow" to combine external assets with generated assets.
- [ ] Run Mixamo rigging feasibility spike for character-class models.
- [ ] Mixamo spike output: detect humanoid eligibility.
- [ ] Mixamo spike output: export rig-ready formats.
- [ ] Mixamo spike output: evaluate auto-rig success rate and failure causes.
- [ ] Publish product decision: keep as beta module or leave as expert feature.

Parallel slices:

- Agent A: External source UI and import UX.
- Agent B: Provider connectors and metadata ingestion.
- Agent C: License/provenance policy enforcement.
- Agent D: Mixamo R&D branch and technical report.

## Suggested Milestone Sequence

1. Milestone A: Phase 0 complete.
2. Milestone B: Phase 1 complete (first investor demo).
3. Milestone C: Phases 2-3 complete (product differentiation).
4. Milestone D: Phases 4-5 complete (paid pilot readiness).
5. Milestone E: Phase 6 complete (ecosystem moat strategy).

## Acceptance Gates Per Phase

Each phase is complete only when all are true:

- Checklist items are done.
- Behavior contracts are mapped to passing tests.
- Critical regression tests are in CI.
- API contracts and docs are updated.
- Demo path can be executed without manual patching.
