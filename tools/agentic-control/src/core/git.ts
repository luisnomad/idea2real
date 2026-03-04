import { join } from "node:path";
import { runCommand } from "../adapters/exec.js";

export async function hasDirtyWorktree(path: string): Promise<boolean> {
  const status = await runCommand("git", ["-C", path, "status", "--porcelain"], { reject: false });
  return status.exitCode === 0 && status.stdout.trim().length > 0;
}

export async function branchExists(repoRoot: string, branch: string): Promise<boolean> {
  const result = await runCommand("git", ["-C", repoRoot, "show-ref", "--verify", `refs/heads/${branch}`], {
    reject: false,
  });
  return result.exitCode === 0;
}

export async function fetchBranch(repoRoot: string, branch: string): Promise<void> {
  await runCommand("git", ["-C", repoRoot, "fetch", "origin", `${branch}:${branch}`], {
    reject: false,
  });
}

export async function addWorktree(repoRoot: string, path: string, branch: string): Promise<void> {
  const result = await runCommand("git", ["-C", repoRoot, "worktree", "add", path, branch], {
    reject: false,
  });

  if (result.exitCode !== 0) {
    throw new Error(result.stderr || result.stdout || "Failed to add git worktree");
  }
}

export async function commitAll(path: string, message: string): Promise<void> {
  const add = await runCommand("git", ["-C", path, "add", "-A"], { reject: false });
  if (add.exitCode !== 0) {
    throw new Error(add.stderr || add.stdout || "Failed to stage changes");
  }

  const commit = await runCommand("git", ["-C", path, "commit", "-m", message], { reject: false });
  if (commit.exitCode !== 0) {
    throw new Error(commit.stderr || commit.stdout || "Failed to commit changes");
  }
}

export function buildPrWorktreePath(repoRoot: string, repoName: string, prNumber: number, branch: string): string {
  const slug = branch.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
  return join(repoRoot, "..", `${repoName}-pr-${prNumber}-${slug}`);
}

export async function currentBranch(repoRoot: string): Promise<string> {
  const result = await runCommand("git", ["-C", repoRoot, "rev-parse", "--abbrev-ref", "HEAD"], { reject: false });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || result.stdout || "Failed to resolve current branch");
  }
  return result.stdout.trim();
}

export async function checkoutBranch(repoRoot: string, branch: string): Promise<void> {
  const result = await runCommand("git", ["-C", repoRoot, "checkout", branch], { reject: false });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || result.stdout || `Failed to checkout branch ${branch}`);
  }
}

export async function createBranchFromBase(repoRoot: string, branch: string, baseRef: string): Promise<void> {
  const result = await runCommand("git", ["-C", repoRoot, "checkout", "-b", branch, baseRef], { reject: false });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || result.stdout || `Failed to create branch ${branch} from ${baseRef}`);
  }
}

export async function fetchRef(repoRoot: string, remote: string, ref: string): Promise<void> {
  await runCommand("git", ["-C", repoRoot, "fetch", remote, ref], { reject: false });
}
