# Cross-platform fixed background design

## Goal
Make the blog background remain fixed to the viewport during touch scrolling on iOS and Android, without scroll-position jumps or flashes.

## Design
Move the image/overlay background off `body { background-attachment: fixed }` and onto a dedicated fixed presentation layer. Keep `body` as a solid-color fallback. The existing WebGL canvas remains a separate fixed layer above the static background. Both layers use viewport-based sizing and stable compositing hints; the dynamic canvas resizes from `visualViewport` when available so mobile browser chrome changes do not leave a stale frame.

## Scope
- Modify `src/components/MotionShell.astro` to render the static background layer.
- Modify `src/styles/global.css` to make body background solid and style the fixed layer.
- Modify `src/scripts/fluid-background.ts` to synchronize canvas sizing with visual viewport changes.
- Add regression tests for the generated background layer and source contracts.

## Acceptance criteria
- The static background is `position: fixed` with full viewport inset on all platforms.
- The body no longer relies on `background-attachment: fixed`.
- Canvas dimensions are synchronized after viewport resize/scroll events where supported.
- Existing checks, tests, and production build pass.
