import { access } from "node:fs/promises";
import { constants } from "node:fs";
import type { AppConfig, CommandResult } from "../../types/contracts.js";
import { checkDocker } from "../../adapters/docker.js";
import { runCommand } from "../../adapters/exec.js";
import { runGh, runGhJson } from "../../adapters/gh.js";
import { discoverSliceCatalog } from "../discovery/slices.js";
import { ok } from "../command-utils.js";

const REQUIRED_SCRIPT_FILES = [
  "gh-bootstrap.sh",
  "start-agent-session.sh",
  "new-slice-worktree.sh",
  "finish-slice-session.sh",
  "cleanup-slice-worktree.sh",
  "create-p0-issues.sh",
  "create-security-issues.sh",
];

async function isExecutable(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export interface DoctorOptions {
  quick?: boolean;
}

export async function runDoctor(config: AppConfig, options: DoctorOptions = {}): Promise<CommandResult> {
  const result = ok(
    "agentic doctor",
    options.quick ? "Quick health checks for local workflow" : "Deep environment checks for local agentic workflow",
  );

  let failCount = 0;
  let warnCount = 0;

  for (const scriptFile of REQUIRED_SCRIPT_FILES) {
    const scriptPath = `${config.scriptsDir}/${scriptFile}`;
    if (!(await isExecutable(scriptPath))) {
      failCount += 1;
      result.errors.push({
        code: "SCRIPT_MISSING_OR_NOT_EXECUTABLE",
        message: `Missing executable script: ${scriptPath}`,
        retryable: false,
      });
    }
  }

  const docker = await checkDocker();
  if (!docker.installed) {
    failCount += 1;
    result.errors.push({
      code: "DOCKER_NOT_INSTALLED",
      message: "Docker CLI is not installed",
      retryable: false,
    });
  } else if (!docker.daemonUp) {
    failCount += 1;
    result.errors.push({
      code: "DOCKER_DAEMON_DOWN",
      message: "Docker daemon is not running",
      retryable: true,
    });
  }

  const ghCheck = await runCommand("bash", ["-lc", "command -v gh >/dev/null 2>&1"], { reject: false });
  if (ghCheck.exitCode !== 0) {
    failCount += 1;
    result.errors.push({
      code: "GH_NOT_INSTALLED",
      message: "gh CLI is not installed",
      retryable: false,
    });
  } else {
    const auth = await runCommand("gh", ["auth", "status"], { reject: false });
    if (auth.exitCode !== 0) {
      failCount += 1;
      result.errors.push({
        code: "GH_NOT_AUTHENTICATED",
        message: "gh is not authenticated",
        retryable: true,
      });
    }
  }

  const jqCheck = await runCommand("bash", ["-lc", "command -v jq >/dev/null 2>&1"], { reject: false });
  if (jqCheck.exitCode !== 0) {
    failCount += 1;
    result.errors.push({
      code: "JQ_NOT_INSTALLED",
      message: "jq is required for project status automation",
      retryable: false,
    });
  }

  if (ghCheck.exitCode === 0 && !options.quick) {
    try {
      await runGh(["repo", "view", config.repo, "--json", "nameWithOwner"]);
    } catch {
      failCount += 1;
      result.errors.push({
        code: "REPO_ACCESS_FAILED",
        message: `Cannot access repo ${config.repo}`,
        retryable: true,
      });
    }

    try {
      await runGh(["project", "view", String(config.project.number), "--owner", config.project.owner]);
    } catch {
      warnCount += 1;
      result.errors.push({
        code: "PROJECT_ACCESS_FAILED",
        message: `Cannot access project ${config.project.owner}#${config.project.number}`,
        retryable: true,
      });
    }

    try {
      const labels = await runGhJson<Array<{ name: string }>>([
        "label",
        "list",
        "--repo",
        config.repo,
        "--limit",
        "200",
        "--json",
        "name",
      ]);
      const requiredLabels = ["slice", "phase-0", "contracts", "api", "geometry", "frontend", "infra", "security"];
      const names = new Set(labels.map((label) => label.name));

      for (const label of requiredLabels) {
        if (!names.has(label)) {
          warnCount += 1;
          result.errors.push({
            code: "LABEL_MISSING",
            message: `Missing label: ${label}`,
            retryable: false,
          });
        }
      }
    } catch {
      warnCount += 1;
    }
  }

  const catalog = await discoverSliceCatalog(config.repoRoot, config.repo);
  if (catalog.length === 0) {
    warnCount += 1;
    result.errors.push({
      code: "NO_ACTIVE_SLICES",
      message: "No active slice worktrees discovered",
      retryable: false,
    });
  }

  const duplicate = findDuplicates(catalog.map((item) => item.sliceId));
  if (duplicate.length > 0) {
    failCount += 1;
    result.errors.push({
      code: "DUPLICATE_SLICES",
      message: `Duplicate slices discovered: ${duplicate.join(", ")}`,
      retryable: false,
    });
  }

  if (failCount > 0) {
    result.status = "error";
  } else if (warnCount > 0) {
    result.status = "warn";
  }

  result.summary = `Doctor result: ${result.status.toUpperCase()} (${failCount} fail, ${warnCount} warn)`;
  result.nextSteps.push("Run `agentic session start` to begin or resume slice work.");
  return result;
}

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    } else {
      seen.add(value);
    }
  }

  return [...duplicates];
}
