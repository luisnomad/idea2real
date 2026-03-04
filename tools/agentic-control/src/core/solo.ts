import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { toSlug } from "../utils/text.js";

export interface SoloState {
  mode: "solo";
  deliveryMode: "phase-pr" | "single-issue";
  phase: string;
  slug: string;
  branch: string;
  issueNumbers: number[];
  kickoffFile: string;
  startedAt: string;
  updatedAt: string;
  status: "active" | "review";
}

export function soloDir(repoRoot: string): string {
  return join(repoRoot, ".sessions", "solo");
}

export function soloStatePath(repoRoot: string): string {
  return join(soloDir(repoRoot), "state.json");
}

export function soloCheckpointDir(repoRoot: string): string {
  return join(soloDir(repoRoot), "checkpoints");
}

export function sprintBranchName(phase: string, slug: string): string {
  return `codex/solo-${toSlug(phase)}-${toSlug(slug)}`;
}

export async function readSoloState(repoRoot: string): Promise<SoloState | null> {
  try {
    const body = await readFile(soloStatePath(repoRoot), "utf8");
    const parsed = JSON.parse(body) as Partial<SoloState> & { mode?: string };
    if (!parsed || parsed.mode !== "solo") {
      return null;
    }
    return {
      mode: "solo",
      deliveryMode: parsed.deliveryMode === "single-issue" ? "single-issue" : "phase-pr",
      phase: parsed.phase ?? "P1",
      slug: parsed.slug ?? "solo-sprint",
      branch: parsed.branch ?? sprintBranchName(parsed.phase ?? "P1", parsed.slug ?? "solo-sprint"),
      issueNumbers: Array.isArray(parsed.issueNumbers) ? parsed.issueNumbers : [],
      kickoffFile: parsed.kickoffFile ?? "",
      startedAt: parsed.startedAt ?? nowIso(),
      updatedAt: parsed.updatedAt ?? nowIso(),
      status: parsed.status === "review" ? "review" : "active",
    };
  } catch {
    return null;
  }
}

export async function writeSoloState(repoRoot: string, state: SoloState): Promise<void> {
  const path = soloStatePath(repoRoot);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export async function clearSoloState(repoRoot: string): Promise<void> {
  await rm(soloStatePath(repoRoot), { force: true });
}

export function normalizePhase(input: string): string {
  const trimmed = input.trim().toUpperCase();
  if (/^P[0-9]+$/.test(trimmed)) {
    return trimmed;
  }
  if (/^[0-9]+$/.test(trimmed)) {
    return `P${trimmed}`;
  }
  return trimmed;
}

export function phaseToLabel(phase: string): string {
  const normalized = normalizePhase(phase);
  const n = normalized.replace(/^P/, "");
  return `phase-${n}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
