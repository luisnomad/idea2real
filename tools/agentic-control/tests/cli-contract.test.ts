import test from "node:test";
import assert from "node:assert/strict";
import { buildProgram } from "../src/cli.js";

test("CLI exposes required top-level command families", () => {
  const program = buildProgram();
  const names = program.commands.map((command) => command.name());

  assert.ok(names.includes("session"));
  assert.ok(names.includes("continue"));
  assert.ok(names.includes("solo"));
  assert.ok(names.includes("slice"));
  assert.ok(names.includes("pr"));
  assert.ok(names.includes("cleanup"));
  assert.ok(names.includes("pm"));
  assert.ok(names.includes("doctor"));
});

test("PR loop command defaults --pr to auto", () => {
  const program = buildProgram();
  const pr = program.commands.find((command) => command.name() === "pr");
  assert.ok(pr);

  const loop = pr?.commands.find((command) => command.name() === "loop");
  assert.ok(loop);

  const prOption = loop?.options.find((option) => option.long === "--pr");
  assert.equal(prOption?.defaultValue, "auto");
});

test("PM command includes next-phase", () => {
  const program = buildProgram();
  const pm = program.commands.find((command) => command.name() === "pm");
  assert.ok(pm);

  const names = pm?.commands.map((command) => command.name()) ?? [];
  assert.ok(names.includes("seed-issues"));
  assert.ok(names.includes("next-phase"));
});

test("Solo command includes add-issues", () => {
  const program = buildProgram();
  const solo = program.commands.find((command) => command.name() === "solo");
  assert.ok(solo);

  const names = solo?.commands.map((command) => command.name()) ?? [];
  assert.ok(names.includes("add-issues"));
});
