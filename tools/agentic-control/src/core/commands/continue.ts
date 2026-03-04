import type { AppConfig, CommandResult } from "../../types/contracts.js";
import { ok } from "../command-utils.js";
import { readSoloState } from "../solo.js";
import { runSoloResume } from "./solo-resume.js";
import { runSoloStart } from "./solo-start.js";
import { discoverSliceCatalog, type SliceCatalogItem, type SliceIssue } from "../discovery/slices.js";
import { askConfirm, askSelect, note } from "../../ui/clack/prompts.js";
import { runGhJson } from "../../adapters/gh.js";
import { toSlug } from "../../utils/text.js";

export interface ContinueOptions {
  branch?: string;
}

export async function runContinue(config: AppConfig, options: ContinueOptions): Promise<CommandResult> {
  const result = ok("agentic continue", "Continue solo flow (resume active sprint or start next solo slice)");
  const executionConfig: AppConfig = config.json ? { ...config, nonInteractive: true } : config;

  const soloState = await readSoloState(executionConfig.repoRoot);
  if (soloState || options.branch) {
    const solo = await runSoloResume(executionConfig, { branch: options.branch ?? soloState?.branch });
    solo.action = "agentic continue";
    solo.summary = `Resumed solo mode on ${solo.artifacts.branch ?? "solo branch"}`;
    return solo;
  }

  const catalog = await discoverSliceCatalog(executionConfig.repoRoot, executionConfig.repo);
  const statusByIssue = await loadProjectStatusMap(executionConfig).catch(() => new Map<number, string>());
  const candidates = pickSoloCandidates(catalog, statusByIssue);

  if (candidates.length === 0) {
    throw new Error(
      "No active solo sprint and no available slice issues to start in solo mode. Use `agentic solo start` for manual sprint creation or `agentic session start` for parallel mode.",
    );
  }

  const selected = await chooseCandidate(candidates, executionConfig.nonInteractive);
  const phase = derivePhase(selected.sliceId);
  const slug = deriveSoloSlug(selected);
  const issueNumbers = await decideIssueBundle(candidates, selected, phase, executionConfig.nonInteractive);
  note(
    `No active solo sprint found. Starting ${phase} sprint from issue #${selected.issue.number}${issueNumbers.length > 1 ? ` (${issueNumbers.length} linked issues)` : ""}.`,
  );

  const started = await runSoloStart(executionConfig, {
    phase,
    slug,
    deliveryMode: "phase-pr",
    issues: issueNumbers.join(","),
  });
  started.action = "agentic continue";
  started.summary = `Started solo phase-pr mode on ${started.artifacts.branch ?? "solo branch"} (${issueNumbers.length} issue${issueNumbers.length === 1 ? "" : "s"})`;
  return started;
}

interface ProjectItemStatus {
  content?: { number?: number };
  status?: string;
}

interface ContinueCandidate {
  sliceId: string;
  issue: SliceIssue;
  domain: string;
  status: string;
}

async function loadProjectStatusMap(config: AppConfig): Promise<Map<number, string>> {
  const payload = await runGhJson<{ items?: ProjectItemStatus[] }>([
    "project",
    "item-list",
    String(config.project.number),
    "--owner",
    config.project.owner,
    "--limit",
    "500",
    "--format",
    "json",
  ]);

  const statusByIssue = new Map<number, string>();
  for (const item of payload.items ?? []) {
    const issueNumber = item.content?.number;
    if (!issueNumber) continue;
    statusByIssue.set(issueNumber, item.status ?? "Unknown");
  }
  return statusByIssue;
}

function pickSoloCandidates(catalog: SliceCatalogItem[], statusByIssue: Map<number, string>): ContinueCandidate[] {
  const candidates = catalog
    .filter((item) => item.issue && !item.localWorktree && item.pr?.state !== "OPEN")
    .map((item) => ({
      sliceId: item.sliceId,
      issue: item.issue as SliceIssue,
      domain: item.domain,
      status: statusByIssue.get(item.issue!.number) ?? "Unknown",
    }))
    .sort((a, b) => {
      const scoreDiff = statusPriority(a.status) - statusPriority(b.status);
      if (scoreDiff !== 0) return scoreDiff;
      return a.sliceId.localeCompare(b.sliceId);
    });

  return candidates;
}

function statusPriority(status: string): number {
  const normalized = status.trim().toLowerCase();
  if (normalized === "ready") return 0;
  if (normalized === "backlog") return 1;
  if (normalized === "in progress") return 2;
  if (normalized === "blocked") return 3;
  if (normalized === "review") return 4;
  if (normalized === "done") return 5;
  return 6;
}

async function chooseCandidate(
  candidates: ContinueCandidate[],
  nonInteractive: boolean,
): Promise<ContinueCandidate> {
  const first = candidates.at(0);
  if (!first) throw new Error("No solo candidates available.");

  if (nonInteractive) {
    return first;
  }

  const choice = await askSelect({
    message: "No active solo sprint. Pick the next slice to start in solo mode",
    options: candidates.map((candidate) => ({
      value: candidate.sliceId,
      label: `[${candidate.status}][${candidate.domain}] ${candidate.sliceId} (#${candidate.issue.number})`,
      hint: candidate.issue.title,
    })),
  });

  const selected = candidates.find((candidate) => candidate.sliceId === choice);
  return selected ?? first;
}

function derivePhase(sliceId: string): string {
  return /^P[0-9]+/.exec(sliceId)?.[0] ?? "P1";
}

function deriveSoloSlug(candidate: ContinueCandidate): string {
  const withoutPrefix = candidate.issue.title.replace(/^P[0-9]+-[A-Z0-9]+-[0-9]+:\s*/, "");
  const readable = toSlug(withoutPrefix);
  if (readable) {
    return `${candidate.sliceId.toLowerCase()}-${readable}`;
  }
  return candidate.sliceId.toLowerCase();
}

async function decideIssueBundle(
  candidates: ContinueCandidate[],
  selected: ContinueCandidate,
  phase: string,
  nonInteractive: boolean,
): Promise<number[]> {
  const siblings = candidates
    .filter(
      (candidate) =>
        candidate.issue.number !== selected.issue.number &&
        derivePhase(candidate.sliceId) === phase &&
        isReadyBacklog(candidate.status),
    )
    .sort((a, b) => {
      const scoreDiff = statusPriority(a.status) - statusPriority(b.status);
      if (scoreDiff !== 0) return scoreDiff;
      return a.sliceId.localeCompare(b.sliceId);
    });

  if (siblings.length === 0) {
    return [selected.issue.number];
  }

  const includeSiblings =
    nonInteractive ||
    (await askConfirm({
      message: `Link ${siblings.length} additional ${phase} issue(s) in Ready/Backlog to this solo phase PR?`,
      initialValue: true,
    }));

  if (!includeSiblings) {
    return [selected.issue.number];
  }

  return [selected.issue.number, ...siblings.map((candidate) => candidate.issue.number)];
}

function isReadyBacklog(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  return normalized === "ready" || normalized === "backlog";
}
