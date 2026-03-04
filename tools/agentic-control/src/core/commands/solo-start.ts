import type { AppConfig, CommandResult } from "../../types/contracts.js";
import { ok } from "../command-utils.js";
import { askSelect, askText, info, note } from "../../ui/clack/prompts.js";
import { toSlug } from "../../utils/text.js";
import { runCommand } from "../../adapters/exec.js";
import { branchExists, checkoutBranch, createBranchFromBase, currentBranch, fetchRef, hasDirtyWorktree } from "../git.js";
import { normalizePhase, nowIso, sprintBranchName, writeSoloState, type SoloState } from "../solo.js";
import { moveIssuesToStatus, parseIssueNumbers, resolveIssuesByNumber, writeSoloKickoffPrompt } from "./solo-common.js";

export interface SoloStartOptions {
  phase?: string;
  slug?: string;
  issues?: string;
  branch?: string;
  deliveryMode?: "phase-pr" | "single-issue";
  reviewMode?: "github-pr" | "local-agent";
}

export async function runSoloStart(config: AppConfig, options: SoloStartOptions): Promise<CommandResult> {
  const result = ok("agentic solo start", "Start or initialize a solo sprint branch");

  const dirty = await hasDirtyWorktree(config.repoRoot);
  if (dirty) {
    throw new Error("Working tree is dirty. Commit/stash changes before starting a solo sprint.");
  }

  const phaseInput = options.phase ?? (!config.nonInteractive ? await askText({ message: "Sprint phase (e.g. P1)", defaultValue: "P1" }) : "");
  const phase = normalizePhase(phaseInput);
  if (!phase) {
    throw new Error("--phase is required in non-interactive mode");
  }

  const slugInput = options.slug ?? (!config.nonInteractive ? await askText({ message: "Sprint slug", defaultValue: "solo-sprint" }) : "solo-sprint");
  const slug = toSlug(slugInput);
  if (!slug) {
    throw new Error("Sprint slug is required");
  }

  const branch = options.branch ?? sprintBranchName(phase, slug);
  const deliveryMode = options.deliveryMode === "single-issue" ? "single-issue" : "phase-pr";
  const reviewMode: "github-pr" | "local-agent" =
    options.reviewMode ??
    (!config.nonInteractive
      ? await askSelect<"github-pr" | "local-agent">({
          message: "Review mode for this sprint",
          options: [
            {
              value: "github-pr",
              label: "GitHub PR review (commit/push/PR during finalize)",
            },
            {
              value: "local-agent",
              label: "Local agent review first (no commit/push/PR until publish)",
            },
          ],
          initialValue: "github-pr",
        })
      : "github-pr");

  const issueRaw =
    options.issues ??
    (!config.nonInteractive
      ? await askText({
          message: "Linked issue numbers (comma-separated, optional)",
          defaultValue: "",
        })
      : "");

  const issueNumbers = parseIssueNumbers(issueRaw);
  const issues = await resolveIssuesByNumber(config.repo, issueNumbers);

  await fetchRef(config.repoRoot, "origin", "main");

  if (await branchExists(config.repoRoot, branch)) {
    await checkoutBranch(config.repoRoot, branch);
    info(`Checked out existing solo branch: ${branch}`);
  } else {
    const hasOriginMain = await refExists(config.repoRoot, "refs/remotes/origin/main");
    const baseRef = hasOriginMain ? "origin/main" : "main";
    await createBranchFromBase(config.repoRoot, branch, baseRef);
    info(`Created branch ${branch} from ${baseRef}`);
  }

  if (issues.length > 0) {
    await moveIssuesToStatus(config, issues, "In Progress");
    result.artifacts.issue = issues[0]?.number;
  }

  const kickoffFile = await writeSoloKickoffPrompt({
    repoRoot: config.repoRoot,
    phase,
    slug,
    branch,
    deliveryMode,
    reviewMode,
    issues,
  });

  const state: SoloState = {
    mode: "solo",
    deliveryMode,
    reviewMode,
    phase,
    slug,
    branch,
    issueNumbers: issues.map((issue) => issue.number),
    kickoffFile,
    startedAt: nowIso(),
    updatedAt: nowIso(),
    status: "active",
  };

  await writeSoloState(config.repoRoot, state);

  result.artifacts.branch = branch;
  result.artifacts.handoffFile = kickoffFile;
  result.nextSteps.push(`Work on branch: ${branch}`);
  result.nextSteps.push(`Kickoff prompt: ${kickoffFile}`);
  result.nextSteps.push("Use `agentic solo checkpoint` as you progress.");
  result.nextSteps.push("Use `agentic solo finalize` when PR is ready.");

  note(`Current branch: ${await currentBranch(config.repoRoot)}`);
  return result;
}

async function refExists(repoRoot: string, ref: string): Promise<boolean> {
  const result = await runCommand("git", ["-C", repoRoot, "show-ref", "--verify", "--quiet", ref], { reject: false });
  return result.exitCode === 0;
}
