# Light Theme Contrast Repair Design

**Date:** 2026-08-11
**Status:** Approved

## Goal

Restore readable syntax highlighting in light mode and make every content-card watermark perceptible without making decorative marks dominate the card content.

## Syntax Highlighting

Use Shiki multi-theme output everywhere Markdown code is rendered:

- light theme: `github-light`
- dark theme: `github-dark`
- `defaultColor: false` so Shiki emits `--shiki-light` and `--shiki-dark` token variables

A shared configuration module supplies the same settings to Astro article Markdown and the standalone clip highlighter. Global CSS selects the light variables by default and the dark variables under `data-theme="dark"`. Existing translucent code surfaces, borders, blur, copy controls, and fallback backgrounds remain unchanged.

## Card Watermarks

The three decorative watermark families share a theme token:

- clip cards: `</>`
- reference cards: `↗`
- problem cards: problem code such as `P1171`

Light mode uses opacity `.15`; dark mode uses `.09`. At the mobile breakpoint, light mode uses `.13` and dark mode `.075`. Clip and reference marks use the current accent color at token-controlled opacity, while problem marks retain their difficulty color.

## Testing

Regression tests verify the shared Shiki configuration, both article and clip consumers, light/dark CSS variable selection, all three watermark selectors, mobile values, generated dual-theme token variables, and production build success.
