import {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  outro,
  select,
  text,
} from "@clack/prompts";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

export function showIntro(message: string): void {
  intro(message);
}

export function showOutro(message: string): void {
  outro(message);
}

export function info(message: string): void {
  log.info(message);
}

export function warn(message: string): void {
  log.warn(message);
}

export function note(message: string): void {
  log.message(message);
}

export async function askSelect<T extends string>(params: {
  message: string;
  options: Array<SelectOption<T>>;
  initialValue?: T;
}): Promise<T> {
  const result = await select<T>({
    message: params.message,
    options: params.options as Parameters<typeof select<T>>[0]["options"],
    initialValue: params.initialValue,
  });

  if (isCancel(result)) {
    cancel("Operation canceled");
    process.exit(1);
  }

  return result;
}

export async function askConfirm(params: { message: string; initialValue?: boolean }): Promise<boolean> {
  const result = await confirm({
    message: params.message,
    initialValue: params.initialValue,
  });

  if (isCancel(result)) {
    cancel("Operation canceled");
    process.exit(1);
  }

  return result;
}

export async function askText(params: {
  message: string;
  placeholder?: string;
  defaultValue?: string;
  validate?: (value: string) => string | undefined;
}): Promise<string> {
  const result = await text({
    message: params.message,
    placeholder: params.placeholder,
    defaultValue: params.defaultValue,
    validate: params.validate,
  });

  if (isCancel(result)) {
    cancel("Operation canceled");
    process.exit(1);
  }

  return result.trim();
}
