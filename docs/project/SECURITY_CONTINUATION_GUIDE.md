# Security Continuation Guide

This guide documents security controls already implemented in code and the rules to follow for all future changes.

Use this together with `SECURITY_BASELINE.md`.

## Current Enforced Controls

As of March 5, 2026, the following controls are implemented.

### Core API (`apps/api`)

- Authentication:
  - Fail-closed behavior outside `development`/`test` when API keys are not configured.
  - Per-request `userId` derived from API key and enforced on generation/job/asset routes.
- API docs exposure:
  - `/docs` and `/ui` are hidden by default in production.
  - Can be re-enabled with `EXPOSE_API_DOCS=true`.
- Request protection:
  - Rate limit middleware, body-size guard, JSON-only guard.
- HTTP response hardening:
  - CORS allowlist enforcement (disallowed origins return `403`).
  - Security headers:
    - `Content-Security-Policy`
    - `X-Content-Type-Options`
    - `X-Frame-Options`
    - `Referrer-Policy`

Reference files:

- `apps/api/src/app.ts`
- `apps/api/src/middleware/auth.ts`
- `apps/api/src/modules/generation/routes.ts`
- `apps/api/src/security/http-security.ts`

### Geometry Service (`services/geometry`)

- Upload hardening:
  - File extension allowlist (`glb`, `gltf`, `stl`, `obj`, `ply`).
  - Bounded upload reads with `GEOMETRY_MAX_UPLOAD_BYTES`.
  - Malformed mesh parsing returns safe `4xx` error envelopes.
- Error handling:
  - Controlled error envelope with `requestId`.
  - Unhandled exceptions mapped to generic `500 INTERNAL_ERROR` without stack traces.
- HTTP response hardening:
  - CORS allowlist enforcement with FastAPI CORS middleware.
  - Security headers:
    - `Content-Security-Policy`
    - `X-Content-Type-Options`
    - `X-Frame-Options`
    - `Referrer-Policy`

Reference files:

- `services/geometry/app/main.py`

## Security Environment Variables

### API

- `API_KEYS`
  - Format: `key1:user-uuid,key2:user-uuid`
- `API_KEY`
  - Optional legacy single-key fallback.
- `API_KEY_USER_ID`
  - User ID for `API_KEY` when using single-key fallback.
- `EXPOSE_API_DOCS`
  - `true` to expose `/docs` and `/ui` in production.
- `API_CORS_ALLOWLIST`
  - CSV origin list. Default:
    - `http://localhost:5173`
    - `http://127.0.0.1:5173`
- `API_CORS_ALLOWED_METHODS`
  - CSV methods list.
- `API_CORS_ALLOWED_HEADERS`
  - CSV headers list.
- `API_CORS_ALLOW_CREDENTIALS`
  - `true`/`false`.
- `API_CORS_MAX_AGE_SECONDS`
  - Positive integer.
- `API_CONTENT_SECURITY_POLICY`
  - Override default CSP.

### Geometry

- `GEOMETRY_MAX_UPLOAD_BYTES`
  - Max uploaded mesh size in bytes (default `10485760`).
- `GEOMETRY_CORS_ALLOWLIST`
  - CSV origin list. Default:
    - `http://localhost:5173`
    - `http://127.0.0.1:5173`
- `GEOMETRY_CONTENT_SECURITY_POLICY`
  - Override default CSP.

## Required Rules for Future Changes

- Do not add new external endpoints without:
  - schema validation
  - ownership/auth checks
  - CORS behavior review
  - security header coverage
  - behavior tests for failure paths
- Do not weaken fail-closed auth in non-dev environments.
- Do not use wildcard CORS (`*`) for production-facing services.
- Do not return raw parser/stack errors to clients.
- Keep expensive endpoints protected by rate limits and bounded input size.

## Required Tests Before Merge

- API:
  - `pnpm --filter @idea2real/api test`
  - `pnpm --filter @idea2real/api typecheck`
- Geometry:
  - `cd services/geometry && uv run pytest -q`
  - `cd services/geometry && uv run ruff check app tests`

## Next Security Backlog (Recommended)

- Add trusted-proxy aware client-IP extraction and Redis-backed rate limiting.
- Add CORS/security headers to reverse-proxy layer as defense-in-depth.
- Add auth/rate-limiting on geometry service endpoints.
- Add idempotency keys for generation and cleanup paths.
- Add SSRF protections around provider/download URL fetching.
