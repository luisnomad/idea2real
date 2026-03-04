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
import { runSoloStart } from "../../core/commands/solo-start.js";
import { runSoloResume } from "../../core/commands/solo-resume.js";
import { runSoloAddIssues } from "../../core/commands/solo-add-issues.js";
import { runSoloCheckpoint } from "../../core/commands/solo-checkpoint.js";
import { runSoloFinalize } from "../../core/commands/solo-finalize.js";
import { runPmNextPhase } from "../../core/commands/pm-next-phase.js";
import { runContinue } from "../../core/commands/continue.js";

type MenuMode = "parallel" | "solo" | "ops";

type ActionValue =
  | "session:start"
  | "session:resume"
  | "slice:finalize"
  | "pr:loop"
  | "pr:merge"
  | "cleanup:worktree"
  | "pm:seed"
  | "pm:next"
  | "doctor"
  | "setup:bootstrap"
  | "ui:dashboard"
  | "solo:start"
  | "solo:continue"
  | "solo:resume"
  | "solo:add-issues"
  | "solo:checkpoint"
  | "solo:finalize";

const PARALLEL_ACTIONS: Array<{ value: ActionValue; label: string }> = [
  { value: "session:start", label: "Session / Start or resume guided session" },
  { value: "session:resume", label: "Session / Resume local worktree" },
  { value: "slice:finalize", label: "Slice / Finalize slice and move issue to Review" },
  { value: "pr:loop", label: "PR / Feedback loop (checks, reviews, conflicts)" },
  { value: "pr:merge", label: "PR / Merge and cleanup" },
  { value: "cleanup:worktree", label: "Cleanup / Worktree and branch cleanup" },
  { value: "pm:seed", label: "PM / Seed issues" },
  { value: "pm:next", label: "PM / Generate next-phase prompt" },
  { value: "doctor", label: "Diagnostics / Deep doctor checks" },
];

const SOLO_ACTIONS: Array<{ value: ActionValue; label: string }> = [
  { value: "solo:continue", label: "Solo / Continue sprint (resume or pick next slice)" },
  { value: "solo:start", label: "Solo / Start single-agent sprint (phase PR default)" },
  { value: "solo:resume", label: "Solo / Resume single-agent sprint" },
  { value: "solo:add-issues", label: "Solo / Add more issues to active sprint" },
  { value: "solo:checkpoint", label: "Solo / Checkpoint sprint progress" },
  { value: "solo:finalize", label: "Solo / Finalize sprint PR-ready" },
  { value: "pr:loop", label: "PR / Feedback loop (checks, reviews, conflicts)" },
  { value: "pr:merge", label: "PR / Merge and cleanup" },
  { value: "pm:next", label: "PM / Generate next-phase prompt" },
  { value: "doctor", label: "Diagnostics / Deep doctor checks" },
];

const OPS_ACTIONS: Array<{ value: ActionValue; label: string }> = [
  { value: "setup:bootstrap", label: "Setup / Bootstrap GitHub auth + project scope" },
  { value: "pm:seed", label: "PM / Seed issues" },
  { value: "pm:next", label: "PM / Generate next-phase prompt" },
  { value: "doctor", label: "Diagnostics / Deep doctor checks" },
  { value: "ui:dashboard", label: "UI / Dashboard preview (Phase 2 Ink)" },
];

export async function runInteractiveMenu(config: AppConfig): Promise<CommandResult> {
  showIntro("idea2real agentic control panel");

  const mode = await askSelect<MenuMode>({
    message: "Choose mode (Parallel / Solo / Operations)",
    options: [
      { value: "parallel", label: "Parallel / Multi-agent slices + worktrees" },
      { value: "solo", label: "Solo / Single-agent sprint on one branch" },
      { value: "ops", label: "Operations / Setup, PM and diagnostics" },
    ],
    initialValue: "parallel",
  });

  const optionsByMode: Record<MenuMode, Array<{ value: ActionValue; label: string }>> = {
    parallel: PARALLEL_ACTIONS,
    solo: SOLO_ACTIONS,
    ops: OPS_ACTIONS,
  };

  const action = await askSelect({
    message: "Choose action",
    options: optionsByMode[mode],
  });

  let result: CommandResult;
  switch (action) {
    case "session:start":
      result = await runSessionStart(config, {});
      break;
    case "solo:start":
      result = await runSoloStart(config, {});
      break;
    case "solo:continue":
      result = await runContinue(config, {});
      break;
    case "solo:resume":
      result = await runSoloResume(config, {});
      break;
    case "solo:add-issues":
      result = await runSoloAddIssues(config, {});
      break;
    case "solo:checkpoint":
      result = await runSoloCheckpoint(config, {});
      break;
    case "solo:finalize":
      result = await runSoloFinalize(config, {});
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
    case "pm:next":
      result = await runPmNextPhase(config, {});
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
