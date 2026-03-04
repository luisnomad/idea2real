import { runCommand } from "../../adapters/exec.js";
import type { AppConfig, CommandResult } from "../../types/contracts.js";
import { askConfirm, askSelect } from "../../ui/clack/prompts.js";
import { note } from "../../ui/clack/prompts.js";
import { ok } from "../command-utils.js";
import { listLocalSliceWorktrees } from "../discovery/slices.js";
import { resolveIssueBySlice } from "../github.js";
import { moveIssueToProjectStatus } from "../status-moves.js";

export interface SessionResumeOptions {
  slice?: string;
  enter?: boolean;
}

export async function runSessionResume(config: AppConfig, options: SessionResumeOptions): Promise<CommandResult> {
  const result = ok("agentic session resume", "Resume an existing local session");
  const worktrees = await listLocalSliceWorktrees(config.repoRoot);

  if (worktrees.length === 0) {
    result.status = "warn";
    result.errors.push({
      code: "NO_LOCAL_WORKTREES",
      message: "No local codex worktrees were found",
      retryable: false,
    });
    result.nextSteps.push("Run `agentic session start` to create a new worktree.");
    return result;
  }

  const target = await pickWorktree(worktrees, options.slice?.toUpperCase(), config.nonInteractive);
  if (!target) {
    throw new Error("No resumable session selected");
  }

  result.artifacts.branch = target.branch;
  result.artifacts.worktree = target.path;
  const issue = await resolveIssueBySlice(config.repo, target.sliceId);
  if (issue) {
    try {
      await moveIssueToProjectStatus({
        owner: config.project.owner,
        projectNumber: config.project.number,
        statusFieldName: config.project.statusFieldName,
        issueUrl: issue.url,
        statusName: "In Progress",
      });
    } catch (error) {
      note(`Could not move issue to In Progress: ${(error as Error).message}`);
    }
    result.artifacts.issue = issue.number;
  }

  const shouldEnter = options.enter ?? (!config.nonInteractive && (await askConfirm({ message: "Enter worktree shell now?", initialValue: true })));
  if (shouldEnter) {
    note(`Opening shell in: ${target.path}`);
    const shell = process.env.SHELL || "bash";
    await runCommand(shell, ["-l"], { cwd: target.path, inherit: true, reject: false });
  }

  result.nextSteps.push(`Continue work in ${target.path}`);
  return result;
}

async function pickWorktree(
  worktrees: Awaited<ReturnType<typeof listLocalSliceWorktrees>>,
  sliceOverride: string | undefined,
  nonInteractive: boolean,
): Promise<(typeof worktrees)[number] | undefined> {
  if (sliceOverride) {
    return worktrees.find((worktree) => worktree.sliceId === sliceOverride);
  }

  if (nonInteractive) {
    return worktrees[0];
  }

  const selection = await askSelect({
    message: "Select local session to resume",
    options: worktrees.map((wt) => ({
      value: wt.branch,
      label: `${wt.sliceId} :: ${wt.branch}`,
      hint: wt.path,
    })),
  });

  return worktrees.find((wt) => wt.branch === selection);
}
