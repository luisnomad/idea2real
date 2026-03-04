import { runGhJson } from "../adapters/gh.js";
import { extractSliceFromBranch } from "../utils/text.js";

interface IssuePayload {
  number: number;
  title: string;
  url: string;
}

interface PrPayload {
  number: number;
  title: string;
  url: string;
  headRefName: string;
  state: string;
  reviewDecision?: string;
  mergeStateStatus?: string;
  mergeable?: string;
  isDraft?: boolean;
  baseRefName?: string;
}

export async function resolveIssueBySlice(repo: string, sliceId: string): Promise<IssuePayload | null> {
  const issues = await runGhJson<IssuePayload[]>([
    "issue",
    "list",
    "--repo",
    repo,
    "--label",
    "slice",
    "--state",
    "all",
    "--search",
    `\"${sliceId}:\" in:title`,
    "--limit",
    "1",
    "--json",
    "number,title,url",
  ]);

  return issues[0] ?? null;
}

export async function findPrByBranch(repo: string, branch: string, state: "open" | "merged" | "all" = "all"): Promise<PrPayload | null> {
  const prs = await runGhJson<PrPayload[]>([
    "pr",
    "list",
    "--repo",
    repo,
    "--head",
    branch,
    "--state",
    state,
    "--limit",
    "1",
    "--json",
    "number,title,url,headRefName,state,reviewDecision,mergeStateStatus,mergeable,isDraft,baseRefName",
  ]);

  return prs[0] ?? null;
}

export async function listOpenPrs(repo: string): Promise<PrPayload[]> {
  return runGhJson<PrPayload[]>([
    "pr",
    "list",
    "--repo",
    repo,
    "--state",
    "open",
    "--limit",
    "50",
    "--json",
    "number,title,url,headRefName,state,reviewDecision,mergeStateStatus,mergeable,isDraft,baseRefName",
  ]);
}

export async function listOpenAndMergedPrs(repo: string): Promise<PrPayload[]> {
  return runGhJson<PrPayload[]>([
    "pr",
    "list",
    "--repo",
    repo,
    "--state",
    "all",
    "--limit",
    "100",
    "--json",
    "number,title,url,headRefName,state,reviewDecision,mergeStateStatus,mergeable,isDraft,baseRefName",
  ]);
}

export function inferSliceFromPr(pr: Pick<PrPayload, "headRefName" | "title">): string {
  return extractSliceFromBranch(pr.headRefName);
}

export type PullRequestInfo = PrPayload;
