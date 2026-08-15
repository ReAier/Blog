import { useEffect, useRef, useState } from 'react';
import {
  accentStorageKey,
  accents,
  backgroundStorageKey,
  backgrounds,
  normalizeAccent,
  normalizeBackground,
  normalizeThemeChoice,
  saveAppearance,
  themeStorageKey,
  type AccentName,
  type BackgroundName,
  type ThemeChoice,
} from '../lib/preferences';

function savedValue(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function AppearanceControls() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeChoice>(() => (
    normalizeThemeChoice(savedValue(themeStorageKey))
  ));
  const [accent, setAccent] = useState<AccentName>(() => (
    normalizeAccent(savedValue(accentStorageKey))
  ));
  const [background, setBackground] = useState<BackgroundName>(() => (
    normalizeBackground(savedValue(backgroundStorageKey))
  ));
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    saveAppearance(theme, accent, background);
  }, [theme, accent, background]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    window.addEventListener('keydown', closeWithEscape);
    return () => {
      document.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', closeWithEscape);
    };
  }, [open]);

  return (
    <div className="appearance-controls" ref={container}>
      <button
        className="appearance-trigger"
        type="button"
        aria-label="打开外观设置"
        aria-expanded={open}
        aria-controls="admin-appearance-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">◐</span>
      </button>
      {open && (
        <section id="admin-appearance-panel" className="appearance-panel" aria-label="外观设置">
          <h2>外观设置</h2>
          <span className="appearance-label">主题</span>
          <div className="appearance-choice-row" role="group" aria-label="主题模式">
            {([
              ['system', '跟随系统'],
              ['light', '浅色'],
              ['dark', '深色'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                className="appearance-choice"
                type="button"
                aria-pressed={theme === value}
                onClick={() => setTheme(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="appearance-label">强调色</span>
          <div className="appearance-swatch-row" role="group" aria-label="强调色">
            {accents.map((item) => (
              <button
                key={item.name}
                className="appearance-swatch"
                type="button"
                aria-label={item.label}
                aria-pressed={accent === item.name}
                style={{ '--swatch': item.color } as React.CSSProperties}
                onClick={() => setAccent(item.name)}
              />
            ))}
          </div>
          <span className="appearance-label">背景</span>
          <div className="appearance-background-row" role="group" aria-label="背景样式">
            {backgrounds.map((item) => (
              <button
                key={item.name}
                className={`appearance-background is-${item.kind}`}
                type="button"
                aria-label={item.label}
                aria-pressed={background === item.name}
                style={{
                  '--background-swatch': item.kind === 'image'
                    ? `url('${item.src}')`
                    : `linear-gradient(${item.lightColor}, ${item.lightColor})`,
                  '--background-swatch-dark': item.kind === 'solid'
                    ? `linear-gradient(${item.darkColor}, ${item.darkColor})`
                    : undefined,
                } as React.CSSProperties}
                onClick={() => setBackground(item.name)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
