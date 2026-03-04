import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalizePhase, phaseToLabel, sprintBranchName } from "../src/core/solo.js";
import { readSoloState } from "../src/core/solo.js";
import { parseIssueNumbers } from "../src/core/commands/solo-common.js";

test("normalizePhase supports Pn and numeric input", () => {
  assert.equal(normalizePhase("p2"), "P2");
  assert.equal(normalizePhase("3"), "P3");
  assert.equal(normalizePhase("P10"), "P10");
});

test("phaseToLabel maps phase to GitHub label", () => {
  assert.equal(phaseToLabel("P0"), "phase-0");
  assert.equal(phaseToLabel("2"), "phase-2");
});

test("sprintBranchName generates solo branch naming", () => {
  assert.equal(sprintBranchName("P1", "API Core"), "codex/solo-p1-api-core");
});

test("parseIssueNumbers parses and deduplicates values", () => {
  assert.deepEqual(parseIssueNumbers("1,2 2, 3"), [1, 2, 3]);
  assert.deepEqual(parseIssueNumbers(""), []);
});

test("readSoloState defaults deliveryMode to phase-pr for legacy state files", async () => {
  const root = await mkdtemp(join(tmpdir(), "agentic-solo-"));
  const statePath = join(root, ".sessions", "solo", "state.json");
  await mkdir(join(root, ".sessions", "solo"), { recursive: true });
  await writeFile(
    statePath,
    JSON.stringify({
      mode: "solo",
      phase: "P1",
      slug: "legacy",
      branch: "codex/solo-p1-legacy",
      issueNumbers: [1, 2],
      kickoffFile: "/tmp/kickoff.md",
      startedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      status: "active",
    }),
    "utf8",
  );

  const state = await readSoloState(root);
  assert.ok(state);
  assert.equal(state.deliveryMode, "phase-pr");
});
