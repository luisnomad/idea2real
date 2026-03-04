import type { CommandResult } from "../types/contracts.js";
import { normalizeError } from "../utils/output.js";

export function ok(action: string, summary?: string): CommandResult {
  return {
    status: "ok",
    action,
    artifacts: {},
    nextSteps: [],
    errors: [],
    summary,
  };
}

export function warnResult(action: string, summary?: string): CommandResult {
  return {
    status: "warn",
    action,
    artifacts: {},
    nextSteps: [],
    errors: [],
    summary,
  };
}

export function failResult(action: string, error: unknown): CommandResult {
  const normalized = normalizeError(error);
  return {
    status: "error",
    action,
    artifacts: {},
    nextSteps: [],
    errors: [
      {
        code: normalized.code,
        message: normalized.message,
        retryable: false,
        details: normalized.details,
      },
    ],
  };
}
