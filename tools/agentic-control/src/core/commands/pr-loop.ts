import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AppConfig, CommandResult } from "../../types/contracts.js";
import { runCommand } from "../../adapters/exec.js";
import { runGh, runGhJson } from "../../adapters/gh.js";
import { askConfirm, askSelect, askText, info, warn } from "../../ui/clack/prompts.js";
import { extractSliceFromTitle } from "../../utils/text.js";
import { ok } from "../command-utils.js";
import { buildPrWorktreePath, addWorktree, branchExists, fetchBranch } from "../git.js";
import { resolveIssueBySlice, listOpenPrs, type PullRequestInfo } from "../github.js";
import { moveIssueToProjectStatus } from "../status-moves.js";
import { buildPrFeedbackComment } from "../templates/pr-feedback.js";
import { listLocalSliceWorktrees } from "../discovery/slices.js";
import { repoShortName } from "../context.js";

interface PrCheck {
  name: string;
  state?: string;
  bucket?: string;
  link?: string;
}

interface PrReview {
  state: string;
  body?: string;
  user?: { login?: string };
}

interface PrComment {
  body?: string;
}

interface GraphqlThreads {
  data?: {
    repository?: {
      pullRequest?: {
        reviewThreads?: {
          nodes?: Array<{
            isResolved: boolean;
            isOutdated: boolean;
            path?: string;
            line?: number;
            originalLine?: number;
            comments?: {
              nodes?: Array<{
                body?: string;
                author?: { login?: string };
              }>;
            };
          }>;
        };
      };
    };
  };
}

export interface PrLoopOptions {
  pr?: string;
  openShell?: boolean;
}

export async function runPrLoop(config: AppConfig, options: PrLoopOptions): Promise<CommandResult> {
  const result = ok("agentic pr loop", "Review PR feedback, checks, and follow-up actions");

  const pr = await selectPr(config, options.pr, config.nonInteractive);
  if (!pr) {
    throw new Error("No open PR selected");
  }

  const checks = await runGhJson<PrCheck[]>([
    "pr",
    "checks",
    String(pr.number),
    "--repo",
    config.repo,
    "--json",
    "name,state,bucket,link",
  ]).catch(() => []);

  const reviews = await runGhJson<PrReview[]>([
    "api",
    `repos/${config.repo}/pulls/${pr.number}/reviews`,
    "--paginate",
  ]).catch(() => []);

  const reviewComments = await runGhJson<PrComment[]>([
    "api",
    `repos/${config.repo}/pulls/${pr.number}/comments`,
    "--paginate",
  ]).catch(() => []);

  const [owner, repoName] = config.repo.split("/");
  const threadsPayload: GraphqlThreads = await runGhJson<GraphqlThreads>([
    "api",
    "graphql",
    "-F",
    `owner=${owner}`,
    "-F",
    `repo=${repoName}`,
    "-F",
    `number=${pr.number}`,
    "-f",
    'query=query($owner:String!,$repo:String!,$number:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$number){reviewThreads(first:100){nodes{isResolved isOutdated path line originalLine comments(last:1){nodes{body author{login}}}}}}}}',
  ]).catch(() => ({} as GraphqlThreads));

  const threads = threadsPayload.data?.repository?.pullRequest?.reviewThreads?.nodes ?? [];
  const unresolvedThreads = threads.filter((thread: (typeof threads)[number]) => !thread.isResolved && !thread.isOutdated);

  const failingChecks = checks.filter(
    (check) => check.bucket === "fail" || check.state?.toLowerCase() === "failure",
  );
  const pendingChecks = checks.filter(
    (check) => check.bucket === "pending" || check.state?.toLowerCase() === "pending",
  );
  const changesRequested = reviews.filter((review) => review.state === "CHANGES_REQUESTED");

  info(`PR #${pr.number}: ${pr.title}`);
  info(`Checks: fail=${failingChecks.length}, pending=${pendingChecks.length}`);
  info(
    `Feedback: changes_requested=${changesRequested.length}, inline_comments=${reviewComments.length}, unresolved_threads=${unresolvedThreads.length}`,
  );

  const actionItems: string[] = [];
  let statusTarget: "In Progress" | "Blocked" = "In Progress";

  if (pr.isDraft) {
    actionItems.push("PR is draft; convert to ready when feedback cycle is complete.");
  }
  if (failingChecks.length > 0) {
    actionItems.push(`Fix failing checks (${failingChecks.length}).`);
  }
  if (pendingChecks.length > 0) {
    actionItems.push(`Wait for pending checks (${pendingChecks.length}) or investigate stuck runs.`);
  }
  if (changesRequested.length > 0) {
    actionItems.push(`Address requested review changes (${changesRequested.length}).`);
  }
  if (unresolvedThreads.length > 0) {
    actionItems.push(`Resolve unresolved review threads (${unresolvedThreads.length}).`);
  }
  if (pr.mergeable === "CONFLICTING" || pr.mergeStateStatus === "DIRTY") {
    actionItems.push("Resolve merge conflicts against base branch.");
    statusTarget = "Blocked";
  }

  if (actionItems.length > 0) {
    warn("Action items:");
    for (const item of actionItems) {
      warn(`- ${item}`);
    }
  } else {
    info("No blocking feedback signals detected. PR appears merge-ready.");
  }

  if (!config.nonInteractive && (await askConfirm({ message: "Post PR feedback round comment?", initialValue: true }))) {
    const title = await askText({ message: "Round title", defaultValue: "PR feedback round" });
    const fixedNow = await askText({ message: "Fixed now", defaultValue: "- None this round." });
    const leftAsIs = await askText({ message: "Left as-is", defaultValue: "- Nothing deferred." });
    const rationale = await askText({ message: "Why left as-is", defaultValue: "- No special rationale required." });
    const nextActions = await askText({ message: "Next actions", defaultValue: "- Re-run checks and review state." });

    const body = buildPrFeedbackComment({
      title,
      prUrl: pr.url,
      branch: pr.headRefName,
      mergeable: pr.mergeable ?? "UNKNOWN",
      mergeState: pr.mergeStateStatus ?? "UNKNOWN",
      failingChecks: failingChecks.length,
      pendingChecks: pendingChecks.length,
      changesRequested: changesRequested.length,
      unresolvedThreads: unresolvedThreads.length,
      fixedNow,
      leftAsIs,
      rationale,
      nextActions,
    });

    await runGh(["pr", "comment", String(pr.number), "--repo", config.repo, "--body", body]);
  }

  if (actionItems.length > 0) {
    const shouldStartLocal =
      options.openShell ?? (!config.nonInteractive && (await askConfirm({ message: "Create/resume local PR feedback worktree?", initialValue: true })));

    if (shouldStartLocal) {
      const worktree = await ensureWorktreeForPr(config, pr);
      result.artifacts.worktree = worktree;

      const promptDir = join(worktree, ".sessions", "pr-feedback");
      await mkdir(promptDir, { recursive: true });
      const promptFile = join(promptDir, `pr-${pr.number}.md`);

      const prompt = [
        `PR: #${pr.number} ${pr.title}`,
        `URL: ${pr.url}`,
        `Branch: ${pr.headRefName}`,
        "",
        "Feedback loop goals:",
        ...actionItems.map((item) => `- ${item}`),
        "",
        "Required steps:",
        "1) Address reviewer comments and requested changes.",
        "2) Resolve merge conflicts (if any).",
        "3) Run targeted tests/lint for changed files.",
        "4) Push updates and reply/resolve review threads.",
        "5) Post a PR comment with: fixed now, left as-is, and why.",
        "6) Re-run `agentic pr loop` and confirm no blockers remain.",
      ].join("\n");

      await writeFile(promptFile, `${prompt}\n`, "utf8");
      result.artifacts.handoffFile = promptFile;

      if (!config.nonInteractive && (await askConfirm({ message: "Open shell in PR feedback worktree now?", initialValue: true }))) {
        const shell = process.env.SHELL || "bash";
        await runCommand(shell, ["-l"], { cwd: worktree, inherit: true, reject: false });
      }
    }
  }

  const sliceFromTitle = extractSliceFromTitle(pr.title);
  if (sliceFromTitle) {
    const issue = await resolveIssueBySlice(config.repo, sliceFromTitle);
    if (issue) {
      result.artifacts.issue = issue.number;
      try {
        await moveIssueToProjectStatus({
          owner: config.project.owner,
          projectNumber: config.project.number,
          statusFieldName: config.project.statusFieldName,
          issueUrl: issue.url,
          statusName: statusTarget,
        });
      } catch (error) {
        warn(`Could not move issue status: ${(error as Error).message}`);
      }
    }
  }

  result.artifacts.pr = pr.number;
  result.artifacts.branch = pr.headRefName;
  result.nextSteps.push("Apply requested changes, push commits, and run `agentic pr loop` again.");
  if (actionItems.length === 0) {
    result.nextSteps.push("PR looks merge-ready. Run `agentic pr merge`. ");
  }

  return result;
}

