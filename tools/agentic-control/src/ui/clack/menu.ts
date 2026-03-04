import type { AppConfig, CommandResult } from "../../types/contracts.js";
import { askSelect, showIntro, showOutro } from "./prompts.js";
import { runDoctor } from "../../core/commands/doctor.js";
import { runPmSeedIssues } from "../../core/commands/pm-seed-issues.js";
import { runSessionStart } from "../../core/commands/session-start.js";
import { runSessionResume } from "../../core/commands/session-resume.js";
import { runSliceFinalize } from "../../core/commands/slice-finalize.js";
import { runPrLoop } from "../../core/commands/pr-loop.js";
import { runPrMerge } from "../../core/commands/pr-merge.js";
import { runCleanupWorktree } from "../../core/commands/cleanup-worktree.js";
import { runSetupBootstrap } from "../../core/commands/setup-bootstrap.js";
import { runUiDashboard } from "../../core/commands/ui-dashboard.js";

export async function runInteractiveMenu(config: AppConfig): Promise<CommandResult> {
  showIntro("idea2real agentic control panel");

  const action = await askSelect({
    message: "Choose action",
    options: [
      { value: "session:start", label: "Session / Start or resume guided session" },
      { value: "setup:bootstrap", label: "Setup / Bootstrap GitHub auth + project scope" },
      { value: "session:resume", label: "Session / Resume local worktree" },
      { value: "slice:finalize", label: "Slice / Finalize slice and move issue to Review" },
      { value: "pr:loop", label: "PR / Feedback loop (checks, reviews, conflicts)" },
      { value: "pr:merge", label: "PR / Merge and cleanup" },
      { value: "cleanup:worktree", label: "Cleanup / Worktree and branch cleanup" },
      { value: "pm:seed", label: "PM / Seed issues" },
      { value: "doctor", label: "Diagnostics / Deep doctor checks" },
      { value: "ui:dashboard", label: "UI / Dashboard preview (Phase 2 Ink)" },
    ],
  });

  let result: CommandResult;
  switch (action) {
    case "session:start":
      result = await runSessionStart(config, {});
      break;
    case "setup:bootstrap":
      result = await runSetupBootstrap(config);
      break;
    case "session:resume":
      result = await runSessionResume(config, {});
      break;
    case "slice:finalize":
      result = await runSliceFinalize(config, {});
      break;
    case "pr:loop":
      result = await runPrLoop(config, {});
      break;
    case "pr:merge":
      result = await runPrMerge(config, {});
      break;
    case "cleanup:worktree":
      result = await runCleanupWorktree(config, {});
      break;
    case "pm:seed":
      result = await runPmSeedIssues(config, {});
      break;
    case "doctor":
      result = await runDoctor(config, {});
      break;
    case "ui:dashboard":
      result = await runUiDashboard(config);
      break;
    default:
      throw new Error(`Unknown action: ${action}`);
  }

  showOutro(`${result.action} completed (${result.status})`);
  return result;
}
