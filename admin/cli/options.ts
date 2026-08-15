export function readCliOption(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : undefined;
  return value?.trim() || undefined;
}

export function hasCliFlag(args: readonly string[], name: string): boolean {
  return args.includes(name);
}

export function configuredCliPassword(
  args: readonly string[],
  environment: NodeJS.ProcessEnv,
): string | undefined {
  return readCliOption(args, '--password')
    ?? environment.ADMIN_BOOTSTRAP_PASSWORD?.trim()
    ?? undefined;
}
