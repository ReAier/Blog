# Admin Blog-Visual Redesign Design

**Date:** 2026-08-14

## Goal

Make the private administration interface feel like the public Aier Blog while fixing editor-route navigation and making every control, label, table, form, editor, and preview comfortably readable.

## Visual direction

The public blog is the source of truth: fixed plum-blossom background photography, a deep neutral overlay, near-black translucent glass surfaces, rose-pink accents, high-contrast ivory text, restrained borders, serif display headings, sans-serif controls, and monospace technical metadata. The admin must no longer use large pale translucent panels over the photograph because those panels create low-contrast white-on-white combinations.

## Application shell

Replace the permanent desktop sidebar with a centered, sticky/fixed glass navigation bar that mirrors the public site header. It contains the Aier wordmark, all six admin destinations, appearance controls, account identity, and sign-out. The active route uses the same rose underline/tinted state as the public blog. On narrow screens the destinations collapse behind an explicit menu button and a contained dropdown; no full-screen invisible scrim may remain mounted after route changes.

This structure also removes the editor page from the sidebar's hit-testing plane. The header gets an explicit top-level stacking context and the content/iframes remain below it. Navigation links remain real React Router links and are covered by an editor-route navigation regression test.

## Content surfaces

All dashboard and resource pages share one vocabulary:

- transparent page regions over the dark background;
- near-black glass cards at roughly 82-92% opacity;
- bright ivory primary text and at least medium-gray secondary text;
- rose accents only for active states, key actions, and small editorial labels;
- rounded corners matching the public navigation, article table of contents, and clip cards;
- generous spacing and consistent 44px minimum interactive targets.

Tables, stat cards, backup panels, logs, and empty states use the same surface tokens instead of page-specific pale paper colors.

## Editors

Article editing keeps metadata, Markdown source, and preview capabilities, but each pane becomes a dark, bounded glass workspace. Form fields use opaque-enough dark fills, visible labels, and bright typed text. CodeMirror receives an explicit dark theme with readable gutters, selection, caret, active line, and syntax colors.

The preview remains an iframe for CSS isolation, but it is confined below the global header and cannot overlap or intercept navigation. At narrower desktop widths the preview stacks below the metadata/source panes; on mobile all panes stack.

Clip editing follows the same metadata/source treatment.

## Accessibility and behavior

- Primary text, labels, placeholders, borders, and disabled states must remain distinguishable on the image background.
- Focus rings are high-contrast and never clipped.
- Navigation is keyboard accessible and route changes close the mobile menu.
- Motion is modest and disabled under `prefers-reduced-motion`.
- Existing API behavior, autosave, history, dialogs, image/clip pickers, backups, and publishing behavior are preserved.

## Verification

Add source-level contracts for the shared shell, stacking rules, high-contrast tokens, form controls, and CodeMirror theme. Then run the focused admin tests, full Vitest suite, admin TypeScript check, admin production build, Astro check/build, and browser interaction checks that navigate away from an open article using every global destination and visually inspect representative pages at desktop and mobile widths.
