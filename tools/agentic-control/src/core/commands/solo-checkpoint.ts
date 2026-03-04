import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AppConfig, CommandResult } from "../../types/contracts.js";
import { ok } from "../command-utils.js";
import { askText } from "../../ui/clack/prompts.js";
import { nowIso, readSoloState, soloCheckpointDir, writeSoloState } from "../solo.js";
import { commentIssues, resolveIssuesByNumber } from "./solo-common.js";

export interface SoloCheckpointOptions {
  summary?: string;
  next?: string;
  blockers?: string;
  noIssueComment?: boolean;
}

export async function runSoloCheckpoint(config: AppConfig, options: SoloCheckpointOptions): Promise<CommandResult> {
  const result = ok("agentic solo checkpoint", "Write sprint checkpoint and optionally comment linked issues");
  const state = await readSoloState(config.repoRoot);
  if (!state) {
    throw new Error("No active solo state found. Start with `agentic solo start`.");
  }

  const summary =
    options.summary ??
    (!config.nonInteractive
      ? await askText({ message: "Checkpoint summary", validate: (value) => (value.trim() ? undefined : "Required") })
      : "Progress checkpoint recorded.");
  const next = options.next ?? (!config.nonInteractive ? await askText({ message: "Next action", defaultValue: "Continue sprint implementation." }) : "Continue sprint implementation.");
  const blockers = options.blockers ?? (!config.nonInteractive ? await askText({ message: "Blockers", defaultValue: "None" }) : "None");

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = soloCheckpointDir(config.repoRoot);
  await mkdir(dir, { recursive: true });
  const checkpointFile = join(dir, `checkpoint-${timestamp}.md`);

  const body = [
    `# Solo Sprint Checkpoint`,
    "",
    `- Phase: ${state.phase}`,
    `- Delivery mode: ${state.deliveryMode === "single-issue" ? "single-issue" : "phase-pr"}`,
    `- Branch: ${state.branch}`,
    `- Time: ${nowIso()}`,
    "",
    `## Summary`,
    summary,
    "",
    `## Next`,
    next,
    "",
    `## Blockers`,
    blockers,
    "",
  ].join("\n");

  await writeFile(checkpointFile, body, "utf8");

  const issues = await resolveIssuesByNumber(config.repo, state.issueNumbers);
  if (!options.noIssueComment && issues.length > 0) {
    const issueBody = [
      "### Solo Sprint Checkpoint",
      `Delivery mode: ${state.deliveryMode === "single-issue" ? "single-issue" : "phase-pr"}`,
      `Phase: ${state.phase}`,
      `Branch: ${state.branch}`,
      `Summary: ${summary}`,
      `Next: ${next}`,
      `Blockers: ${blockers}`,
    ].join("\n");
    await commentIssues(config, issues, issueBody);
    result.artifacts.issue = issues[0]?.number;
  }

  await writeSoloState(config.repoRoot, {
    ...state,
    updatedAt: nowIso(),
  });

  result.artifacts.branch = state.branch;
  result.artifacts.handoffFile = checkpointFile;
  result.nextSteps.push("Continue coding on the solo branch.");
  result.nextSteps.push("Run `agentic solo finalize` when sprint PR is ready.");
  return result;
}
