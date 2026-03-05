# Security Baseline (VPS Production)

## Purpose

Define secure-by-default controls for the idea2real web app when deployed to a VPS.

Goal:

- Reduce exploitability and blast radius.
- Protect secrets and user data.
- Make security measurable with explicit gates.

This baseline is designed for the current stack:

- Frontend: React + TypeScript.
- Core API: Hono (Node/Bun).
- Geometry API: FastAPI.
- Data/services: PostgreSQL, Redis, S3-compatible storage.
- AI providers: fal.ai, OpenRouter.

Implementation reference:

- `docs/project/SECURITY_CONTINUATION_GUIDE.md` (enforced controls and secure-change rules)

## Threat Model (High-Level)

Primary attack surfaces:

- Public HTTP APIs (Hono/FastAPI).
- File upload and model processing pipeline.
- Prompt input and provider output chain.
- Secrets in runtime/config/deploy.
- VPS host and container runtime.

Primary attacker goals:

- Steal API keys or user data.
- Abuse generation endpoints for cost/resource drain.
- Trigger remote code execution via unsafe inputs.
- Inject malicious prompts or outputs into downstream steps.
- Lateral movement from one compromised service.

## Secure-by-Default Requirements

## 1) Prompt Injection and LLM Safety

- Treat all user prompts, uploaded text metadata, and model outputs as untrusted input.
- Enforce strict prompt boundary format:
  - `system` instructions isolated and immutable server-side.
  - user content passed as data, not concatenated privileged instructions.
- Add output validation for "Improve my prompt":
  - schema validation on JSON response shape.
  - reject content that asks for secrets, policy bypass, or hidden instructions.
- Never allow provider output to directly execute commands, SQL, or shell operations.
- Add provider guardrails:
  - max tokens, timeout, and retry limits.
  - explicit model allowlist.
- Log prompt safety decisions (accept/reject reasons) without storing sensitive raw secrets.

## 2) Secrets and API Key Management

- No secrets in frontend bundle (`VITE_*` values are public by definition).
- Store provider keys only in server env/secret manager.
- Encrypt at rest where supported and redact in logs.
- Use per-service, least-privilege keys:
  - separate keys for `api`, `geometry`, and background jobs.
- Rotate keys on schedule and after incidents.
- Disable long-lived root credentials for object storage/database.

## 3) AuthN/AuthZ and Session Controls

- Start with API keys or JWT, but enforce least privilege and expiry.
- For JWT mode:
  - short access token TTL.
  - refresh token rotation and revocation list.
- For API key mode:
  - hashed keys in DB, never plaintext.
  - scoped permissions and per-key rate limits.
- Enforce authorization at route boundary, not ad-hoc inside handlers.

## 4) API and App Hardening

- Strict request validation on all external inputs (Zod/Pydantic schemas).
- Limit request body size and upload size per route.
- Add global rate limiting and abuse throttling for expensive endpoints.
- Add idempotency keys for generation/cleanup operations.
- Enforce CORS allowlist (no permissive wildcard with credentials).
- Set security headers (via reverse proxy/app middleware):
  - `Content-Security-Policy`.
  - `X-Content-Type-Options`.
  - `X-Frame-Options` or `frame-ancestors`.
  - `Referrer-Policy`.
- Prevent SSRF:
  - restrict outbound hosts for provider callbacks/downloads.
  - block private/internal IP ranges in fetchers.

## 5) File and Geometry Pipeline Safety

- Validate MIME type and extension on upload.
- Scan file metadata and reject malformed/oversized payloads early.
- Use isolated working directories for file processing.
- Run geometry processing with constrained resources:
  - CPU/memory limits.
  - execution timeout.
  - no shell invocation with untrusted filenames.
- Do not return raw internal errors to clients.

## 6) Data Layer and Storage Controls

- PostgreSQL:
  - private network binding only.
  - strong auth and least-privilege app role.
  - automated backups + tested restore.
- Redis:
  - no public exposure.
  - auth enabled.
- S3-compatible storage:
  - private buckets by default.
  - presigned URL TTL kept short.
  - content-type and max-size constraints in upload policies.

## 7) VPS and Runtime Hardening

- Keep OS and container runtime patched.
- SSH hardening:
  - keys only, no password auth.
  - disable root login.
- Firewall:
  - expose only `80/443` publicly.
  - internal ports restricted.
- Run services as non-root users.
- Separate reverse proxy from app containers.
- Add fail2ban or equivalent brute-force defense for SSH.

## 8) Observability and Incident Readiness

- Centralized structured logs with request IDs.
- Security-relevant events logged:
  - auth failures.
  - rate-limit hits.
  - prompt-safety rejections.
  - suspicious upload rejects.
- Alerts on:
  - error spikes.
  - unusual generation volume.
  - repeated failed auth by source.
- Incident runbook:
  - key rotation procedure.
  - emergency endpoint disable.
  - backup restore validation.

## Security Gates (Definition of Done)

A production release is blocked unless:

- [ ] Secrets are server-side only and key rotation documented.
- [ ] API schemas and input limits enforced on all public endpoints.
- [ ] Rate limiting + abuse controls enabled.
- [ ] Prompt safety boundaries and output validation enabled.
- [ ] CORS and security headers configured.
- [ ] VPS hardening checklist complete.
- [ ] Backup/restore and incident runbook tested.

## Security Test Plan

- Unit tests:
  - input validation rejects malformed payloads.
  - auth middleware denies missing/invalid scopes.
  - prompt safety validator catches policy-bypass attempts.
- Integration tests:
  - rate-limit behavior under burst load.
  - presigned URL constraints and expiry.
  - rejected SSRF target handling.
- E2E tests:
  - unauthorized flows fail predictably.
  - upload and generation fail safely for invalid inputs.

## Ownership Model

- Security owner (human): approves policy and production exceptions.
- Domain owners: implement controls in their service domains.
- PM/ops pass: weekly security status review in GitHub Project.

## Known Principle

"Not easily hackable" is a moving target.
The practical target is continuous risk reduction with explicit controls, tests, and operational response.
