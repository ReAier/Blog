# Admin Modal Frosted Glass Design

**Date:** 2026-08-20

## Goal

Unify every centered modal built on `admin/client/src/components/Dialog.tsx` with the blog administration interface's existing editorial frosted-glass language. The result should feel lighter, layered, and coordinated with the shared admin glass surfaces while retaining dependable contrast in both light and dark themes.

## Scope

Included modal surfaces:

- Site-owned confirmation and alert dialogs.
- Post metadata dialogs such as tag management and cover selection.
- Post editor resource pickers and history comparison dialog.
- Image upload dialog.
- Clip import dialog.
- Any future centered modal that uses the shared `Dialog` component and `.picker-dialog` shell.

Explicitly excluded:

- Appearance settings panel and other non-modal popovers.
- Select menus, calendars, tooltips, and inline cards.
- Business logic, form structure, focus behavior, and dialog dismissal rules.

## Visual direction

Use an editorial frosted-glass treatment rather than a highly transparent or smoke-black panel:

- The scrim softly darkens, blurs, and slightly saturates the page behind the dialog without becoming an opaque black curtain.
- The dialog shell uses a translucent theme-aware surface derived from the existing shared admin glass material.
- A restrained accent-tinted gradient creates depth without turning the modal into a colored card.
- A fine outer border, subtle top inset highlight, and broad soft shadow separate the panel from the blurred page.
- Header, body, list, and footer boundaries use low-opacity separators so the glass reads as one material rather than stacked opaque blocks.
- Existing serif titles, sans-serif controls, pink primary accent, and red danger semantics remain unchanged.

## Material architecture

The shared `.dialog-scrim` and `.picker-dialog` selectors remain the implementation boundary so all current and future `Dialog` consumers inherit the treatment automatically.

Theme tokens should express dialog-specific roles while aliasing or deriving from the existing admin glass tokens where practical:

- Modal glass surface and no-filter fallback.
- Modal border and inset highlight.
- Modal shadow.
- Modal scrim color.
- Modal blur and saturation values.

The modal must not introduce an unrelated second visual system. Component-specific selectors may adjust dimensions and layout, but should not override the shared shell with opaque backgrounds or independent shadows.

## Component behavior

- Confirmation dialogs keep their editorial header, explanatory body, icon markers, and action footer.
- Complex pickers keep current widths, height limits, scrolling containers, search controls, and responsive layout.
- Image upload and clip import dialogs keep their specialized content grids and progress states.
- History dialogs keep wide-screen comparison behavior.
- Primary and danger buttons keep existing semantic colors and focus behavior.
- Appearance settings remain visually and structurally untouched.

## Accessibility and resilience

- Preserve `role="dialog"` / `role="alertdialog"`, `aria-modal`, labelled-by and described-by relationships.
- Preserve focus trapping, initial focus, focus restoration, Escape handling, backdrop dismissal rules, and scroll locking.
- Maintain readable text and control contrast in light and dark themes.
- Provide an opaque-enough fallback under `@supports not (backdrop-filter: ...)`.
- Respect reduced-motion preferences by avoiding required or elaborate motion; existing short entrance motion may remain and should be disabled or minimized where the current accessibility policy requires it.
- Keep mobile dialogs within the viewport with existing stacked action behavior.

## Testing and verification

- Add or update source-contract tests to verify the shared modal shell uses the frosted-glass tokens and blur/saturation treatment.
- Verify component-specific modal selectors do not restore the old solid dialog surface.
- Assert the appearance panel is not coupled to the modal selectors.
- Preserve existing confirmation-dialog behavior tests.
- Run targeted modal/admin visual tests, the full Vitest suite, `npm run admin:check`, `npm run admin:build`, and `npm run build`.
- Perform browser visual checks of representative confirmation, upload/picker, and wide history dialogs in both dark and light themes, including a narrow viewport.

## Constraints

- Preserve all unrelated uncommitted work currently in the repository.
- Coordinate with the in-progress admin glass unification work and reuse its shared material source rather than reverting or duplicating it.
- Do not edit generated `dist/`, `.astro/`, or `.deploy/` output.
- Do not modify the appearance settings popover.
