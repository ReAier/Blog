export const ACCENTS = [
  { name: 'coral', label: '橙红', color: '#F05A3C' },
  { name: 'teal', label: '青绿', color: '#16A085' },
  { name: 'indigo', label: '靛蓝', color: '#4F6BED' },
  { name: 'amber', label: '琥珀', color: '#D89016' },
  { name: 'rose', label: '玫红', color: '#C74776' },
] as const;

export const BACKGROUND_PRESETS = [
  { name: 'default', label: '背景一', src: '/site-background.webp' },
  { name: 'background-2', label: '背景二', src: '/site-background-2.webp' },
  { name: 'background-3', label: '背景三', src: '/site-background-3.webp' },
] as const;

export type AccentName = (typeof ACCENTS)[number]['name'];
export type BackgroundName = (typeof BACKGROUND_PRESETS)[number]['name'];
export const DEFAULT_ACCENT: AccentName = 'rose';
export const DEFAULT_BACKGROUND: BackgroundName = 'default';
export type ResolvedTheme = 'light' | 'dark';

export function isAccent(value: unknown): value is AccentName {
  return typeof value === 'string' && ACCENTS.some((accent) => accent.name === value);
}

export function isBackground(value: unknown): value is BackgroundName {
  return typeof value === 'string' && BACKGROUND_PRESETS.some((background) => background.name === value);
}

export function resolveTheme(saved: unknown, prefersDark: boolean): ResolvedTheme {
  if (saved === 'light' || saved === 'dark') return saved;
  return prefersDark ? 'dark' : 'light';
}
