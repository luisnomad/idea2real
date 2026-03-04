import { runCommand } from "../../adapters/exec.js";
import { runScript } from "../../adapters/scripts.js";
import type { AppConfig, CommandResult } from "../../types/contracts.js";
import { mkdir, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { toSlug } from "../../utils/text.js";
import { askConfirm, askSelect, askText, info, note } from "../../ui/clack/prompts.js";
import { ok } from "../command-utils.js";
import { discoverSliceCatalog } from "../discovery/slices.js";
import { resolveIssueBySlice } from "../github.js";
import { moveIssueToProjectStatus } from "../status-moves.js";

export interface SessionStartOptions {
  slice?: string;
  issue?: string;
  slug?: string;
  slot?: number;
  enter?: boolean;
}

export async function runSessionStart(config: AppConfig, options: SessionStartOptions): Promise<CommandResult> {
  const result = ok("agentic session start", "Start or resume a local slice session");

  await preflight(config);

  const catalog = await discoverSliceCatalog(config.repoRoot, config.repo);
  if (catalog.length === 0 && !options.slice) {
    result.status = "warn";
    result.errors.push({
      code: "NO_ITEMS_DISCOVERED",
      message: "No active sessions or open slice issues discovered",
      retryable: false,
    });
    result.nextSteps.push("Create slice issues first: `agentic pm seed-issues`." );
    return result;
  }

  const requestedSlice = options.slice?.toUpperCase();
  const requestedIssue = options.issue ? Number(options.issue) : undefined;
  const selected = requestedSlice
    ? catalog.find((item) => item.sliceId === requestedSlice)
    : requestedIssue
      ? catalog.find((item) => item.issue?.number === requestedIssue)
      : await chooseSlice(catalog, config.nonInteractive);

  if (!selected && requestedSlice) {
    throw new Error(`Slice not found in discovered catalog: ${requestedSlice}`);
  }

  if (!selected) {
    throw new Error("No slice selected");
  }

  if (selected.localWorktree) {
    const issueForSlice = selected.issue ?? (await resolveIssueBySlice(config.repo, selected.sliceId));
    if (issueForSlice) {
      try {
        await moveSliceToInProgress(config, issueForSlice.url);
      } catch (error) {
        note(`Could not move issue to In Progress: ${(error as Error).message}`);
      }
      result.artifacts.issue = issueForSlice.number;
    }

    const kickoffFile = await ensureKickoffPrompt({
      sliceId: selected.sliceId,
      issueLabel: issueForSlice ? `#${issueForSlice.number} ${issueForSlice.title}` : selected.localWorktree.branch,
      issueUrl: issueForSlice?.url ?? "",
      worktreePath: selected.localWorktree.path,
      nextHint: "Resume from current branch status and issue comments.",
      overwrite: false,
    });
    result.artifacts.branch = selected.localWorktree.branch;
    result.artifacts.worktree = selected.localWorktree.path;
    if (kickoffFile) {
      result.artifacts.handoffFile = kickoffFile;
    }
    result.nextSteps.push("Local worktree already exists; resuming session.");
    if (kickoffFile) {
      result.nextSteps.push(`Kickoff prompt: ${kickoffFile}`);
    }

    const shouldEnter = options.enter ?? (!config.nonInteractive && (await askConfirm({ message: "Enter worktree shell now?", initialValue: true })));
    if (shouldEnter) {
      note(`Opening shell in: ${selected.localWorktree.path}`);
      await openShell(selected.localWorktree.path);
    }

    return result;
  }

  if (!selected.issue) {
    throw new Error(`Slice ${selected.sliceId} has no issue metadata to start a new worktree`);
  }
  try {
    await moveSliceToInProgress(config, selected.issue.url);
  } catch (error) {
    note(`Could not move issue to In Progress: ${(error as Error).message}`);
  }

  const inferredSlug = options.slug ?? deriveSlug(selected.issue.title);
  const slug = inferredSlug || "session";
  const args = ["--slice", selected.sliceId, "--slug", slug];
  if (options.slot && Number.isFinite(options.slot)) {
    args.push("--slot", String(options.slot));
  }

  const shouldEnter = options.enter ?? (!config.nonInteractive && (await askConfirm({ message: "Enter new worktree shell after creation?", initialValue: true })));

  const script = await runScript(config.scriptsDir, "newSliceWorktree", args);
  if (script.exitCode !== 0) {
    throw new Error(script.stderr || script.stdout || "Failed to create slice worktree");
  }

  const createdWorktreePath = parseCreatedWorktreePath(script.stdout);
  const resolvedWorktreePath = createdWorktreePath || inferDefaultWorktreePath(config.repoRoot, selected.sliceId);
  const kickoffFile = await ensureKickoffPrompt({
    sliceId: selected.sliceId,
    issueLabel: `#${selected.issue.number} ${selected.issue.title}`,
    issueUrl: selected.issue.url,
    worktreePath: resolvedWorktreePath,
    nextHint: "No prior handoff available. Start from issue definition of done.",
    overwrite: true,
  });
  result.artifacts.issue = selected.issue.number;
  result.artifacts.branch = `codex/${selected.sliceId.toLowerCase()}-${slug}`;
  if (resolvedWorktreePath) {
    result.artifacts.worktree = resolvedWorktreePath;
  }
  if (kickoffFile) {
    result.artifacts.handoffFile = kickoffFile;
  }
  result.nextSteps.push("Begin implementation in the new worktree.");
  result.nextSteps.push("Use `agentic slice finalize` when ready to open/update PR.");
  if (kickoffFile) {
    result.nextSteps.push(`Kickoff prompt: ${kickoffFile}`);
  }

  if (shouldEnter) {
    const enterPath = resolvedWorktreePath;
    if (!enterPath) {
      throw new Error("Worktree created but path could not be resolved for shell entry");
    }

    note(`Opening shell in: ${enterPath}`);
    await openShell(enterPath);
  }

  return result;
}

async function preflight(config: AppConfig): Promise<void> {
  const dockerResult = await runCommand("bash", ["-lc", "command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1"], {
    reject: false,
  });
  const ghResult = await runCommand("gh", ["auth", "status"], { reject: false });

  if (dockerResult.exitCode !== 0) {
    note("Preflight warning: docker daemon appears down or unavailable.");
  }

  if (ghResult.exitCode !== 0) {
    throw new Error("gh is not authenticated. Run `agentic doctor` or `./scripts/gh-bootstrap.sh`.");
  }

  info(`Repo: ${config.repo}`);
  info(`Project: ${config.project.owner}#${config.project.number}`);
}

async function chooseSlice(
  catalog: Awaited<ReturnType<typeof discoverSliceCatalog>>,
  nonInteractive: boolean,
): Promise<(typeof catalog)[number] | undefined> {
  if (catalog.length === 0) {
    return undefined;
  }

  if (nonInteractive) {
    return catalog.find((item) => !item.localWorktree) ?? catalog[0];
  }

  const options = catalog.map((item) => {
    const mode = item.localWorktree ? "RESUME" : "START";
    const issueInfo = item.issue ? `#${item.issue.number}` : "no-issue";
    const prInfo = item.pr ? `PR #${item.pr.number}` : "no-pr";

    return {
      value: item.sliceId,
      label: `[${mode}][${item.domain}] ${item.sliceId} (${issueInfo}, ${prInfo})`,
      hint: item.localWorktree?.path ?? item.issue?.title,
    };
  });

  const value = await askSelect({
    message: "Select slice to start/resume",
    options,
  });

  return catalog.find((item) => item.sliceId === value);
}

function deriveSlug(title: string): string {
  const withoutPrefix = title.replace(/^P[0-9]+-[A-Z0-9]+-[0-9]+:\s*/, "");
  return toSlug(withoutPrefix);
}

async function openShell(path: string): Promise<void> {
  const shell = process.env.SHELL || "bash";
  await runCommand(shell, ["-l"], { cwd: path, inherit: true, reject: false });
}

function parseCreatedWorktreePath(stdout: string): string {
  const match = /^\s*Worktree:\s+(.+)\s*$/m.exec(stdout);
  return match?.[1]?.trim() ?? "";
}

function inferDefaultWorktreePath(repoRoot: string, sliceId: string): string {
  const repoName = repoRoot.split("/").filter(Boolean).at(-1) ?? "repo";
  const sliceSlug = toSlug(sliceId);
  return `${repoRoot}/../${repoName}-${sliceSlug}`;
}

async function ensureKickoffPrompt(params: {
  sliceId: string;
  issueLabel: string;
  issueUrl: string;
  worktreePath: string;
  nextHint: string;
  overwrite: boolean;
}): Promise<string> {
  if (!params.worktreePath) {
    return "";
  }

  const sessionsDir = join(params.worktreePath, ".sessions");
  const kickoffFile = join(sessionsDir, `kickoff-${params.sliceId}.md`);

  if (!params.overwrite) {
    try {
      await access(kickoffFile, constants.F_OK);
      return kickoffFile;
    } catch {
      // continue and create file
    }
  }

  await mkdir(sessionsDir, { recursive: true });

  const body = [
    `You own slice ${params.sliceId}.`,
    "",
    "Reference:",
    `- ${params.issueLabel}`,
    params.issueUrl ? `- ${params.issueUrl}` : "- <issue URL unavailable>",
    "",
    "Rules:",
    "- Follow AGENTS.md, CONTRIBUTING.md, docs/project/LOCAL_PARALLEL_WORKFLOW.md.",
    "- Touch only allowed paths for this slice.",
    "- Optional sub-agents are allowed only with non-overlapping file ownership inside this slice.",
    "- If delegating, split by explicit path groups and integrate sub-agent outputs sequentially.",
    "- Use meaningful TDD (Given/When/Then -> failing test -> minimal fix -> refactor).",
    "- Keep commits atomic and include slice ID in commit message.",
    "",
    "First actions:",
    `1) Restate the behavior contract for ${params.sliceId}.`,
    "2) List files you plan to touch before editing.",
    "3) Implement using the TDD loop and run targeted tests.",
    "4) Summarize changes, residual risks, and next step.",
    "5) Commit all changes on the slice branch.",
    "6) Ensure working tree is clean.",
    "7) Finalize session by running:",
    "   ./scripts/finish-slice-session.sh --done \"<summary>\" --next \"Ready for review and merge\" --blockers \"None\"",
    "",
    "Issue status lifecycle:",
    "- Start/resume session -> In Progress",
    "- Finalize slice/PR ready -> Review",
    "- Merge PR + cleanup -> Done",
    "",
    "Prior handoff hint:",
    params.nextHint,
    "",
  ].join("\n");

  await writeFile(kickoffFile, body, "utf8");
  return kickoffFile;
}

async function moveSliceToInProgress(config: AppConfig, issueUrl: string): Promise<void> {
  await moveIssueToProjectStatus({
    owner: config.project.owner,
    projectNumber: config.project.number,
    statusFieldName: config.project.statusFieldName,
    issueUrl,
    statusName: "In Progress",
  });
}
