#!/usr/bin/env node
import { Command } from "commander";
import process from "node:process";
import { buildAppConfig, type GlobalOptions } from "./core/context.js";
import { runDoctor } from "./core/commands/doctor.js";
import { runSessionStart } from "./core/commands/session-start.js";
import { runSessionResume } from "./core/commands/session-resume.js";
import { runSliceFinalize } from "./core/commands/slice-finalize.js";
import { runPrLoop } from "./core/commands/pr-loop.js";
import { runPrMerge } from "./core/commands/pr-merge.js";
import { runCleanupWorktree } from "./core/commands/cleanup-worktree.js";
import { runPmSeedIssues } from "./core/commands/pm-seed-issues.js";
import { runSetupBootstrap } from "./core/commands/setup-bootstrap.js";
import { runUiDashboard } from "./core/commands/ui-dashboard.js";
import { runSoloStart } from "./core/commands/solo-start.js";
import { runSoloResume } from "./core/commands/solo-resume.js";
import { runSoloCheckpoint } from "./core/commands/solo-checkpoint.js";
import { runSoloFinalize } from "./core/commands/solo-finalize.js";
import { runSoloAddIssues } from "./core/commands/solo-add-issues.js";
import { runPmNextPhase } from "./core/commands/pm-next-phase.js";
import { runContinue } from "./core/commands/continue.js";
import { runInteractiveMenu } from "./ui/clack/menu.js";
import { emitResult, normalizeError } from "./utils/output.js";
import type { CommandResult } from "./types/contracts.js";

function addGlobalOptions(command: Command): Command {
  return command
    .option("--json", "Emit command result as JSON")
    .option("--non-interactive", "Disable prompts and pick defaults")
    .option("--repo <owner/name>", "Override GitHub repo")
    .option("--project-owner <owner>", "Override GitHub Project owner")
    .option("--project-number <number>", "Override GitHub Project number")
    .option("--status-field-name <name>", "Project status field name (default: Status)");
}

function addExecutionOptions(command: Command): Command {
  return command
    .option("--json", "Emit command result as JSON")
    .option("--non-interactive", "Disable prompts and pick defaults")
    .option("--repo <owner/name>", "Override GitHub repo")
    .option("--project-owner <owner>", "Override GitHub Project owner")
    .option("--project-number <number>", "Override GitHub Project number")
    .option("--status-field-name <name>", "Project status field name (default: Status)");
}

async function withConfig(options: GlobalOptions): Promise<ReturnType<typeof buildAppConfig>> {
  return buildAppConfig(options);
}

async function runAndEmit(
  options: GlobalOptions,
  action: (config: Awaited<ReturnType<typeof buildAppConfig>>) => Promise<CommandResult>,
): Promise<void> {
  const config = await withConfig(options);
  const result = await action(config);
  emitResult(result, config.json);

  if (result.status === "error") {
    process.exitCode = 1;
  }
}

