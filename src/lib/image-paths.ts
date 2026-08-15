function managedPath(value: string): string {
  const normalized = value.replaceAll('\\', '/').replace(/^\.\//, '');
  const parts = normalized.split('/');
  if (!normalized || normalized.startsWith('/') || parts.some((part) => !part || part === '.' || part === '..')) {
    throw new Error(`Unsafe managed image path: ${value}`);
  }
  return parts.join('/');
}

export function contentImagePublicPath(relativePath: string): string {
  return `/media/${managedPath(relativePath)}`;
}

export function resolveCoverUrl(cover?: string): string | undefined {
  if (!cover) return undefined;
  if (/^https?:\/\//i.test(cover) || cover.startsWith('/')) return cover;
  const normalized = cover.replaceAll('\\', '/');
  const marker = normalized.startsWith('../images/')
    ? normalized.slice('../images/'.length)
    : normalized.startsWith('images/')
      ? normalized.slice('images/'.length)
      : undefined;
  return marker === undefined ? cover : contentImagePublicPath(marker);
}
