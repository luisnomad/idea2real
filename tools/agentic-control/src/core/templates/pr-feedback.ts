export interface PrFeedbackCommentInput {
  title: string;
  prUrl: string;
  branch: string;
  mergeable: string;
  mergeState: string;
  failingChecks: number;
  pendingChecks: number;
  changesRequested: number;
  unresolvedThreads: number;
  fixedNow: string;
  leftAsIs: string;
  rationale: string;
  nextActions: string;
}

export function buildPrFeedbackComment(input: PrFeedbackCommentInput): string {
  return [
    `### ${input.title}`,
    "",
    `PR: ${input.prUrl}`,
    `Branch: \`${input.branch}\``,
    `Mergeability: \`${input.mergeable}\` / \`${input.mergeState}\``,
    `Checks: fail=${input.failingChecks}, pending=${input.pendingChecks}`,
    `Feedback: changes_requested=${input.changesRequested}, unresolved_threads=${input.unresolvedThreads}`,
    "",
    "#### Fixed now",
    input.fixedNow,
    "",
    "#### Left as-is",
    input.leftAsIs,
    "",
    "#### Why left as-is",
    input.rationale,
    "",
    "#### Next actions",
    input.nextActions,
  ].join("\n");
}
