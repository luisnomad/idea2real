import test from "node:test";
import assert from "node:assert/strict";
import { dedupeSliceCatalog } from "../src/core/discovery/slices.js";

test("dedupeSliceCatalog merges local + issue records by slice ID", () => {
  const catalog = dedupeSliceCatalog(
    [
      {
        branch: "codex/p0-web-1-app-shell",
        path: "/tmp/w1",
        sliceId: "P0-WEB-1",
      },
    ],
    [
      {
        number: 7,
        title: "P0-WEB-1: App shell",
        url: "https://example.com/issues/7",
        sliceId: "P0-WEB-1",
        domain: "web",
      },
      {
        number: 8,
        title: "P0-API-1: API skeleton",
        url: "https://example.com/issues/8",
        sliceId: "P0-API-1",
        domain: "api",
      },
    ],
    [
      {
        number: 12,
        title: "P0-WEB-1 PR",
        url: "https://example.com/pr/12",
        headRefName: "codex/p0-web-1-app-shell",
        state: "OPEN",
      },
    ],
  );

  assert.equal(catalog.length, 2);

  const web = catalog.find((item) => item.sliceId === "P0-WEB-1");
  assert.ok(web);
  assert.equal(web?.issue?.number, 7);
  assert.equal(web?.localWorktree?.path, "/tmp/w1");
  assert.equal(web?.pr?.number, 12);

  const api = catalog.find((item) => item.sliceId === "P0-API-1");
  assert.ok(api);
  assert.equal(api?.issue?.number, 8);
  assert.equal(api?.localWorktree, undefined);
});
