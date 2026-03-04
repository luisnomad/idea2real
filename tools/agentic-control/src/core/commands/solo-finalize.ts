import type { AppConfig, CommandResult } from "../../types/contracts.js";
import { ok } from "../command-utils.js";
import { askConfirm, askText, info, warn } from "../../ui/clack/prompts.js";
import { runBash } from "../../adapters/exec.js";
import { runGh } from "../../adapters/gh.js";
import { commitAll, currentBranch, hasDirtyWorktree } from "../git.js";
import { findPrByBranch } from "../github.js";
import { nowIso, readSoloState, writeSoloState } from "../solo.js";
import {
  commentIssues,
  moveIssuesToStatus,
  resolveIssuesByNumber,
  upsertSoloIssueCoverageSection,
} from "./solo-common.js";

export interface SoloFinalizeOptions {
  done?: string;
  next?: string;
  blockers?: string;
  test?: string;
  skipTests?: boolean;
  autoCommit?: boolean;
  commitMessage?: string;
  prTitle?: string;
  assignee?: string;
  noIssueComment?: boolean;
}

export async function runSoloFinalize(config: AppConfig, options: SoloFinalizeOptions): Promise<CommandResult> {
  const result = ok("agentic solo finalize", "Finalize solo sprint branch into PR-ready state");
  const state = await readSoloState(config.repoRoot);
  if (!state) {
    throw new Error("No active solo state found. Start with `agentic solo start`.");
  }

  const branch = await currentBranch(config.repoRoot);
  if (branch !== state.branch) {
    throw new Error(`Current branch is '${branch}', expected solo branch '${state.branch}'. Switch branch first.`);
  }

  let testCmd = options.test ?? "pnpm -r test";
  if (!config.nonInteractive && !options.skipTests) {
    testCmd = await askText({ message: "Test command (type 'skip' to skip)", defaultValue: testCmd });
  }

  if (!options.skipTests && testCmd && testCmd !== "skip") {
    info(`Running tests: ${testCmd}`);
    const testResult = await runBash(testCmd, config.repoRoot);
    if (testResult.exitCode !== 0) {
      throw new Error(`Tests failed:\n${testResult.stdout}\n${testResult.stderr}`);
    }
  } else {
    warn("Skipping tests by operator request");
  }

  const dirty = await hasDirtyWorktree(config.repoRoot);
  if (dirty) {
    const shouldCommit = options.autoCommit ?? (!config.nonInteractive && (await askConfirm({ message: "Working tree is dirty. Commit now?", initialValue: true })));
    if (!shouldCommit) {
      throw new Error("Cannot finalize solo sprint with uncommitted changes");
    }

    const commitMessage =
      options.commitMessage ??
      (!config.nonInteractive
        ? await askText({
            message: "Commit message",
            defaultValue: `feat(${state.phase}): progress on solo sprint ${state.slug}`,
          })
        : `feat(${state.phase}): progress on solo sprint ${state.slug}`);

    await commitAll(config.repoRoot, commitMessage);
  }

  const done =
    options.done ??
    (!config.nonInteractive
      ? await askText({ message: "Done summary", validate: (value) => (value.trim() ? undefined : "Required") })
      : "Solo sprint work completed and ready for review.");
  const next = options.next ?? (!config.nonInteractive ? await askText({ message: "Next action", defaultValue: "Review and merge PR" }) : "Review and merge PR");
  const blockers = options.blockers ?? (!config.nonInteractive ? await askText({ message: "Blockers", defaultValue: "None" }) : "None");

  const issues = await resolveIssuesByNumber(config.repo, state.issueNumbers);

  const title = options.prTitle ?? `${state.phase}: Solo sprint - ${state.slug}`;
  const baseBody = [
    `## Solo Sprint Finalization`,
    "",
    `Delivery mode: ${state.deliveryMode === "single-issue" ? "single-issue" : "phase-pr"}`,
    `Phase: ${state.phase}`,
    `Branch: ${state.branch}`,
    "",
    `### Done`,
    done,
    "",
    `### Next`,
    next,
    "",
    `### Blockers`,
    blockers,
  ].join("\n");
  const body = upsertSoloIssueCoverageSection(baseBody, issues);

  const existingOpenPr = await findPrByBranch(config.repo, state.branch, "open");
  let prNumber = existingOpenPr?.number;
  let prUrl = existingOpenPr?.url;

  if (!existingOpenPr) {
    const args = [
      "pr",
      "create",
      "--repo",
      config.repo,
      "--base",
      "main",
      "--head",
      state.branch,
      "--title",
      title,
      "--body",
      body,
    ];

    const assignee = options.assignee ?? "@me";
    if (assignee) {
      args.push("--assignee", assignee);
    }

    const created = await runGh(args);
    prUrl = created.stdout.trim().split("\n").at(-1) ?? "";
    const createdPr = await findPrByBranch(config.repo, state.branch, "open");
    prNumber = createdPr?.number;
    if (!prUrl) {
      prUrl = createdPr?.url;
    }
  } else {
    const currentView = await runGh([
      "pr",
      "view",
      String(existingOpenPr.number),
      "--repo",
      config.repo,
      "--json",
      "body",
    ]);
    const parsed = JSON.parse(currentView.stdout) as { body?: string };
    const updatedBody = upsertSoloIssueCoverageSection(parsed.body ?? "", issues);

    await runGh([
      "pr",
      "edit",
      String(existingOpenPr.number),
      "--repo",
      config.repo,
      "--title",
      title,
      "--body",
      updatedBody || body,
    ]);
  }

  if (issues.length > 0) {
    await moveIssuesToStatus(config, issues, "Review");
    result.artifacts.issue = issues[0]?.number;

    if (!options.noIssueComment) {
      const issueBody = [
        "### Solo Sprint Finalization",
        `Delivery mode: ${state.deliveryMode === "single-issue" ? "single-issue" : "phase-pr"}`,
        `Phase: ${state.phase}`,
        `Branch: ${state.branch}`,
        `PR: ${prUrl ?? "<not found>"}`,
        "Status: Review",
        `Done: ${done}`,
        `Next: ${next}`,
        `Blockers: ${blockers}`,
      ].join("\n");
      await commentIssues(config, issues, issueBody);
    }
  }

  await writeSoloState(config.repoRoot, {
    ...state,
    updatedAt: nowIso(),
    status: "review",
  });

  if (prNumber) {
    result.artifacts.pr = prNumber;
  }
  if (prUrl) {
    result.nextSteps.push(`PR ready: ${prUrl}`);
  }
  result.artifacts.branch = state.branch;
  result.nextSteps.push("Run `agentic pr loop` for review iteration if needed.");
  result.nextSteps.push("Run `agentic pr merge` when checks/reviews are green.");

  return result;
}
