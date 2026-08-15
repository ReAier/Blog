import {
  ACCENTS,
  BACKGROUND_PRESETS,
  DEFAULT_ACCENT,
  DEFAULT_BACKGROUND,
  isAccent,
  isBackground,
  resolveTheme,
  type AccentName,
  type BackgroundName,
  type ResolvedTheme,
} from '../../../../src/lib/preferences';

export const themeStorageKey = 'aier-theme';
export const accentStorageKey = 'aier-accent-v2';
export const backgroundStorageKey = 'aier-background-v1';

export const accents = ACCENTS;
export const backgrounds = BACKGROUND_PRESETS;

export type ThemeChoice = 'system' | 'light' | 'dark';
export type { AccentName, BackgroundName, ResolvedTheme };
export { resolveTheme };

export function normalizeThemeChoice(value: unknown): ThemeChoice {
  return value === 'light' || value === 'dark' || value === 'system'
    ? value
    : 'system';
}

export function normalizeAccent(value: unknown): AccentName {
  return isAccent(value) ? value : DEFAULT_ACCENT;
}

export function normalizeBackground(value: unknown): BackgroundName {
  return isBackground(value) ? value : DEFAULT_BACKGROUND;
}

function readPreference(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writePreference(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Appearance preferences are optional in privacy modes.
  }
}

export function applyAppearance(
  themeChoice: ThemeChoice,
  accent: AccentName,
  background: BackgroundName,
): void {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const root = document.documentElement;
  root.dataset.themeChoice = themeChoice;
  root.dataset.theme = resolveTheme(themeChoice, prefersDark);
  root.dataset.accent = accent;
  root.dataset.background = background;
}

function currentAppearance() {
  return {
    theme: normalizeThemeChoice(readPreference(themeStorageKey)),
    accent: normalizeAccent(readPreference(accentStorageKey)),
    background: normalizeBackground(readPreference(backgroundStorageKey)),
  };
}

export function initializeAppearance(): () => void {
  const appearance = currentAppearance();
  applyAppearance(appearance.theme, appearance.accent, appearance.background);

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const updateSystemTheme = () => {
    const current = currentAppearance();
    if (current.theme === 'system') {
      applyAppearance(current.theme, current.accent, current.background);
    }
  };
  media.addEventListener('change', updateSystemTheme);
  return () => media.removeEventListener('change', updateSystemTheme);
}

export function saveAppearance(
  themeChoice: ThemeChoice,
  accent: AccentName,
  background: BackgroundName,
): void {
  writePreference(themeStorageKey, themeChoice);
  writePreference(accentStorageKey, accent);
  writePreference(backgroundStorageKey, background);
  applyAppearance(themeChoice, accent, background);
}
