import type { AppConfig, CommandResult } from "../../types/contracts.js";
import { runBash, runCommand } from "../../adapters/exec.js";
import { runGh } from "../../adapters/gh.js";
import { runScript } from "../../adapters/scripts.js";
import { askConfirm, askSelect, askText, info, warn } from "../../ui/clack/prompts.js";
import { defaultTestCommandForSlice, extractSliceFromBranch } from "../../utils/text.js";
import { commitAll, hasDirtyWorktree } from "../git.js";
import { resolveIssueBySlice, findPrByBranch } from "../github.js";
import { moveIssueToProjectStatus } from "../status-moves.js";
import { ok } from "../command-utils.js";
import { listLocalSliceWorktrees } from "../discovery/slices.js";

export interface SliceFinalizeOptions {
  slice?: string;
  done?: string;
  next?: string;
  blockers?: string;
  assignee?: string;
  test?: string;
  skipTests?: boolean;
  autoCommit?: boolean;
  commitMessage?: string;
}

export async function runSliceFinalize(config: AppConfig, options: SliceFinalizeOptions): Promise<CommandResult> {
  const result = ok("agentic slice finalize", "Close slice, finalize handoff, and move issue to Review");
  const worktrees = await listLocalSliceWorktrees(config.repoRoot);

  if (worktrees.length === 0) {
    throw new Error("No active slice worktrees found");
  }

  const selected = await selectWorktree(worktrees, options.slice?.toUpperCase(), config.nonInteractive);
  if (!selected) {
    throw new Error("No slice worktree selected");
  }

  const sliceId = extractSliceFromBranch(selected.branch);
  if (!sliceId) {
    throw new Error(`Could not infer slice ID from branch ${selected.branch}`);
  }

  let testCmd = options.test ?? defaultTestCommandForSlice(sliceId);
  if (!config.nonInteractive && !options.skipTests) {
    const testInput = await askText({
      message: `Test command for ${sliceId} (type 'skip' to skip)` ,
      defaultValue: testCmd || "skip",
    });
    testCmd = testInput;
  }

  if (!options.skipTests && testCmd && testCmd !== "skip") {
    info(`Running tests: ${testCmd}`);
    const testResult = await runBash(testCmd, selected.path);
    if (testResult.exitCode !== 0) {
      throw new Error(`Tests failed:\n${testResult.stdout}\n${testResult.stderr}`);
    }
  } else {
    warn("Skipping tests by operator request");
  }

  const dirty = await hasDirtyWorktree(selected.path);
  if (dirty) {
    const shouldCommit = options.autoCommit ?? (!config.nonInteractive && (await askConfirm({ message: "Worktree has uncommitted changes. Commit now?", initialValue: true })));
    if (!shouldCommit) {
      throw new Error("Cannot finalize slice with uncommitted changes");
    }

    const commitMessage =
      options.commitMessage ??
      (!config.nonInteractive
        ? await askText({
            message: "Commit message",
            defaultValue: `feat(${sliceId}): complete slice`,
          })
        : `feat(${sliceId}): complete slice`);

    await commitAll(selected.path, commitMessage);
  }

  const doneText =
    options.done ??
    (!config.nonInteractive
      ? await askText({ message: "Done summary", validate: (value) => (value.trim() ? undefined : "Required") })
      : "Completed slice implementation.");
  const nextText = options.next ?? (!config.nonInteractive ? await askText({ message: "Next action", defaultValue: "Ready for review and merge" }) : "Ready for review and merge");
  const blockersText = options.blockers ?? (!config.nonInteractive ? await askText({ message: "Blockers", defaultValue: "None" }) : "None");
  const assignee = options.assignee ?? (!config.nonInteractive ? await askText({ message: "PR assignee", defaultValue: "@me" }) : "@me");

  const finishResult = await runScript(
    config.scriptsDir,
    "finishSliceSession",
    ["--done", doneText, "--next", nextText, "--blockers", blockersText, "--assignee", assignee],
    selected.path,
  );

  if (finishResult.exitCode !== 0) {
    throw new Error(finishResult.stderr || finishResult.stdout || "finish-slice-session failed");
  }

  const issue = await resolveIssueBySlice(config.repo, sliceId);
  if (issue) {
    try {
      await moveIssueToProjectStatus({
        owner: config.project.owner,
        projectNumber: config.project.number,
        statusFieldName: config.project.statusFieldName,
        issueUrl: issue.url,
        statusName: "Review",
      });
    } catch (error) {
      warn(`Could not move issue to Review: ${(error as Error).message}`);
    }

    result.artifacts.issue = issue.number;
  }

  const pr = await findPrByBranch(config.repo, selected.branch, "all");
  if (pr) {
    result.artifacts.pr = pr.number;
  }

  if (issue) {
    const commentBody = [
      "### Slice Completion Summary",
      `Slice: ${sliceId}`,
      `Branch: ${selected.branch}`,
      "Status: Review",
      `Tests: ${testCmd || "<none>"}`,
      `PR: ${pr?.url ?? "<not found>"}`,
      `Done: ${doneText}`,
      `Next: ${nextText}`,
      `Blockers: ${blockersText}`,
    ].join("\n");

    await runGh(["issue", "comment", String(issue.number), "--repo", config.repo, "--body", commentBody]);
  }

  result.artifacts.branch = selected.branch;
  result.artifacts.worktree = selected.path;
  result.nextSteps.push("Address review comments with `agentic pr loop` if requested.");
  result.nextSteps.push("When checks are green, run `agentic pr merge`.");

  return result;
}

async function selectWorktree(
  worktrees: Awaited<ReturnType<typeof listLocalSliceWorktrees>>,
  slice: string | undefined,
  nonInteractive: boolean,
): Promise<(typeof worktrees)[number] | undefined> {
  if (slice) {
    return worktrees.find((worktree) => worktree.sliceId === slice);
  }

  if (nonInteractive) {
    return worktrees[0];
  }

  const value = await askSelect({
    message: "Select slice worktree to finalize",
    options: worktrees.map((wt) => ({
      value: wt.branch,
      label: `${wt.sliceId} :: ${wt.branch}`,
      hint: wt.path,
    })),
  });

  return worktrees.find((wt) => wt.branch === value);
}
