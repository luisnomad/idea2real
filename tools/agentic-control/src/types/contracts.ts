export type CommandStatus = "ok" | "warn" | "error";

export interface CommandError {
  code: string;
  message: string;
  retryable: boolean;
  details?: string;
}

export interface CommandArtifacts {
  issue?: number;
  pr?: number;
  branch?: string;
  worktree?: string;
  handoffFile?: string;
}

export interface CommandResult {
  status: CommandStatus;
  action: string;
  artifacts: CommandArtifacts;
  nextSteps: string[];
  errors: CommandError[];
  summary?: string;
}

export interface ProjectConfig {
  owner: string;
  number: number;
  statusFieldName: string;
}

export interface AppConfig {
  repoRoot: string;
  repo: string;
  scriptsDir: string;
  project: ProjectConfig;
  json: boolean;
  nonInteractive: boolean;
}
