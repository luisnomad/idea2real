import type { AppConfig, CommandResult } from "../../types/contracts.js";
import { runScript } from "../../adapters/scripts.js";
import { askConfirm, askSelect, askText } from "../../ui/clack/prompts.js";
import { listLocalSliceWorktrees } from "../discovery/slices.js";
import { listOpenAndMergedPrs } from "../github.js";
import { ok } from "../command-utils.js";

export interface CleanupOptions {
  slice?: string;
  branch?: string;
  deleteRemote?: boolean;
  force?: boolean;
}

export async function runCleanupWorktree(config: AppConfig, options: CleanupOptions): Promise<CommandResult> {
  const result = ok("agentic cleanup worktree", "Cleanup merged slice worktree and branches");

  const target = await resolveCleanupTarget(config, options);
  if (!target.slice && !target.branch) {
    throw new Error("Cleanup target not resolved");
  }

  const args: string[] = ["--yes"];
  if (target.slice) args.push("--slice", target.slice);
  if (target.branch) args.push("--branch", target.branch);
  if (options.force ?? true) args.push("--force");

  const deleteRemote =
    options.deleteRemote ?? (!config.nonInteractive && (await askConfirm({ message: "Delete remote branch too?", initialValue: false })));
  if (deleteRemote) {
    args.push("--delete-remote");
  }

  const dryRunArgs = [...args, "--dry-run"];
  const dryRun = await runScript(config.scriptsDir, "cleanupSliceWorktree", dryRunArgs);
  if (dryRun.exitCode !== 0) {
    throw new Error(dryRun.stderr || dryRun.stdout || "cleanup dry-run failed");
  }

  if (!config.nonInteractive) {
    const execute = await askConfirm({ message: "Execute cleanup now?", initialValue: true });
    if (!execute) {
      result.status = "warn";
      result.summary = "Cleanup canceled by operator";
      return result;
    }
  }

  const run = await runScript(config.scriptsDir, "cleanupSliceWorktree", args);
  if (run.exitCode !== 0) {
    throw new Error(run.stderr || run.stdout || "cleanup failed");
  }

  if (target.slice) {
    result.artifacts.branch = target.branch;
  } else {
    result.artifacts.branch = target.branch;
  }

  result.nextSteps.push("Run `agentic doctor` to verify workspace health.");
  return result;
}

async function resolveCleanupTarget(
  config: AppConfig,
  options: CleanupOptions,
): Promise<{ slice?: string; branch?: string }> {
  if (options.slice || options.branch) {
    return {
      slice: options.slice?.toUpperCase(),
      branch: options.branch,
    };
  }

  if (config.nonInteractive) {
    throw new Error("Non-interactive cleanup requires --slice or --branch");
  }

  const mode = await askSelect({
    message: "Cleanup mode",
    options: [
      { value: "active", label: "Pick active slice worktree" },
      { value: "merged", label: "Pick merged/open PR" },
      { value: "manual", label: "Manual entry" },
    ],
  });

  if (mode === "active") {
    const worktrees = await listLocalSliceWorktrees(config.repoRoot);
    const selected = await askSelect({
      message: "Select active worktree",
      options: worktrees.map((wt) => ({
        value: wt.branch,
        label: `${wt.sliceId} :: ${wt.branch}`,
        hint: wt.path,
      })),
    });

    const target = worktrees.find((wt) => wt.branch === selected);
    return { branch: target?.branch, slice: target?.sliceId };
  }

  if (mode === "merged") {
    const prs = await listOpenAndMergedPrs(config.repo);
    const selected = await askSelect({
      message: "Select PR",
      options: prs.map((pr) => ({
        value: String(pr.number),
        label: `#${pr.number} [${pr.state}] ${pr.title}`,
        hint: pr.headRefName,
      })),
    });

    const target = prs.find((pr) => String(pr.number) === selected);
    return { branch: target?.headRefName };
  }

  const maybeSlice = await askText({
    message: "Slice ID (leave empty to use branch)",
  });

  if (maybeSlice.trim()) {
    return { slice: maybeSlice.toUpperCase() };
  }

  const branch = await askText({
    message: "Branch name",
    validate: (value) => (value.trim() ? undefined : "Branch is required when slice is empty"),
  });

  return { branch };
}
