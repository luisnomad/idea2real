import { access } from "node:fs/promises";
import { constants } from "node:fs";
import type { AppConfig, CommandResult } from "../../types/contracts.js";
import { ok } from "../command-utils.js";
import { checkoutBranch, currentBranch } from "../git.js";
import { normalizePhase, nowIso, readSoloState, sprintBranchName, writeSoloState, type SoloState } from "../solo.js";
import { moveIssuesToStatus, resolveIssuesByNumber, writeSoloKickoffPrompt } from "./solo-common.js";

export interface SoloResumeOptions {
  branch?: string;
}

export async function runSoloResume(config: AppConfig, options: SoloResumeOptions): Promise<CommandResult> {
  const result = ok("agentic solo resume", "Resume active solo sprint context");
  const existingState = await readSoloState(config.repoRoot);

  const activeBranch = options.branch ?? existingState?.branch ?? (await currentBranch(config.repoRoot));
  if (!activeBranch.startsWith("codex/solo-")) {
    throw new Error("No active solo state found and current branch is not a solo branch. Use `agentic solo start`.");
  }

  await checkoutBranch(config.repoRoot, activeBranch);

  const state = existingState ?? inferStateFromBranch(config.repoRoot, activeBranch);
  const issues = await resolveIssuesByNumber(config.repo, state.issueNumbers);
  if (issues.length > 0) {
    await moveIssuesToStatus(config, issues, "In Progress");
    result.artifacts.issue = issues[0]?.number;
  }

  let kickoffFile = state.kickoffFile;
  if (!(await fileExists(kickoffFile))) {
    kickoffFile = await writeSoloKickoffPrompt({
      repoRoot: config.repoRoot,
      phase: state.phase,
      slug: state.slug,
      branch: state.branch,
      deliveryMode: state.deliveryMode,
      issues,
    });
  }

  const updatedState: SoloState = {
    ...state,
    kickoffFile,
    updatedAt: nowIso(),
    status: "active",
  };
  await writeSoloState(config.repoRoot, updatedState);

  result.artifacts.branch = activeBranch;
  result.artifacts.handoffFile = kickoffFile;
  result.nextSteps.push(`Continue solo sprint on ${activeBranch}`);
  result.nextSteps.push(`Kickoff prompt: ${kickoffFile}`);
  result.nextSteps.push("Use `agentic solo checkpoint` after meaningful progress.");

  return result;
}

function inferStateFromBranch(repoRoot: string, branch: string): SoloState {
  const rest = branch.replace(/^codex\/solo-/, "");
  const parts = rest.split("-");
  const phaseRaw = parts.shift() ?? "p1";
  const slug = parts.join("-") || "solo-sprint";
  const phase = normalizePhase(phaseRaw);

  return {
    mode: "solo",
    deliveryMode: "phase-pr",
    phase,
    slug,
    branch: sprintBranchName(phase, slug),
    issueNumbers: [],
    kickoffFile: `${repoRoot}/.sessions/solo/kickoff-${phase}-${slug}.md`,
    startedAt: nowIso(),
    updatedAt: nowIso(),
    status: "active",
  };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
