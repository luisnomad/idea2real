import test from "node:test";
import assert from "node:assert/strict";
import { normalizeError } from "../src/utils/output.js";

test("normalizeError handles Error instances", () => {
  const normalized = normalizeError(new Error("boom"));
  assert.equal(normalized.code, "UNEXPECTED_ERROR");
  assert.equal(normalized.message, "boom");
});

test("normalizeError handles string payloads", () => {
  const normalized = normalizeError("simple failure");
  assert.equal(normalized.code, "UNEXPECTED_ERROR");
  assert.equal(normalized.message, "simple failure");
});
