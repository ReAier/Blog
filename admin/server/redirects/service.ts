export interface RedirectCompileOptions {
  redirects: Record<string, string>;
  existingPaths: Set<string>;
}

function validateUrlPath(value: string): string {
  if (!value.startsWith('/') || /[\r\n{};$]/.test(value) || value.includes('..')) throw new Error(`Invalid redirect path: ${value}`);
  return value;
}

export function compileRedirects(options: RedirectCompileOptions): string {
  const entries = Object.entries(options.redirects).sort(([left], [right]) => left.localeCompare(right));
  const redirectSources = new Set(entries.map(([source]) => validateUrlPath(source)));
  for (const [sourceValue, targetValue] of entries) {
    const source = validateUrlPath(sourceValue);
    const target = validateUrlPath(targetValue);
    if (source === target) throw new Error(`Redirect loop detected at ${source}.`);
    const visited = new Set([source]);
    let cursor = target;
    while (redirectSources.has(cursor)) {
      if (visited.has(cursor)) throw new Error(`Redirect loop detected at ${cursor}.`);
      visited.add(cursor);
      cursor = options.redirects[cursor]!;
    }
    if (!options.existingPaths.has(cursor)) throw new Error(`Redirect target does not exist: ${cursor}`);
  }
  return `${entries.map(([source, target]) => `location = ${source} { return 308 ${target}; }`).join('\n')}\n`;
}
