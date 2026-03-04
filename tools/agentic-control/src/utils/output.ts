import process from "node:process";
import type { CommandResult } from "../types/contracts.js";

export function normalizeError(error: unknown): { code: string; message: string; details?: string } {
  if (error instanceof Error) {
    const details = "stack" in error && typeof error.stack === "string" ? error.stack : undefined;
    return {
      code: "UNEXPECTED_ERROR",
      message: error.message,
      details,
    };
  }

  return {
    code: "UNEXPECTED_ERROR",
    message: typeof error === "string" ? error : "Unknown error",
  };
}

export function emitResult(result: CommandResult, asJson: boolean): void {
  if (asJson) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  process.stdout.write(`\n== ${result.action} ==\n`);
  process.stdout.write(`status: ${result.status}\n`);

  if (result.summary) {
    process.stdout.write(`${result.summary}\n`);
  }

  if (Object.keys(result.artifacts).length > 0) {
    process.stdout.write("artifacts:\n");
    for (const [key, value] of Object.entries(result.artifacts)) {
      if (value !== undefined) {
        process.stdout.write(`  - ${key}: ${value}\n`);
      }
    }
  }

  if (result.errors.length > 0) {
    process.stdout.write("errors:\n");
    for (const error of result.errors) {
      process.stdout.write(`  - [${error.code}] ${error.message} (retryable=${error.retryable})\n`);
    }
  }

  if (result.nextSteps.length > 0) {
    process.stdout.write("next:\n");
    for (const step of result.nextSteps) {
      process.stdout.write(`  - ${step}\n`);
    }
  }
}
