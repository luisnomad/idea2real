import { execa } from "execa";

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ExecOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  inherit?: boolean;
  reject?: boolean;
}

export async function runCommand(
  command: string,
  args: string[],
  options: ExecOptions = {},
): Promise<ExecResult> {
  const { cwd, env, inherit = false, reject = false } = options;
  const execaOptions: Record<string, unknown> = {
    reject,
    stdio: inherit ? "inherit" : "pipe",
    shell: false,
  };
  if (cwd) {
    execaOptions.cwd = cwd;
  }
  if (env) {
    execaOptions.env = env;
  }

  const subprocess = await (execa as unknown as (
    file: string,
    args: string[],
    options: Record<string, unknown>,
  ) => Promise<{ stdout?: string; stderr?: string; exitCode?: number }>)(command, args, execaOptions);

  return {
    stdout: subprocess.stdout ?? "",
    stderr: subprocess.stderr ?? "",
    exitCode: subprocess.exitCode ?? 0,
  };
}

export async function runBash(command: string, cwd?: string): Promise<ExecResult> {
  const options: ExecOptions = { reject: false };
  if (cwd) {
    options.cwd = cwd;
  }
  return runCommand("bash", ["-lc", command], options);
}
