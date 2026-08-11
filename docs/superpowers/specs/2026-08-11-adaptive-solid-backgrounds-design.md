# Adaptive Eye-Friendly Solid Backgrounds Design

**Date:** 2026-08-11
**Status:** Approved for planning

## Goal

Add several low-saturation solid-color backgrounds to the blog's existing appearance preferences without removing or changing the current image backgrounds. Each solid preset should automatically use an appropriate light or dark value for the resolved site theme.

## User Experience

The existing **外观设置 → 背景** grid remains the single background selector. The three current image thumbnails appear first, followed by five solid-color swatches:

| Preset | Light theme | Dark theme | Intent |
| --- | --- | --- | --- |
| 暖米 | `#EEE8DC` | `#24211C` | Warm, paper-like neutral |
| 雾灰 | `#E4E6E5` | `#202322` | Calm neutral gray |
| 鼠尾草 | `#DDE5D8` | `#1E261F` | Low-saturation green |
| 晨雾蓝 | `#DCE5E9` | `#1D2428` | Low-saturation blue-gray |
| 藕粉 | `#E8DDE0` | `#282024` | Muted warm pink |

The swatches expose descriptive Chinese `aria-label` values and use the same pressed-state and keyboard behavior as existing image choices. The selected preset continues to persist in `localStorage` under `aier-background-v1`.

## Data Model

Extend `BACKGROUND_PRESETS` so a preset explicitly declares its kind:

- Image presets contain `kind: 'image'` and `src`.
- Solid presets contain `kind: 'solid'`, `lightColor`, and `darkColor`.

`BackgroundName`, `isBackground`, the default value, and saved-value validation continue to derive from this shared preset list. Existing names and the `default` preset remain unchanged, preserving stored preferences.

## Rendering and Styling

The document continues to store only the selected preset name in `data-background`. CSS maps each preset to `--page-background` and `--backdrop-overlay`:

- Image presets retain their current URL backgrounds and overlays.
- Solid presets set `--page-background` to the theme-specific color and use a transparent or very restrained overlay so the chosen color remains visible.
- Dark-theme selectors provide the dark counterpart for every solid preset.

The preference buttons receive preset-specific CSS custom properties from Astro. Image buttons render their existing thumbnails; solid buttons render a flat swatch using the color corresponding to the currently resolved theme. No new image assets are required.

## Compatibility and Accessibility

- Previously stored image-background choices remain valid.
- Invalid or removed values still fall back to `DEFAULT_BACKGROUND`.
- Theme changes update solid backgrounds and their swatches through CSS, without rewriting the saved background preference.
- Existing focus, pressed-state, reduced-motion, and keyboard behavior are retained.
- The chosen values are intentionally muted, while foreground and surface colors remain controlled by the existing theme tokens to preserve readable contrast.

## Testing

Update or add Vitest coverage for:

- recognition of all new solid preset names;
- rejection of invalid background names;
- preservation of the existing default and image presets;
- rendered preference controls containing solid preset labels and metadata;
- production CSS/output containing light and dark mappings for every solid preset.

Run `npm run check`, `npm test -- --run`, and `npm run build` after implementation.

## Scope

This change does not add custom color inputs, reorder or remove image backgrounds, change the default background, alter accent colors, or migrate the local-storage key.
