import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { runCommand } from "./exec.js";

const SCRIPT_FILE = {
  ghBootstrap: "gh-bootstrap.sh",
  startAgentSession: "start-agent-session.sh",
  newSliceWorktree: "new-slice-worktree.sh",
  finishSliceSession: "finish-slice-session.sh",
  cleanupSliceWorktree: "cleanup-slice-worktree.sh",
  createP0Issues: "create-p0-issues.sh",
  createSecurityIssues: "create-security-issues.sh",
} as const;

export type ScriptName = keyof typeof SCRIPT_FILE;

export function resolveScriptPath(scriptsDir: string, scriptName: ScriptName): string {
  return join(scriptsDir, SCRIPT_FILE[scriptName]);
}

export async function assertExecutable(path: string): Promise<void> {
  await access(path, constants.X_OK);
}

export async function runScript(
  scriptsDir: string,
  scriptName: ScriptName,
  args: string[] = [],
  cwd?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const scriptPath = resolveScriptPath(scriptsDir, scriptName);
  await assertExecutable(scriptPath);
  return runCommand(scriptPath, args, cwd ? { cwd, reject: false } : { reject: false });
}
