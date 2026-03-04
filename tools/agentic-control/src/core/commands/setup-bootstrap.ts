import type { AppConfig, CommandResult } from "../../types/contracts.js";
import { runScript } from "../../adapters/scripts.js";
import { ok } from "../command-utils.js";

export async function runSetupBootstrap(config: AppConfig): Promise<CommandResult> {
  const result = ok("agentic setup bootstrap-gh", "Bootstrap gh auth, repo defaults, and project scope");

  const run = await runScript(config.scriptsDir, "ghBootstrap");
  if (run.exitCode !== 0) {
    throw new Error(run.stderr || run.stdout || "gh-bootstrap failed");
  }

  result.nextSteps.push("Run `agentic doctor` to validate environment.");
  result.nextSteps.push("Run `agentic pm seed-issues` if project has no slice issues yet.");
  return result;
}
