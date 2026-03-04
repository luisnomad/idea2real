import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { AppConfig, CommandResult } from "../../types/contracts.js";
import { ok } from "../command-utils.js";
import { askConfirm, askText } from "../../ui/clack/prompts.js";
import { listOpenSliceIssuesByLabel } from "../github.js";
import { normalizePhase, phaseToLabel } from "../solo.js";
import { runGhJson } from "../../adapters/gh.js";

interface ProjectItemStatus {
  content?: { number?: number };
  status?: string;
}

export interface PmNextPhaseOptions {
  phase?: string;
  cleanOld?: boolean;
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
  const cleanOld =
    options.cleanOld ??
    (!config.nonInteractive
      ? await askConfirm({
          message: "Clean old next-phase prompt files before generating this one?",
          initialValue: false,
        })
      : false);

  let cleanedCount = 0;
  if (cleanOld) {
    cleanedCount = await cleanupOldPhasePrompts(dir, basename(promptFile));
  }

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
    "5) Enforce phase dependency chaining: when seeding a later phase, set each slice `Depends on` to required earlier-phase slices (never leave cross-phase dependencies implicit).",
    "6) Create/update issues via gh and place them into Backlog/Ready.",
    "7) Ensure at least 3 unassigned Ready slices after updates.",
    "8) Output: created issue URLs, duplicates skipped, final Ready count, recommended next 3 slices.",
    "",
    "Required issue format (use exactly this structure in every issue body):",
    "```text",
    "Slice ID: P{phase}-{domain}-{n}",
    "Owner: <agent or person>",
    "Depends on: <slice IDs or None>",
    "Touches: <explicit paths>",
    "Behavior contract:",
    "Given <starting state>",
    "When <user action or system event>",
    "Then <user-visible outcome>",
    "And <boundary/negative expectation>",
    "Test plan: <exact test files/commands>",
    "Definition of done: <concrete user-visible result>",
    "```",
    "",
    "Issue title format:",
    "- `P{phase}-{domain}-{n}: <short outcome>`",
    "",
    "Dependency policy:",
    "- If a slice relies on previous phase output, list explicit slice IDs in `Depends on`.",
    "- For multi-phase preparation, chain `P{n+1}` slices to `P{n}` slices where required.",
    "- Use `Depends on: None` only when the slice is truly independent.",
    "",
    "Labels to apply:",
    "- `slice`",
    `- \`${phaseLabel}\``,
    "",
    "Suggested GH CLI flow (repeat per slice):",
    "```bash",
    "gh issue create \\",
    "  --repo <owner/repo> \\",
    "  --title \"P{phase}-{domain}-{n}: <short outcome>\" \\",
    "  --body-file <tmp-body.md> \\",
    "  --label slice \\",
    `  --label ${phaseLabel}`,
    "```",
    "",
    "After issue creation, place cards in Project columns:",
    "- Ready if immediately executable",
    "- Backlog if blocked by dependencies",
    "",
  ].join("\n");

  await writeFile(promptFile, body, "utf8");

  result.artifacts.handoffFile = promptFile;
  if (cleanOld) {
    result.nextSteps.push(`Cleaned ${cleanedCount} old next-phase prompt file(s).`);
  }
  result.nextSteps.push(`PM prompt generated: ${promptFile}`);
  result.nextSteps.push("Run this prompt in a dedicated PM agent session.");
  return result;
}

async function cleanupOldPhasePrompts(dir: string, keepFilename: string): Promise<number> {
  const entries = await readdir(dir, { withFileTypes: true });
  let cleaned = 0;

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const name = entry.name;
    if (!/^next-phase-.*\.md$/i.test(name)) continue;
    if (name === keepFilename) continue;

    await rm(join(dir, name), { force: true });
    cleaned += 1;
  }

  return cleaned;
}
