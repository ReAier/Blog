# Dashboard Stat Card Navigation Design

## Goal

Turn the four dashboard statistic cards into accessible navigation links with a restrained floating hover treatment, and replace the clipboard card's descriptive copy with its actual storage size.

## Scope

The dashboard cards map to these existing routes:

- 全部文章 → `/posts`
- 剪切板 → `/clips`
- 图片资产 → `/images`
- 最近发布 → `/publish`

No new routes or dashboard sections are introduced.

## Interaction Design

Each statistic card becomes a React Router `Link` so the complete card is clickable and retains native link behavior, including keyboard navigation, opening in a new tab, and copying the destination.

On pointer hover or keyboard focus-visible:

- raise the card by approximately 6px;
- strengthen the shadow and accent-colored border treatment;
- preserve the existing editorial glass appearance and card layout;
- use a short transition of approximately 220ms with a smooth easing curve.

The four cards remain visually joined in their resting state. Each link receives a clear focus-visible outline. Under `prefers-reduced-motion: reduce`, movement and animated transitions are disabled while a non-motion focus/hover indication remains.

## Storage Metrics

The dashboard API currently exposes one `storageBytes` value calculated from the complete content root, even though the UI presents it on the image card. The response will instead expose resource-specific totals:

- clipboard storage: recursive byte size of `src/content/clips/`;
- image storage: recursive byte size of `src/content/images/`.

The clipboard card detail uses the existing `formatBytes` helper, replacing “独立复用内容” with a value such as `628.6 KB`. The image card continues to use the same formatting but receives the image-directory total rather than the whole content-root total.

For compatibility, retain the existing optional `storageBytes` field with its current whole-content-root meaning. Add `clipStorageBytes` and `imageStorageBytes`, and make the dashboard cards consume only these resource-specific fields.

## Accessibility and Responsive Behavior

- Use real links rather than click handlers on `article` elements.
- Preserve the section's `aria-label` and the current heading hierarchy.
- Ensure link text inherits the existing card colors without an underline.
- Keep a visible keyboard focus state.
- Do not rely on motion alone to communicate interactivity.
- On touch layouts, cards remain full-card links; hover-only effects do not affect layout.

## Testing

Add or update tests to verify:

1. each dashboard card renders the expected route;
2. the clipboard and image details use resource-specific byte totals;
3. the dashboard API reports separate clipboard and image storage sizes;
4. the hover/focus and reduced-motion CSS contracts exist;
5. existing admin client checks, Vitest suite, and production build continue to pass.

## Files Expected to Change

- `admin/client/src/pages/DashboardPage.tsx`
- `admin/client/src/styles.css`
- `admin/client/src/types.ts`
- `admin/server/app.ts`
- relevant tests under `tests/`
