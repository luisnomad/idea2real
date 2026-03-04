import { runCommand } from "../../adapters/exec.js";
import { runGhJson } from "../../adapters/gh.js";
import { detectDomain, extractSliceFromBranch, extractSliceFromTitle } from "../../utils/text.js";

export interface LocalWorktree {
  branch: string;
  path: string;
  sliceId: string;
}

export interface SliceIssue {
  number: number;
  title: string;
  url: string;
  sliceId: string;
  domain: string;
}

export interface PullRequestRef {
  number: number;
  title: string;
  url: string;
  headRefName: string;
  state: string;
}

export interface SliceCatalogItem {
  sliceId: string;
  domain: string;
  localWorktree?: LocalWorktree;
  issue?: SliceIssue;
  pr?: PullRequestRef;
}

interface RawIssue {
  number: number;
  title: string;
  url: string;
}

interface RawPr {
  number: number;
  title: string;
  url: string;
  headRefName: string;
  state: string;
}

export async function listLocalSliceWorktrees(repoRoot: string): Promise<LocalWorktree[]> {
  const result = await runCommand("git", ["-C", repoRoot, "worktree", "list", "--porcelain"], {
    reject: false,
  });

  if (result.exitCode !== 0) {
    return [];
  }

  const lines = `${result.stdout}\n`.split("\n");
  const localWorktrees: LocalWorktree[] = [];

  let currentPath = "";
  let currentBranch = "";

  for (const line of lines) {
    if (line.startsWith("worktree ")) {
      currentPath = line.replace("worktree ", "").trim();
      continue;
    }

    if (line.startsWith("branch refs/heads/")) {
      currentBranch = line.replace("branch refs/heads/", "").trim();
      continue;
    }

    if (line.trim() === "") {
      if (currentBranch.startsWith("codex/")) {
        const sliceId = extractSliceFromBranch(currentBranch);
        if (sliceId) {
          localWorktrees.push({
            branch: currentBranch,
            path: currentPath,
            sliceId,
          });
        }
      }

      currentPath = "";
      currentBranch = "";
    }
  }

  return localWorktrees;
}

export async function listOpenSliceIssues(repo: string): Promise<SliceIssue[]> {
  const issues = await runGhJson<RawIssue[]>([
    "issue",
    "list",
    "--repo",
    repo,
    "--label",
    "slice",
    "--state",
    "open",
    "--limit",
    "200",
    "--json",
    "number,title,url",
  ]);

  return issues
    .map((issue) => {
      const sliceId = extractSliceFromTitle(issue.title);
      if (!sliceId) {
        return null;
      }

      return {
        ...issue,
        sliceId,
        domain: detectDomain(sliceId),
      };
    })
    .filter((value): value is SliceIssue => Boolean(value));
}

export async function listPullRequests(repo: string): Promise<PullRequestRef[]> {
  return runGhJson<RawPr[]>([
    "pr",
    "list",
    "--repo",
    repo,
    "--state",
    "all",
    "--limit",
    "200",
    "--json",
    "number,title,url,headRefName,state",
  ]);
}

export function dedupeSliceCatalog(
  worktrees: LocalWorktree[],
  issues: SliceIssue[],
  prs: PullRequestRef[],
): SliceCatalogItem[] {
  const catalog = new Map<string, SliceCatalogItem>();

  for (const wt of worktrees) {
    catalog.set(wt.sliceId, {
      sliceId: wt.sliceId,
      domain: detectDomain(wt.sliceId),
      localWorktree: wt,
      issue: undefined,
      pr: prs.find((pr) => pr.headRefName === wt.branch),
    });
  }

  for (const issue of issues) {
    const existing = catalog.get(issue.sliceId);
    if (existing) {
      existing.issue = issue;
      if (!existing.pr && existing.localWorktree) {
        existing.pr = prs.find((pr) => pr.headRefName === existing.localWorktree?.branch);
      }
      catalog.set(issue.sliceId, existing);
      continue;
    }

    const matchingPr = prs.find((pr) => extractSliceFromBranch(pr.headRefName) === issue.sliceId);
    catalog.set(issue.sliceId, {
      sliceId: issue.sliceId,
      domain: issue.domain,
      issue,
      pr: matchingPr,
    });
  }

  return [...catalog.values()].sort((a, b) => a.sliceId.localeCompare(b.sliceId));
}

export async function discoverSliceCatalog(repoRoot: string, repo: string): Promise<SliceCatalogItem[]> {
  const [worktrees, issues, prs] = await Promise.all([
    listLocalSliceWorktrees(repoRoot),
    listOpenSliceIssues(repo).catch(() => []),
    listPullRequests(repo).catch(() => []),
  ]);

  return dedupeSliceCatalog(worktrees, issues, prs);
}
