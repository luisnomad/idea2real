import test from "node:test";
import assert from "node:assert/strict";
import { optionIdForStatus, type ProjectStatusContext } from "../src/core/status-moves.js";

test("optionIdForStatus returns mapped option id", () => {
  const context: ProjectStatusContext = {
    projectId: "proj_1",
    statusFieldId: "field_1",
    optionByName: new Map([
      ["In Progress", "opt_1"],
      ["Review", "opt_2"],
    ]),
  };

  assert.equal(optionIdForStatus(context, "Review"), "opt_2");
  assert.equal(optionIdForStatus(context, "Done"), "");
});
