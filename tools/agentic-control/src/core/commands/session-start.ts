import { runCommand } from "../../adapters/exec.js";
import { runScript } from "../../adapters/scripts.js";
import type { AppConfig, CommandResult } from "../../types/contracts.js";
import { toSlug } from "../../utils/text.js";
import { askConfirm, askSelect, askText, info, note } from "../../ui/clack/prompts.js";
import { ok } from "../command-utils.js";
import { discoverSliceCatalog } from "../discovery/slices.js";

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
    result.artifacts.branch = selected.localWorktree.branch;
    result.artifacts.worktree = selected.localWorktree.path;
    result.nextSteps.push("Local worktree already exists; resuming session.");

    const shouldEnter = options.enter ?? (!config.nonInteractive && (await askConfirm({ message: "Enter worktree shell now?", initialValue: true })));
    if (shouldEnter) {
      await openShell(selected.localWorktree.path);
    }

    return result;
  }

  if (!selected.issue) {
    throw new Error(`Slice ${selected.sliceId} has no issue metadata to start a new worktree`);
  }

  const inferredSlug = options.slug ?? deriveSlug(selected.issue.title);
  const slug = inferredSlug || "session";
  const args = ["--slice", selected.sliceId, "--slug", slug];
  if (options.slot && Number.isFinite(options.slot)) {
    args.push("--slot", String(options.slot));
  }

  const shouldEnter = options.enter ?? (!config.nonInteractive && (await askConfirm({ message: "Enter new worktree shell after creation?", initialValue: true })));
  if (shouldEnter) {
    args.push("--enter");
  }

  const script = await runScript(config.scriptsDir, "newSliceWorktree", args);
  if (script.exitCode !== 0) {
    throw new Error(script.stderr || script.stdout || "Failed to create slice worktree");
  }

  result.artifacts.issue = selected.issue.number;
  result.artifacts.branch = `codex/${selected.sliceId.toLowerCase()}-${slug}`;
  result.nextSteps.push("Begin implementation in the new worktree.");
  result.nextSteps.push("Use `agentic slice finalize` when ready to open/update PR.");

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