async function selectPr(
  config: AppConfig,
  prOption: string | undefined,
  nonInteractive: boolean,
): Promise<PullRequestInfo | undefined> {
  const prs = await listOpenPrs(config.repo);
  if (prs.length === 0) {
    return undefined;
  }

  if (prOption && prOption !== "auto") {
    const num = Number(prOption);
    return prs.find((pr) => pr.number === num);
  }

  if (nonInteractive || prOption === "auto") {
    return prs[0];
  }

  const selected = await askSelect({
    message: "Select open PR",
    options: prs.map((pr) => ({
      value: String(pr.number),
      label: `#${pr.number} ${pr.title}`,
      hint: `${pr.headRefName} | ${pr.mergeable ?? "UNKNOWN"}/${pr.mergeStateStatus ?? "UNKNOWN"}`,
    })),
  });

  return prs.find((pr) => String(pr.number) === selected);
}

async function ensureWorktreeForPr(config: AppConfig, pr: PullRequestInfo): Promise<string> {
  const existing = (await listLocalSliceWorktrees(config.repoRoot)).find((worktree) => worktree.branch === pr.headRefName);
  if (existing) {
    return existing.path;
  }

  if (!(await branchExists(config.repoRoot, pr.headRefName))) {
    await fetchBranch(config.repoRoot, pr.headRefName);
  }

  if (!(await branchExists(config.repoRoot, pr.headRefName))) {
    throw new Error(`Branch '${pr.headRefName}' is unavailable locally and could not be fetched`);
  }

  const path = buildPrWorktreePath(config.repoRoot, repoShortName(config.repoRoot), pr.number, pr.headRefName);
  await addWorktree(config.repoRoot, path, pr.headRefName);
  return path;
}
