import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AppConfig, CommandResult } from "../../types/contracts.js";
import { ok } from "../command-utils.js";
import { askText } from "../../ui/clack/prompts.js";
import { listOpenSliceIssuesByLabel } from "../github.js";
import { normalizePhase, phaseToLabel } from "../solo.js";
import { runGhJson } from "../../adapters/gh.js";

interface ProjectItemStatus {
  content?: { number?: number };
  status?: string;
}

export interface PmNextPhaseOptions {
  phase?: string;
}

export async function runPmNextPhase(config: AppConfig, options: PmNextPhaseOptions): Promise<CommandResult> {
  const result = ok("agentic pm next-phase", "Generate PM prompt and context for next sprint phase preparation");

  const phaseInput = options.phase ?? (!config.nonInteractive ? await askText({ message: "Target phase (e.g. P1)", defaultValue: "P1" }) : "P1");
  const phase = normalizePhase(phaseInput);
  const phaseLabel = phaseToLabel(phase);

  const issues = await listOpenSliceIssuesByLabel(config.repo, phaseLabel).catch(() => []);
  const projectItems = await runGhJson<{ items?: ProjectItemStatus[] }>([
    "project",
    "item-list",
    String(config.project.number),
    "--owner",
    config.project.owner,
    "--limit",
    "500",
    "--format",
    "json",
  ]).catch(() => ({ items: [] }));

  const statusCounts = new Map<string, number>();
  const issueNumbers = new Set(issues.map((issue) => issue.number));
  for (const item of projectItems.items ?? []) {
    const issueNumber = item.content?.number;
    if (!issueNumber || !issueNumbers.has(issueNumber)) continue;
    const status = item.status ?? "Unknown";
    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
  }

  const dir = join(config.repoRoot, ".sessions", "pm");
  await mkdir(dir, { recursive: true });
  const promptFile = join(dir, `next-phase-${phase}.md`);

  const statusLines = [...statusCounts.entries()].map(([status, count]) => `- ${status}: ${count}`);
  const issueLines = issues.slice(0, 20).map((issue) => `- #${issue.number} ${issue.title}`);

  const body = [
    `# PM Next-Phase Prompt (${phase})`,
    "",
    "You are the PM agent for idea2real.",
    "",
    "Goal:",
    `- Prepare and replenish slices for ${phase}.`,
    "- Keep at least 3 unassigned slices in Ready.",
    "",
    "Current context:",
    `- Phase label: ${phaseLabel}`,
    `- Open slice issues in phase: ${issues.length}`,
    ...(statusLines.length > 0 ? statusLines : ["- Status counts unavailable"]),
    "",
    "Open issues sample:",
    ...(issueLines.length > 0 ? issueLines : ["- No open issues currently found for this phase label."]),
    "",
    "Instructions:",
    "1) Review docs/project/DEVELOPMENT_PLAN.md for next unfinished outcomes.",
    "2) Propose missing slices by domain (frontend, api, geometry, contracts, infra, security).",
    "3) For each slice define: Depends On, Paths Touched, Given/When/Then, Test Plan, Definition of Done.",
    "4) Make slices parallel-safe for sub-agents: disjoint `Paths Touched`, explicit dependency edges, and no shared file ownership in the same round.",
    "5) Create/update issues via gh and place them into Backlog/Ready.",
    "6) Ensure at least 3 unassigned Ready slices after updates.",
    "7) Output: created issue URLs, duplicates skipped, final Ready count, recommended next 3 slices.",
    "",
  ].join("\n");

  await writeFile(promptFile, body, "utf8");

  result.artifacts.handoffFile = promptFile;
  result.nextSteps.push(`PM prompt generated: ${promptFile}`);
  result.nextSteps.push("Run this prompt in a dedicated PM agent session.");
  return result;
}
