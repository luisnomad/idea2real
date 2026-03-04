export function toSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function toSliceId(input: string): string {
  return input.toUpperCase();
}

export function extractSliceFromBranch(branch: string): string {
  const match = /^codex\/([a-z0-9]+-[a-z0-9]+-[0-9]+)/.exec(branch);
  return match?.[1] ? toSliceId(match[1]) : "";
}

export function extractSliceFromTitle(title: string): string {
  const match = /(P[0-9]+-[A-Z0-9]+-[0-9]+)/.exec(title);
  return match?.[1] ?? "";
}

export function detectDomain(sliceId: string): string {
  const parts = sliceId.split("-");
  return parts[1]?.toLowerCase() ?? "unknown";
}

export function defaultTestCommandForSlice(sliceId: string): string {
  if (sliceId.includes("-WEB-")) return "pnpm --dir apps/web test";
  if (sliceId.includes("-API-")) return "pnpm --dir apps/api test";
  if (sliceId.includes("-GEOM-")) return "pytest -q";
  if (sliceId.includes("-CONTRACTS-")) return "pnpm --dir packages/contracts test";
  if (sliceId.includes("-UI-")) return "pnpm --dir packages/ui test";
  if (sliceId.includes("-INFRA-")) return "pnpm -r test";
  return "";
}
