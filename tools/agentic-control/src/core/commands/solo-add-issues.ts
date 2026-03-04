import type { AppConfig, CommandResult } from "../../types/contracts.js";
import { ok } from "../command-utils.js";
import { askText, note, warn } from "../../ui/clack/prompts.js";
import { runGh, runGhJson } from "../../adapters/gh.js";
import { listOpenSliceIssuesByLabel, type IssuePayload, findPrByBranch } from "../github.js";
import { nowIso, phaseToLabel, readSoloState, writeSoloState } from "../solo.js";
import {
  commentIssues,
  moveIssuesToStatus,
  parseIssueNumbers,
  resolveIssuesByNumber,
  upsertSoloIssueCoverageSection,
} from "./solo-common.js";

interface ProjectItemStatus {
  content?: { number?: number };
  status?: string;
}

interface IssueCandidate {
  issue: IssuePayload;
  status: string;
}

export interface SoloAddIssuesOptions {
  issues?: string;
  noIssueComment?: boolean;
  updatePr?: boolean;
}

export async function runSoloAddIssues(config: AppConfig, options: SoloAddIssuesOptions): Promise<CommandResult> {
  const result = ok("agentic solo add-issues", "Add more issues to active solo sprint (phase PR)");
  const state = await readSoloState(config.repoRoot);
  if (!state) {
    throw new Error("No active solo state found. Start with `agentic solo start` or `agentic continue`.");
  }

  const phaseLabel = phaseToLabel(state.phase);
  const openPhaseIssues = await listOpenSliceIssuesByLabel(config.repo, phaseLabel);
  const openByNumber = new Map(openPhaseIssues.map((issue) => [issue.number, issue]));
  const statusByIssue = await loadProjectStatusMap(config).catch(() => new Map<number, string>());

  const linkedSet = new Set(state.issueNumbers);
  const suggested = openPhaseIssues
    .filter((issue) => !linkedSet.has(issue.number))
    .map((issue) => ({
      issue,
      status: statusByIssue.get(issue.number) ?? "Unknown",
    }))
    .filter((candidate) => isReadyBacklog(candidate.status))
    .sort((a, b) => a.issue.number - b.issue.number);

  const selectedNumbers = await resolveIssueSelection(config, options, suggested);
  if (selectedNumbers.length === 0) {
    throw new Error("No issues selected to add.");
  }

  const alreadyLinked = selectedNumbers.filter((number) => linkedSet.has(number));
  const newIssueNumbers = selectedNumbers.filter((number) => !linkedSet.has(number));
  if (newIssueNumbers.length === 0) {
    result.status = "warn";
    result.summary = "All selected issues are already linked to this solo sprint.";
    result.nextSteps.push("Run `agentic solo checkpoint` or continue coding.");
    return result;
  }

  const invalid = newIssueNumbers.filter((number) => !openByNumber.has(number));
  if (invalid.length > 0) {
    throw new Error(
      `These issues are not open slice issues for ${state.phase} (${phaseLabel}): ${invalid.join(", ")}.`,
    );
  }

  const addedIssues = await resolveIssuesByNumber(config.repo, newIssueNumbers);
  if (addedIssues.length !== newIssueNumbers.length) {
    const resolved = new Set(addedIssues.map((issue) => issue.number));
    const unresolved = newIssueNumbers.filter((number) => !resolved.has(number));
    throw new Error(`Could not resolve issue metadata for: ${unresolved.join(", ")}.`);
  }

  await moveIssuesToStatus(config, addedIssues, "In Progress");
  if (!options.noIssueComment) {
    const issueBody = [
      "### Added to active solo sprint",
      `Delivery mode: ${state.deliveryMode === "single-issue" ? "single-issue" : "phase-pr"}`,
      `Phase: ${state.phase}`,
      `Branch: ${state.branch}`,
      "Status: In Progress",
      "Reason: grouped into same solo sprint context/PR.",
    ].join("\n");
    await commentIssues(config, addedIssues, issueBody);
  }

  const mergedIssueNumbers = [...state.issueNumbers];
  for (const number of newIssueNumbers) {
    if (!mergedIssueNumbers.includes(number)) {
      mergedIssueNumbers.push(number);
    }
  }

  await writeSoloState(config.repoRoot, {
    ...state,
    issueNumbers: mergedIssueNumbers,
    updatedAt: nowIso(),
    status: "active",
  });

  const mergedIssues = await resolveIssuesByNumber(config.repo, mergedIssueNumbers);
  const shouldUpdatePr = options.updatePr ?? true;
  if (shouldUpdatePr) {
    const openPr = await findPrByBranch(config.repo, state.branch, "open");
    if (openPr) {
      const view = await runGhJson<{ body?: string }>([
        "pr",
        "view",
        String(openPr.number),
        "--repo",
        config.repo,
        "--json",
        "body",
      ]);
      const updatedBody = upsertSoloIssueCoverageSection(view.body ?? "", mergedIssues);
      await runGh([
        "pr",
        "edit",
        String(openPr.number),
        "--repo",
        config.repo,
        "--body",
        updatedBody,
      ]);
      result.artifacts.pr = openPr.number;
      result.nextSteps.push(`Updated open PR #${openPr.number} issue coverage block.`);
    } else {
      warn("No open PR found for this solo branch. PR body update skipped.");
      result.nextSteps.push("Open/refresh PR later with `agentic solo finalize`.");
    }
  }

  result.artifacts.branch = state.branch;
  result.artifacts.issue = newIssueNumbers[0];
  result.summary = `Added ${newIssueNumbers.length} issue(s) to solo sprint${alreadyLinked.length ? ` (${alreadyLinked.length} already linked ignored)` : ""}.`;
  result.nextSteps.push(`Solo sprint now tracks ${mergedIssueNumbers.length} issue(s).`);
  result.nextSteps.push("Continue implementation and use `agentic solo checkpoint` as needed.");
  result.nextSteps.push("Use `agentic solo finalize` when the phase PR is ready.");
  return result;
}