export function buildProgram(): Command {
  const program = addGlobalOptions(new Command("agentic"));
  program.description("Node-based control panel for local parallel agentic development");
  program.enablePositionalOptions();
  program.showHelpAfterError();

  const withGlobals = (cmd: Command): GlobalOptions => {
    const possible = cmd as Command & {
      optsWithGlobals?: () => Record<string, unknown>;
      opts: () => Record<string, unknown>;
    };
    return (possible.optsWithGlobals ? possible.optsWithGlobals() : possible.opts()) as GlobalOptions;
  };

  const session = new Command("session").description("Session lifecycle operations");
  addExecutionOptions(session.command("start"))
    .description("Start or resume a slice session")
    .option("--slice <id>", "Slice ID")
    .option("--issue <number>", "Issue number")
    .option("--slug <slug>", "Topic slug")
    .option("--slot <number>", "Port slot", (value) => Number(value))
    .option("--enter", "Open shell in selected/created worktree")
    .action(async function action(this: Command) {
      await runAndEmit(withGlobals(this), (config) => runSessionStart(config, this.opts()));
    });

  addExecutionOptions(session.command("resume"))
    .description("Resume existing local session")
    .option("--slice <id>", "Slice ID to resume")
    .option("--enter", "Open shell in selected worktree")
    .action(async function action(this: Command) {
      await runAndEmit(withGlobals(this), (config) => runSessionResume(config, this.opts()));
    });

  const slice = new Command("slice").description("Slice operations");
  addExecutionOptions(slice.command("finalize"))
    .description("Finalize slice and move issue to Review")
    .option("--slice <id>", "Slice ID")
    .option("--done <text>", "Done summary")
    .option("--next <text>", "Next action")
    .option("--blockers <text>", "Blockers summary")
    .option("--assignee <user>", "PR assignee", "@me")
    .option("--test <cmd>", "Test command")
    .option("--skip-tests", "Skip tests")
    .option("--auto-commit", "Auto-commit dirty worktree before finishing")
    .option("--commit-message <text>", "Commit message when auto-committing")
    .action(async function action(this: Command) {
      await runAndEmit(withGlobals(this), (config) => runSliceFinalize(config, this.opts()));
    });

  const pr = new Command("pr").description("Pull request operations");
  addExecutionOptions(pr.command("loop"))
    .description("Review PR feedback/checks and guide next actions")
    .option("--pr <number|auto>", "PR number or auto", "auto")
    .option("--open-shell", "Open shell in PR feedback worktree")
    .action(async function action(this: Command) {
      await runAndEmit(withGlobals(this), (config) => runPrLoop(config, this.opts()));
    });

  addExecutionOptions(pr.command("merge"))
    .description("Merge PR and cleanup branch/worktree")
    .option("--pr <number|auto>", "PR number or auto", "auto")
    .option("--method <method>", "Merge method: squash|merge|rebase")
    .option("--delete-remote", "Delete remote branch after cleanup")
    .option("--no-cleanup", "Skip cleanup script")
    .action(async function action(this: Command) {
      await runAndEmit(withGlobals(this), (config) => runPrMerge(config, this.opts()));
    });

  const cleanup = new Command("cleanup").description("Cleanup operations");
  addExecutionOptions(cleanup.command("worktree"))
    .description("Cleanup merged slice worktree/branch")
    .option("--slice <id>", "Slice ID")
    .option("--branch <name>", "Branch name")
    .option("--delete-remote", "Delete remote branch")
    .option("--force", "Force cleanup")
    .action(async function action(this: Command) {
      await runAndEmit(withGlobals(this), (config) => runCleanupWorktree(config, this.opts()));
    });

  const pm = new Command("pm").description("PM operations");
  addExecutionOptions(pm.command("seed-issues"))
    .description("Seed P0/security issues")
    .option("--kind <kind>", "p0|security|both", "both")
    .action(async function action(this: Command) {
      await runAndEmit(withGlobals(this), (config) => runPmSeedIssues(config, this.opts()));
    });
  addExecutionOptions(pm.command("next-phase"))
    .description("Generate PM prompt/context for next phase planning with standardized slice format")
    .option("--phase <phase>", "Target phase (e.g. P1)")
    .option("--clean-old", "Remove old next-phase prompt files before generating")
    .action(async function action(this: Command) {
      await runAndEmit(withGlobals(this), (config) => runPmNextPhase(config, this.opts()));
    });

  addExecutionOptions(program.command("doctor"))
    .description("Deep health checks")
    .option("--quick", "Run quick checks only")
    .action(async function action(this: Command) {
      await runAndEmit(withGlobals(this), (config) => runDoctor(config, this.opts()));
    });

  addExecutionOptions(program.command("continue"))
    .description("Continue solo flow (resume active sprint or start next solo slice)")
    .option("--branch <name>", "Solo branch to resume")
    .action(async function action(this: Command) {
      await runAndEmit(withGlobals(this), (config) => runContinue(config, this.opts()));
    });

  const setup = new Command("setup").description("Setup and bootstrap operations");
  addExecutionOptions(setup.command("bootstrap-gh"))
    .description("Bootstrap gh auth, repo defaults, and project scope")
    .action(async function action(this: Command) {
      await runAndEmit(withGlobals(this), (config) => runSetupBootstrap(config));
    });

  program.addCommand(session);
  const solo = new Command("solo").description("Single-agent sprint operations (no worktree)");
  addExecutionOptions(solo.command("start"))
    .description("Start or initialize a solo sprint branch")
    .option("--phase <phase>", "Sprint phase (e.g. P1)")
    .option("--slug <slug>", "Sprint slug (e.g. api-core)")
    .option("--issues <list>", "Comma-separated issue numbers")
    .option("--branch <name>", "Override branch name")
    .option("--delivery-mode <mode>", "phase-pr|single-issue (default: phase-pr)")
    .action(async function action(this: Command) {
      await runAndEmit(withGlobals(this), (config) => runSoloStart(config, this.opts()));
    });
  addExecutionOptions(solo.command("resume"))
    .description("Resume active solo sprint")
    .option("--branch <name>", "Solo branch to resume")
    .action(async function action(this: Command) {
      await runAndEmit(withGlobals(this), (config) => runSoloResume(config, this.opts()));
    });
  addExecutionOptions(solo.command("add-issues"))
    .description("Add more issues to active solo sprint (phase PR)")
    .option("--issues <list>", "Comma-separated issue numbers")
    .option("--no-issue-comment", "Skip issue comments")
    .option("--no-update-pr", "Skip updating open PR body")
    .action(async function action(this: Command) {
      await runAndEmit(withGlobals(this), (config) => runSoloAddIssues(config, this.opts()));
    });
  addExecutionOptions(solo.command("checkpoint"))
    .description("Create solo sprint checkpoint and optional issue comments")
    .option("--summary <text>", "Checkpoint summary")
    .option("--next <text>", "Next action")
    .option("--blockers <text>", "Blockers summary")
    .option("--no-issue-comment", "Skip issue comments")
    .action(async function action(this: Command) {
      await runAndEmit(withGlobals(this), (config) => runSoloCheckpoint(config, this.opts()));
    });
  addExecutionOptions(solo.command("finalize"))
    .description("Finalize solo sprint into PR-ready state")
    .option("--done <text>", "Done summary")
    .option("--next <text>", "Next action")
    .option("--blockers <text>", "Blockers summary")
    .option("--test <cmd>", "Test command")
    .option("--skip-tests", "Skip tests")
    .option("--auto-commit", "Auto-commit dirty tree")
    .option("--commit-message <text>", "Commit message if auto-committing")
    .option("--pr-title <title>", "PR title override")
    .option("--assignee <user>", "PR assignee", "@me")
    .option("--no-issue-comment", "Skip issue comments")
    .action(async function action(this: Command) {
      await runAndEmit(withGlobals(this), (config) => runSoloFinalize(config, this.opts()));
    });
  program.addCommand(solo);
  program.addCommand(slice);
  program.addCommand(pr);
  program.addCommand(cleanup);
  program.addCommand(pm);
  program.addCommand(setup);

  const ui = new Command("ui").description("UI utilities");
  addExecutionOptions(ui.command("dashboard"))
    .description("Phase 2 dashboard preview (Ink target)")
    .action(async function action(this: Command) {
      await runAndEmit(withGlobals(this), (config) => runUiDashboard(config));
    });
  program.addCommand(ui);

  program.action(async () => {
    const config = await withConfig(program.opts());
    const result = await runInteractiveMenu(config);
    emitResult(result, config.json);
    if (result.status === "error") {
      process.exitCode = 1;
    }
  });

  return program;
}

async function main(): Promise<void> {
  const program = buildProgram();

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    const normalized = normalizeError(error);
    const result: CommandResult = {
      status: "error",
      action: "agentic",
      artifacts: {},
      nextSteps: ["Re-run with --json for machine-readable diagnostics."],
      errors: [
        {
          code: normalized.code,
          message: normalized.message,
          retryable: false,
          details: normalized.details,
        },
      ],
    };

    const asJson = process.argv.includes("--json");
    emitResult(result, asJson);
    process.exitCode = 1;
  }
}

if (import.meta.url === new URL(process.argv[1] ?? "", "file://").href) {
  void main();
}
