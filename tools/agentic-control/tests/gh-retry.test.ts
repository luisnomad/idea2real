import test from "node:test";
import assert from "node:assert/strict";
import { isTransientGhError, runGhWithRunner } from "../src/adapters/gh.js";

test("isTransientGhError detects GitHub transient failures", () => {
  assert.equal(isTransientGhError("HTTP 502: Bad Gateway"), true);
  assert.equal(isTransientGhError("timed out while connecting"), true);
  assert.equal(isTransientGhError("permission denied"), false);
});

test("runGhWithRunner retries transient failures and succeeds", async () => {
  let calls = 0;

  const result = await runGhWithRunner(
    ["repo", "view", "x/y"],
    { retries: 3, retrySleepMs: 1 },
    async () => {
      calls += 1;
      if (calls < 3) {
        return { stdout: "", stderr: "HTTP 502: Bad Gateway", exitCode: 1 };
      }
      return { stdout: "ok", stderr: "", exitCode: 0 };
    },
  );

  assert.equal(calls, 3);
  assert.equal(result.stdout, "ok");
});
