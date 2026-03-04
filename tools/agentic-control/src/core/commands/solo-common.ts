import { constants } from "node:fs";
import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AppConfig } from "../../types/contracts.js";
import { runGh } from "../../adapters/gh.js";
import { note } from "../../ui/clack/prompts.js";
import { getIssueByNumber, type IssuePayload } from "../github.js";
import { moveIssueToProjectStatus } from "../status-moves.js";

export const SOLO_PR_ISSUES_START = "<!-- agentic-solo-issues:start -->";
export const SOLO_PR_ISSUES_END = "<!-- agentic-solo-issues:end -->";

export function parseIssueNumbers(raw: string | undefined): number[] {
  if (!raw) return [];
  const values = raw
    .split(/[\s,]+/)
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);
  return [...new Set(values)];
}

export async function resolveIssuesByNumber(repo: string, numbers: number[]): Promise<IssuePayload[]> {
  const resolved: IssuePayload[] = [];
  for (const issueNumber of numbers) {
    const issue = await getIssueByNumber(repo, issueNumber);
    if (issue) {
      resolved.push(issue);
    }
  }
  return resolved;
}

export async function moveIssuesToStatus(
  config: AppConfig,
  issues: IssuePayload[],
  statusName: "In Progress" | "Review" | "Done" | "Blocked" | "Ready" | "Backlog",
): Promise<void> {
  for (const issue of issues) {
    try {
      await moveIssueToProjectStatus({
        owner: config.project.owner,
        projectNumber: config.project.number,
        statusFieldName: config.project.statusFieldName,
        issueUrl: issue.url,
        statusName,
      });
    } catch (error) {
      note(`Could not move issue #${issue.number} to ${statusName}: ${(error as Error).message}`);
    }
  }
}

export async function commentIssues(config: AppConfig, issues: IssuePayload[], body: string): Promise<void> {
  for (const issue of issues) {
  await runGh(["issue", "comment", String(issue.number), "--repo", config.repo, "--body", body]);
  }
}

export function buildSoloIssueCoverageSection(issues: IssuePayload[]): string {
  const issueCoverage = issues.length > 0 ? issues.map((issue) => `- #${issue.number} ${issue.title}`).join("\n") : "- No linked issues.";
  const closeLines = issues.length > 0 ? issues.map((issue) => `Closes #${issue.number}`).join("\n") : "- None";

  return [
    SOLO_PR_ISSUES_START,
    "### Issue coverage",
    issueCoverage,
    "",
    "### Auto-close on merge",
    closeLines,
    SOLO_PR_ISSUES_END,
  ].join("\n");
}

export function upsertSoloIssueCoverageSection(prBody: string, issues: IssuePayload[]): string {
  const normalized = prBody.trimEnd();
  const section = buildSoloIssueCoverageSection(issues);

  if (normalized.includes(SOLO_PR_ISSUES_START) && normalized.includes(SOLO_PR_ISSUES_END)) {
    const pattern = new RegExp(`${escapeRegex(SOLO_PR_ISSUES_START)}[\\s\\S]*?${escapeRegex(SOLO_PR_ISSUES_END)}`, "m");
    return normalized.replace(pattern, section);
  }

  if (!normalized) {
    return `${section}\n`;
  }

  return `${normalized}\n\n${section}\n`;
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function writeSoloKickoffPrompt(params: {
  repoRoot: string;
  phase: string;
  slug: string;
  branch: string;
  deliveryMode?: "phase-pr" | "single-issue";
  reviewMode?: "github-pr" | "local-agent";
  issues: IssuePayload[];
}): Promise<string> {
  const dir = join(params.repoRoot, ".sessions", "solo");
  await mkdir(dir, { recursive: true });
  const pmPromptFile = join(params.repoRoot, ".sessions", "pm", `next-phase-${params.phase}.md`);
  const hasPmPrompt = await fileExists(pmPromptFile);

  const kickoffFile = join(dir, `kickoff-${params.phase}-${params.slug}.md`);
  const issueLines =
    params.issues.length > 0
      ? params.issues.map((issue) => `- #${issue.number} ${issue.title} (${issue.url})`)
      : ["- No issue numbers linked yet."];

  const body = [
    `You are operating in SOLO sprint mode for ${params.phase}.`,
    "",
    `Branch: ${params.branch}`,
    "",
    "Read first:",
    "- Read each linked issue body and extract exact acceptance criteria.",
    ...(hasPmPrompt ? [`- Read PM planning context: ${pmPromptFile}`] : []),
    "",
    "Sprint scope issues:",
    ...issueLines,
    "",
    "Operating model:",
    "- Single branch, no extra worktree.",
    `- Delivery mode: ${params.deliveryMode === "single-issue" ? "single-issue PR context" : "phase-pr (one PR, multiple issues)"}.`,
    `- Review mode: ${params.reviewMode === "local-agent" ? "local-agent first (no PR on first finalize)" : "github-pr (standard PR flow)"}.`,
    "- Use skill guidance when available: `.claude/skills/agentic-solo-operator/SKILL.md`.",
    "- Sub-agent orchestration is allowed: delegate by issue or path group with non-overlapping file ownership.",
    "- If using sub-agents, assign one owner per issue/path and integrate sequentially on this branch.",
    "- Never assign the same file group to two sub-agents in the same execution round.",
    "- Keep commits atomic and behavior-first (Meaningful TDD).",
    "- Post checkpoints regularly for traceability.",
    "",
    "Status lifecycle:",
    "- Start/resume sprint -> In Progress",
    "- Finalize sprint PR ready -> Review",
    "- Merge complete -> Done",
    "",
    "Suggested loop:",
    "1) Restate current objective and acceptance criteria.",
    "2) Implement with tests.",
    "3) Run targeted checks.",
    "4) Checkpoint using: agentic solo checkpoint --summary ...",
    ...(params.reviewMode === "local-agent"
      ? [
          "5) Request local agent review using: agentic solo finalize --done ... (no commit/push/PR in local-agent mode)",
          "6) After local review and fixes, publish PR using: agentic solo finalize --publish --done ...",
        ]
      : ["5) Finalize using: agentic solo finalize --done ..."]),
    "",
  ].join("\n");

  await writeFile(kickoffFile, body, "utf8");
  return kickoffFile;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
