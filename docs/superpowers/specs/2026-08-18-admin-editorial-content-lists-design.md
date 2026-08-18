# Admin Editorial Content Lists Design

## Goal

Unify the admin dashboard's recent-post list and the article and clipboard index pages with the public blog's editorial post-list language. Replace the traditional table-heavy presentation with continuous horizontal content rows that retain the information density and safe management actions required by the admin interface.

## Scope

This change covers three existing surfaces:

- the “最近稿件” section on the dashboard;
- the article list on `/posts`;
- the clipboard list on `/clips`.

Search, filters, imports, bulk selection, routing, deletion confirmation, API requests, and editor behavior remain unchanged. Dashboard statistic cards, publishing controls, and unrelated admin pages are outside this scope.

## Visual Direction

Use a restrained admin adaptation of the public blog post list rather than copying it literally. Rows form one continuous rounded editorial surface separated by fine rules. The visual hierarchy uses a compact metadata rail, a prominent serif title area, and a right-aligned status or action area.

The memorable interaction is shared by all three surfaces: hovering or keyboard-focusing a row reveals a narrow pink accent line on its left edge, a subtle warm-pink gradient that fades across the row, and an accent-colored title. The treatment should feel consistent with the public blog while remaining calm enough for repeated administrative use.

Light and dark themes derive the effect from theme variables. Dark mode uses a translucent near-black surface and restrained rose illumination; light mode uses a warm paper surface and a very pale rose wash. No screenshot-specific color is hard-coded as the only supported appearance.

## Shared Row Structure

Introduce shared CSS conventions for editorial resource lists. React markup may remain page-specific where the data and actions differ, but the three lists use the same structural classes and interaction states.

A desktop row has three regions:

1. **Metadata rail** — sequence number or date information in compact text.
2. **Primary content** — title followed by slug, file path, description, publish date, or other secondary detail.
3. **Resource metadata and actions** — status, tags, language, selection, and management controls.

The whole non-action area remains an ordinary React Router link. Controls such as checkboxes and delete buttons stay outside the stretched navigation target, retain their own stacking context, and stop navigation naturally. Dangerous actions remain visually distinct and never become part of the row link.

## Dashboard Recent Posts

The dashboard keeps its existing section heading, “查看全部” action, six-item limit, and destination routes.

Each recent-post row displays:

- its two-digit sequence number in the metadata rail;
- the article title as the primary typographic element;
- slug and most recent relevant date as secondary information;
- the existing 草稿 or 已发布 status on the trailing edge.

Compared with the current compact story rows, vertical spacing increases modestly and the title gains the public site's editorial emphasis. Empty-state copy remains unchanged.

## Article List

Remove the visible table header and present articles as continuous editorial rows. Preserve all current data and functionality, including filtering and bulk selection.

Each article row displays:

- selection control and publication/update date in the metadata rail;
- title plus description or slug in the primary region;
- draft/live status and tags in the trailing metadata region;
- existing management actions in a protected action area.

The row's main link opens the article editor. Selection and management controls must not trigger navigation. Bulk-selection accessibility must remain understandable without relying on a visible table header; each checkbox therefore keeps an article-specific accessible label.

## Clipboard List

Remove the visible table header and use the same continuous row surface as articles.

Each clipboard row displays:

- most recent modification date in the metadata rail;
- title and source file path in the primary region;
- language label in the trailing metadata region;
- the existing delete action in a protected action area.

The row's main link opens the clipboard editor. Delete behavior and confirmation remain unchanged.

## Interaction and Motion

On `:hover` and `:focus-within`:

- reveal an approximately 3px left accent line;
- apply a subtle horizontal rose-tinted gradient;
- change the primary title to the accent color;
- optionally translate primary content approximately 2px to the right;
- strengthen the row boundary only enough to clarify the active item.

Use a short transition around 180–220ms. Under `prefers-reduced-motion: reduce`, remove translation and animated transitions while retaining the accent line, background, title color, and visible keyboard focus.

The effect must not cause row height changes or horizontal overflow. Delete-button hover remains more visually specific than the parent-row hover.

## Responsive Behavior

At narrow widths, rows change from three columns to a compact vertical composition:

- metadata becomes a horizontal line above the title;
- title and secondary detail use the full available width;
- statuses, tags, and actions wrap below the main content;
- touch targets remain at least the size already established by the admin UI;
- long slugs and file paths wrap or truncate without forcing page overflow.

Hover effects are progressive enhancement. Touch layouts remain clear without requiring hover.

## Accessibility

- Use native links, buttons, and checkboxes rather than click handlers on generic containers.
- Provide a clear `:focus-visible` indication for the row's primary link and every action.
- Make hover and focus-within styling equivalent without obscuring individual control focus.
- Preserve article-specific labels for selection and delete actions.
- Do not communicate draft/live state through color alone; status text remains visible.
- Maintain sufficient contrast in both themes.
- Respect `prefers-reduced-motion`.

## Testing

Add or update tests to verify:

1. dashboard recent posts retain their editor destinations and status text;
2. article and clipboard indexes use editorial list markup rather than data-table markup;
3. article selection and delete/import controls retain their accessible labels and behavior;
4. clipboard deletion remains a separate control from row navigation;
5. shared hover, focus-within, dark/light theme, responsive, and reduced-motion CSS contracts exist;
6. admin TypeScript checking, Vitest, and the production builds continue to pass.

## Expected Files

Implementation is expected to touch only the relevant areas, primarily:

- `admin/client/src/pages/DashboardPage.tsx`;
- `admin/client/src/pages/PostsPage.tsx`;
- `admin/client/src/pages/ClipsPage.tsx`;
- `admin/client/src/styles.css`;
- `admin/client/src/styles/theme.css` if additional shared theme variables are needed;
- relevant tests under `tests/`.

Existing unrelated uncommitted work in the repository must be preserved.
