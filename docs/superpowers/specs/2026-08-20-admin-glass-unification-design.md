# Admin Glass Surface Unification Design

**Date:** 2026-08-20

## Goal

Unify the visual language of the blog administration UI by reusing the existing header glass material for panel-like surfaces, with priority on the post editor and clip editor, while fixing live Markdown preview theme synchronization.

## Source of truth

The existing administrative header glass treatment is the sole material source. Existing `.glass` behavior and its current glass design tokens must be reused. No second blur, saturation, border, shadow, or background formula will be introduced for editor panels.

## Scope

- Post editor: header/actions, frontmatter, writing area, Markdown preview, related-content areas, and panel-like overlays.
- Clip editor: metadata, writing area, and panel-like overlays.
- Other administration pages: identify visibly inconsistent structural panels and route them through the same reusable glass surface where doing so does not change control semantics.
- Inputs, buttons, selects, textareas, badges, and table rows remain controls/content elements rather than becoming nested glass panels.

## Theme behavior

The Markdown preview document remains sandboxed, but its root appearance attributes (`data-theme`, `data-accent`, and `data-background`) must track the admin document whenever appearance changes. The iframe document and its page background must be transparent so the preview panel's reused glass material is visible instead of a separate opaque article background.

## Testing

Add source-contract and behavior tests that ensure both editors reuse the shared glass class/material, preview markup is transparent, appearance values are sanitized, and an already-rendered preview updates after an admin appearance change. Run targeted tests first, followed by the complete Vitest suite, Astro/TypeScript checks, and production build.

## Constraints

- Preserve existing uncommitted work and do not revert unrelated files.
- Do not edit generated output.
- Do not introduce a new glass material implementation.
- Preserve accessibility labels, responsive layout, and current editor behavior.
