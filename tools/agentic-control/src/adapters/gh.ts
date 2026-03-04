import { runCommand } from "./exec.js";

const TRANSIENT_REGEX = /(502|503|504|bad gateway|temporar|timed out|timeout|connection reset|tls handshake|eof)/i;

export interface GhOptions {
  cwd?: string;
  retries?: number;
  retrySleepMs?: number;
}

export interface GhResult {
  stdout: string;
  stderr: string;
}

export interface GhRunnerResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export type GhRunner = (args: string[], options: GhOptions) => Promise<GhRunnerResult>;

export function isTransientGhError(payload: string): boolean {
  return TRANSIENT_REGEX.test(payload);
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runGh(args: string[], options: GhOptions = {}): Promise<GhResult> {
  return runGhWithRunner(args, options, async (runnerArgs, runnerOptions) =>
    runCommand("gh", runnerArgs, {
      cwd: runnerOptions.cwd,
      reject: false,
    }),
  );
}

export async function runGhWithRunner(
  args: string[],
  options: GhOptions = {},
  runner: GhRunner,
): Promise<GhResult> {
  const retries = options.retries ?? Number(process.env.GH_RETRY_COUNT ?? 4);
  const retrySleepMs = options.retrySleepMs ?? Number(process.env.GH_RETRY_SLEEP_MS ?? 2000);

  let lastError = "";

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const result = await runner(args, options);

    if (result.exitCode === 0) {
      return { stdout: result.stdout, stderr: result.stderr };
    }

    const combined = `${result.stdout}\n${result.stderr}`.trim();
    lastError = combined;

    if (attempt < retries && isTransientGhError(combined)) {
      process.stderr.write(
        `Transient GitHub API error (attempt ${attempt}/${retries}). Retrying in ${Math.round(retrySleepMs / 1000)}s...\n`,
      );
      await wait(retrySleepMs);
      continue;
    }

    throw new Error(combined || "gh command failed");
  }

  throw new Error(lastError || "gh command failed");
}

export async function runGhJson<T>(args: string[], options: GhOptions = {}): Promise<T> {
  const result = await runGh(args, options);
  const trimmed = result.stdout.trim();
  if (!trimmed) {
    throw new Error("Expected JSON output from gh command, got empty output");
  }

  return JSON.parse(trimmed) as T;
}
