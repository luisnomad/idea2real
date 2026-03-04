import { basename, resolve } from "node:path";
import { runCommand } from "../adapters/exec.js";
import type { AppConfig } from "../types/contracts.js";

export interface GlobalOptions {
  json?: boolean;
  nonInteractive?: boolean;
  repo?: string;
  projectOwner?: string;
  projectNumber?: string;
  statusFieldName?: string;
}

export async function detectRepoRoot(cwd: string): Promise<string> {
  const result = await runCommand("git", ["rev-parse", "--show-toplevel"], {
    cwd,
    reject: false,
  });

  if (result.exitCode !== 0) {
    return resolve(cwd);
  }

  return result.stdout.trim();
}

async function detectRepoFromRemote(repoRoot: string): Promise<string | null> {
  const result = await runCommand("git", ["-C", repoRoot, "remote", "get-url", "origin"], {
    reject: false,
  });
  if (result.exitCode !== 0) {
    return null;
  }

  const remote = result.stdout.trim();
  const normalized = remote
    .replace(/^git@github.com:/, "")
    .replace(/^https:\/\/github.com\//, "")
    .replace(/\.git$/, "");

  return normalized.includes("/") ? normalized : null;
}

export async function buildAppConfig(options: GlobalOptions, cwd = process.cwd()): Promise<AppConfig> {
  const repoRoot = await detectRepoRoot(cwd);
  const repoFromRemote = await detectRepoFromRemote(repoRoot);

  const repo = options.repo ?? process.env.GITHUB_REPO ?? repoFromRemote ?? "luisnomad/idea2real";
  const defaultOwner = repo.split("/")[0] ?? "luisnomad";

  return {
    repoRoot,
    repo,
    scriptsDir: resolve(repoRoot, "scripts"),
    project: {
      owner: options.projectOwner ?? process.env.PROJECT_OWNER ?? defaultOwner,
      number: Number(options.projectNumber ?? process.env.PROJECT_NUMBER ?? 1),
      statusFieldName: options.statusFieldName ?? process.env.STATUS_FIELD_NAME ?? "Status",
    },
    json: Boolean(options.json),
    nonInteractive: Boolean(options.nonInteractive),
  };
}

export function repoShortName(repoRoot: string): string {
  return basename(repoRoot);
}
