export const ACCENTS = [
  { name: 'coral', label: '橙红', color: '#F05A3C' },
  { name: 'teal', label: '青绿', color: '#16A085' },
  { name: 'indigo', label: '靛蓝', color: '#4F6BED' },
  { name: 'amber', label: '琥珀', color: '#D89016' },
  { name: 'rose', label: '玫红', color: '#C74776' },
] as const;

export type AccentName = (typeof ACCENTS)[number]['name'];
export type ResolvedTheme = 'light' | 'dark';

export function isAccent(value: unknown): value is AccentName {
  return typeof value === 'string' && ACCENTS.some((accent) => accent.name === value);
}

export function resolveTheme(saved: unknown, prefersDark: boolean): ResolvedTheme {
  if (saved === 'light' || saved === 'dark') return saved;
  return prefersDark ? 'dark' : 'light';
}
