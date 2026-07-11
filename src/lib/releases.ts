export function selectReleasesToDelete(
  releases: readonly string[],
  current: string,
  keep: number,
): string[] {
  const newest = [...releases].sort((a, b) => b.localeCompare(a)).slice(0, Math.max(keep, 0));
  const protectedReleases = new Set([...newest, current]);
  return [...releases].filter((release) => !protectedReleases.has(release)).sort();
}
