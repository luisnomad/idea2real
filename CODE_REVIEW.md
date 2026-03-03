# Code Review (excluding `vendor/`)

Date: 2026-03-03
Scope: `nb3dp_addon.py`, `scripts/*.py`, `poc/bttf-fdm/blender*.py`, project docs for context (`CLAUDE.md`, `docs/ARCHITECTURE.md`).

## Findings

### P1 — Polling swallows real API failures and reports misleading timeouts
- Location: `nb3dp_addon.py:184-187`
- `FalClient.poll()` catches all exceptions and returns `None`, which is interpreted as “still processing”.
- Impact: auth errors, request errors, or network failures can appear as long-running jobs and end in timeout/resume loops instead of surfacing the real failure.
- Recommendation: only treat explicit “in progress” responses as pending; propagate `HTTPError`/`URLError` (or map them to user-visible errors).

### P1 — Provider comparison can mark failed downloads as successful
- Location: `scripts/compare-providers.py:149-152`, `scripts/compare-providers.py:167`
- Mesh download uses `requests.get(mesh_url)` without `raise_for_status()`. Any non-2xx response body is still written to disk, and `success` is set from `mesh_path is not None`.
- Impact: the benchmark report can contain false positives (HTML/JSON error payloads saved as `.glb/.obj/.fbx`) and invalid size metrics.
- Recommendation: set a timeout, call `raise_for_status()`, and validate content-type or file signature before marking success.

### P2 — Reference-image generator has unbounded network calls
- Location: `scripts/generate-hc-references.py:62`, `scripts/generate-hc-references.py:94`
- Image downloads omit timeout and status checks.
- Impact: script can hang indefinitely on network stalls and silently save error payloads as images.
- Recommendation: use `requests.get(..., timeout=...)` + `raise_for_status()`.

### P2 — MCP helper treats empty successful result as failure
- Location: `poc/bttf-fdm/blender-mcp-call.py:79-83`
- CLI exit path checks `if result:`; valid empty results (e.g., `{}`) are falsy and trigger exit code 1.
- Impact: false-negative failures in automation/scripts calling this helper.
- Recommendation: check `if result is not None` instead of truthiness.

### P3 — Modifier application loop mutates collection while iterating
- Location: `nb3dp_addon.py:1017-1021`, `nb3dp_addon.py:1060-1064`
- Applying a modifier removes it from `obj.modifiers` during iteration.
- Impact: depending on iterator behavior, some modifiers can be skipped; behavior is fragile and hard to reason about.
- Recommendation: iterate over `list(obj.modifiers)`.

## Notes
- No code changes were made besides creating this review file.
- I did not execute Blender runtime tests in this environment, so findings are from static analysis.
