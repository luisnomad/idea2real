import type { AppConfig, CommandResult } from "../../types/contracts.js";
import { runScript } from "../../adapters/scripts.js";
import { askSelect } from "../../ui/clack/prompts.js";
import { ok } from "../command-utils.js";

export interface PmSeedIssueOptions {
  kind?: "p0" | "security" | "both";
}

export async function runPmSeedIssues(config: AppConfig, options: PmSeedIssueOptions): Promise<CommandResult> {
  const result = ok("agentic pm seed-issues", "Seed project issues for next slice wave");

  const kind = await resolveKind(config, options.kind);

  if (kind === "p0" || kind === "both") {
    const p0 = await runScript(config.scriptsDir, "createP0Issues");
    if (p0.exitCode !== 0) {
      throw new Error(p0.stderr || p0.stdout || "create-p0-issues failed");
    }
    result.nextSteps.push("Phase 0 issues seeded.");
  }

  if (kind === "security" || kind === "both") {
    const sec = await runScript(config.scriptsDir, "createSecurityIssues");
    if (sec.exitCode !== 0) {
      throw new Error(sec.stderr || sec.stdout || "create-security-issues failed");
    }
    result.nextSteps.push("Security issues seeded.");
  }

  result.nextSteps.push("Move issues into Project columns (Backlog/Ready) as needed.");
  return result;
}

async function resolveKind(
  config: AppConfig,
  explicit: PmSeedIssueOptions["kind"],
): Promise<"p0" | "security" | "both"> {
  if (explicit) {
    return explicit;
  }

  if (config.nonInteractive) {
    return "both";
  }

  const selected = await askSelect({
    message: "Choose issue seeding set",
    initialValue: "both",
    options: [
      { value: "both", label: "Phase 0 + Security" },
      { value: "p0", label: "Phase 0 only" },
      { value: "security", label: "Security only" },
    ],
  });

  if (selected === "p0" || selected === "security") {
    return selected;
  }
  return "both";
}
