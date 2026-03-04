import { runGhJson } from "../adapters/gh.js";

interface ProjectView {
  id: string;
}

interface FieldOption {
  id: string;
  name: string;
}

interface FieldDefinition {
  id: string;
  name: string;
  options?: FieldOption[];
}

interface ProjectItem {
  id: string;
  content?: {
    url?: string;
  };
}

export interface ProjectStatusContext {
  projectId: string;
  statusFieldId: string;
  optionByName: Map<string, string>;
}

export function optionIdForStatus(context: ProjectStatusContext, statusName: string): string {
  return context.optionByName.get(statusName) ?? "";
}

export async function loadProjectStatusContext(
  owner: string,
  projectNumber: number,
  statusFieldName: string,
): Promise<ProjectStatusContext> {
  const project = await runGhJson<ProjectView>([
    "project",
    "view",
    String(projectNumber),
    "--owner",
    owner,
    "--format",
    "json",
  ]);

  const fieldResponse = await runGhJson<FieldDefinition[] | { fields: FieldDefinition[] }>([
    "project",
    "field-list",
    String(projectNumber),
    "--owner",
    owner,
    "--format",
    "json",
  ]);

  const fields = Array.isArray(fieldResponse) ? fieldResponse : fieldResponse.fields ?? [];
  const statusField = fields.find((field) => field.name === statusFieldName);

  if (!statusField) {
    throw new Error(`Could not find status field '${statusFieldName}'`);
  }

  const optionByName = new Map<string, string>();
  for (const option of statusField.options ?? []) {
    optionByName.set(option.name, option.id);
  }

  return {
    projectId: project.id,
    statusFieldId: statusField.id,
    optionByName,
  };
}

async function resolveProjectItemId(owner: string, projectNumber: number, issueUrl: string): Promise<string> {
  const itemsResponse = await runGhJson<ProjectItem[] | { items: ProjectItem[] }>([
    "project",
    "item-list",
    String(projectNumber),
    "--owner",
    owner,
    "--limit",
    "500",
    "--format",
    "json",
  ]);

  const items = Array.isArray(itemsResponse) ? itemsResponse : itemsResponse.items ?? [];
  const existing = items.find((item) => item.content?.url === issueUrl);
  if (existing?.id) {
    return existing.id;
  }

  const added = await runGhJson<{ id?: string; item?: { id?: string } }>([
    "project",
    "item-add",
    String(projectNumber),
    "--owner",
    owner,
    "--url",
    issueUrl,
    "--format",
    "json",
  ]);

  const addedId = added.id ?? added.item?.id;
  if (!addedId) {
    throw new Error(`Failed to add issue to project: ${issueUrl}`);
  }

  return addedId;
}

export async function moveIssueToProjectStatus(params: {
  owner: string;
  projectNumber: number;
  statusFieldName: string;
  issueUrl: string;
  statusName: "Backlog" | "Ready" | "In Progress" | "Blocked" | "Review" | "Done";
}): Promise<void> {
  const context = await loadProjectStatusContext(params.owner, params.projectNumber, params.statusFieldName);
  const optionId = optionIdForStatus(context, params.statusName);

  if (!optionId) {
    throw new Error(`Project status option not found: ${params.statusName}`);
  }

  const itemId = await resolveProjectItemId(params.owner, params.projectNumber, params.issueUrl);

  await runGhJson([
    "project",
    "item-edit",
    "--id",
    itemId,
    "--project-id",
    context.projectId,
    "--field-id",
    context.statusFieldId,
    "--single-select-option-id",
    optionId,
    "--format",
    "json",
  ]);
}
