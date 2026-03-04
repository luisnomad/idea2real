import type { AppConfig, CommandResult } from "../../types/contracts.js";
import { runGh } from "../../adapters/gh.js";
import { runScript } from "../../adapters/scripts.js";
import { askConfirm, askSelect, info, warn } from "../../ui/clack/prompts.js";
import { ok } from "../command-utils.js";
import { inferSliceFromPr, listOpenAndMergedPrs, resolveIssueBySlice } from "../github.js";
import { runSessionStart } from "./session-start.js";
import { moveIssueToProjectStatus } from "../status-moves.js";

export interface PrMergeOptions {
  pr?: string;
  method?: "squash" | "merge" | "rebase";
  deleteRemote?: boolean;
  noCleanup?: boolean;
}

export async function runPrMerge(config: AppConfig, options: PrMergeOptions): Promise<CommandResult> {
  const result = ok("agentic pr merge", "Merge PR with guardrails and cleanup branch/worktree");
  const prs = await listOpenAndMergedPrs(config.repo);

  if (prs.length === 0) {
    throw new Error("No open/merged PRs found");
  }

  const selected = await selectPr(prs, options.pr, config.nonInteractive);
  if (!selected) {
    throw new Error("No PR selected");
  }

  result.artifacts.pr = selected.number;
  result.artifacts.branch = selected.headRefName;

  let mergedUrl = selected.url;
  const isOpen = selected.state.toUpperCase() === "OPEN";

  if (isOpen) {
    const method = await pickMergeMethod(options.method, config.nonInteractive);

    if (!config.nonInteractive) {
      const confirmMerge = await askConfirm({ message: `Merge PR #${selected.number} now?`, initialValue: true });
      if (!confirmMerge) {
        result.status = "warn";
        result.summary = "Merge canceled by operator";
        return result;
      }
    }

    const mergeArgs = [
      "pr",
      "merge",
      String(selected.number),
      "--repo",
      config.repo,
      `--${method}`,
    ];

    await runGh(mergeArgs);
    info(`Merged PR #${selected.number} with --${method}`);
  } else {
    warn(`PR #${selected.number} is already merged`);
  }

  const sliceId = inferSliceFromPr(selected);
  if (sliceId) {
    const issue = await resolveIssueBySlice(config.repo, sliceId);
    if (issue) {
      result.artifacts.issue = issue.number;

      try {
        await moveIssueToProjectStatus({
          owner: config.project.owner,
          projectNumber: config.project.number,
          statusFieldName: config.project.statusFieldName,
          issueUrl: issue.url,
          statusName: "Done",
        });
      } catch (error) {
        warn(`Could not move issue to Done: ${(error as Error).message}`);
      }

      const body = [
        "### Merge and Cleanup Summary",
        `Slice: ${sliceId}`,
        `Branch: ${selected.headRefName}`,
        `PR: ${mergedUrl}`,
        "Status: Done",
        "Next: Cleanup executed and next slice recommendation generated.",
      ].join("\n");

      await runGh(["issue", "comment", String(issue.number), "--repo", config.repo, "--body", body]);
    }
  }

  if (!options.noCleanup) {
    const deleteRemote = options.deleteRemote ?? (!config.nonInteractive && (await askConfirm({ message: "Delete remote branch too?", initialValue: false })));
    const cleanupArgs = ["--branch", selected.headRefName, "--yes", "--force"];
    if (deleteRemote) cleanupArgs.push("--delete-remote");

    const cleanup = await runScript(config.scriptsDir, "cleanupSliceWorktree", cleanupArgs);
    if (cleanup.exitCode !== 0) {
      throw new Error(cleanup.stderr || cleanup.stdout || "cleanup-slice-worktree failed");
    }
  }

  if (!config.nonInteractive) {
    const startNext = await askConfirm({ message: "Start a recommended next slice now?", initialValue: false });
    if (startNext) {
      await runSessionStart(config, {});
    }
  }

  result.nextSteps.push("Start the next slice using `agentic session start`.");
  return result;
}

async function pickMergeMethod(
  preferred: PrMergeOptions["method"],
  nonInteractive: boolean,
): Promise<"squash" | "merge" | "rebase"> {
  if (preferred) {
    return preferred;
  }

  if (nonInteractive) {
    return "squash";
  }

  const selected = await askSelect({
    message: "Select merge method",
    initialValue: "squash",
    options: [
      { value: "squash", label: "squash (recommended)" },
      { value: "merge", label: "merge commit" },
      { value: "rebase", label: "rebase" },
    ],
  });

  if (selected === "merge" || selected === "rebase") {
    return selected;
  }

  return "squash";
}

async function selectPr(
  prs: Awaited<ReturnType<typeof listOpenAndMergedPrs>>,
  prOption: string | undefined,
  nonInteractive: boolean,
): Promise<(typeof prs)[number] | undefined> {
  if (prOption && prOption !== "auto") {
    const number = Number(prOption);
    return prs.find((pr) => pr.number === number);
  }

  if (nonInteractive || prOption === "auto") {
    return prs[0];
  }

  const selected = await askSelect({
    message: "Select PR for merge/cleanup",
    options: prs.map((pr) => ({
      value: String(pr.number),
      label: `#${pr.number} [${pr.state}] ${pr.title}`,
      hint: `${pr.headRefName} | ${pr.mergeable ?? "UNKNOWN"}/${pr.mergeStateStatus ?? "UNKNOWN"}`,
    })),
  });

  return prs.find((pr) => String(pr.number) === selected);
}
