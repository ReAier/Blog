export const ACCENTS = [
  { name: 'coral', label: '橙红', color: '#F05A3C' },
  { name: 'teal', label: '青绿', color: '#16A085' },
  { name: 'indigo', label: '靛蓝', color: '#4F6BED' },
  { name: 'amber', label: '琥珀', color: '#D89016' },
  { name: 'rose', label: '玫红', color: '#C74776' },
] as const;

export const BACKGROUND_PRESETS = [
  { name: 'default', label: '背景一', kind: 'image', src: '/site-background.webp' },
  { name: 'background-2', label: '背景二', kind: 'image', src: '/site-background-2.webp' },
  { name: 'background-3', label: '背景三', kind: 'image', src: '/site-background-3.webp' },
  { name: 'warm-rice', label: '暖米', kind: 'solid', lightColor: '#EEE8DC', darkColor: '#24211C' },
  { name: 'mist-gray', label: '雾灰', kind: 'solid', lightColor: '#E4E6E5', darkColor: '#202322' },
  { name: 'sage', label: '鼠尾草', kind: 'solid', lightColor: '#DDE5D8', darkColor: '#1E261F' },
  { name: 'morning-blue', label: '晨雾蓝', kind: 'solid', lightColor: '#DCE5E9', darkColor: '#1D2428' },
  { name: 'lotus-pink', label: '藕粉', kind: 'solid', lightColor: '#E8DDE0', darkColor: '#282024' },
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
