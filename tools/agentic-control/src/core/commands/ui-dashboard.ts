import type { AppConfig, CommandResult } from "../../types/contracts.js";
import { runGhJson } from "../../adapters/gh.js";
import { ok } from "../command-utils.js";

interface DashboardPr {
  number: number;
  title: string;
  state: string;
  headRefName: string;
}

interface DashboardIssue {
  number: number;
  title: string;
  url: string;
}

export async function runUiDashboard(config: AppConfig): Promise<CommandResult> {
  const result = ok("agentic ui dashboard", "Phase 2 dashboard preview (Ink target)");

  const [prs, issues] = await Promise.all([
    runGhJson<DashboardPr[]>([
      "pr",
      "list",
      "--repo",
      config.repo,
      "--state",
      "all",
      "--limit",
      "10",
      "--json",
      "number,title,state,headRefName",
    ]).catch(() => []),
    runGhJson<DashboardIssue[]>([
      "issue",
      "list",
      "--repo",
      config.repo,
      "--label",
      "slice",
      "--state",
      "open",
      "--limit",
      "10",
      "--json",
      "number,title,url",
    ]).catch(() => []),
  ]);

  const lines: string[] = [];
  lines.push("Open Slice Issues:");
  for (const issue of issues.slice(0, 5)) {
    lines.push(`- #${issue.number} ${issue.title}`);
  }
  lines.push("");
  lines.push("Recent PRs:");
  for (const pr of prs.slice(0, 5)) {
    lines.push(`- #${pr.number} [${pr.state}] ${pr.title}`);
  }

  result.summary = lines.join("\n");
  result.status = "warn";
  result.errors.push({
    code: "INK_PHASE_PENDING",
    message: "Ink live dashboard is not implemented yet; this is a preview command.",
    retryable: false,
  });
  result.nextSteps.push("Implement Ink live view in `src/ui/ink/**` as Phase 2.");
  return result;
}
