# Admin list filtering and interaction design

## Scope

Repair article count freshness, filter popover stacking, Clip search/list presentation, full-row navigation, and the page-sized focus ring visible after Windows screen capture.

## Design

- Article tab counts use a dedicated unfiltered `includeDeleted` resource. Mutations reload both the visible query and the count source.
- Filter controls establish their own positioned stacking context. BlogSelect menus and the tag popover render above following list content; buttons retain the shared rounded control style.
- Clip search reuses the same `post-title-search` visual treatment as article title search.
- Clip cards become a semantic table/list matching the article list. Article and Clip rows use a stretched link for the primary navigation target; destructive or restore controls remain separate and above the stretched link.
- Remove the visible `编辑 →` action column because row navigation makes it redundant.
- Keep global keyboard focus indicators for interactive controls, but suppress outlines on the programmatically focused `main.content-canvas` route target.

## Accessibility

- Row navigation remains an actual link and is keyboard focusable.
- Delete and restore remain buttons with independent accessible labels.
- Focus indication remains available on links, buttons, inputs and custom selects.