async function resolveIssueSelection(
  config: AppConfig,
  options: SoloAddIssuesOptions,
  suggested: IssueCandidate[],
): Promise<number[]> {
  if (options.issues) {
    return parseIssueNumbers(options.issues);
  }

  if (config.nonInteractive) {
    return suggested.map((candidate) => candidate.issue.number);
  }

  if (suggested.length === 0) {
    throw new Error("No suggested Ready/Backlog issues found. Pass explicit issue numbers with --issues.");
  }

  note("Suggested issues (same phase, Ready/Backlog):");
  for (const candidate of suggested.slice(0, 15)) {
    note(`- [${candidate.status}] #${candidate.issue.number} ${candidate.issue.title}`);
  }

  const raw = await askText({
    message: "Issue numbers to add (comma-separated, or 'auto' for all suggested)",
    defaultValue: "auto",
  });

  if (!raw || raw.trim().toLowerCase() === "auto") {
    return suggested.map((candidate) => candidate.issue.number);
  }

  return parseIssueNumbers(raw);
}

async function loadProjectStatusMap(config: AppConfig): Promise<Map<number, string>> {
  const payload = await runGhJson<{ items?: ProjectItemStatus[] }>([
    "project",
    "item-list",
    String(config.project.number),
    "--owner",
    config.project.owner,
    "--limit",
    "500",
    "--format",
    "json",
  ]);

  const statusByIssue = new Map<number, string>();
  for (const item of payload.items ?? []) {
    const issueNumber = item.content?.number;
    if (!issueNumber) continue;
    statusByIssue.set(issueNumber, item.status ?? "Unknown");
  }
  return statusByIssue;
}

function isReadyBacklog(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  return normalized === "ready" || normalized === "backlog";
}
