# Tag Article List Design

Approved in conversation on 2026-09-19.

Tag detail pages will reuse the same PostListItem component and semantic ol.post-list wrapper as the all-posts page. This preserves the existing dates, title, description, tags, optional cover, focus/hover treatments and responsive styles without new CSS.

Keep tag headings, article counts, case-insensitive tag filtering, draft exclusion and newest-first sorting unchanged. Do not modify the home featured cards or tags index. Preserve unrelated working-tree changes. No deployment or dependency changes are required.

Verification: source-contract regression tests, the full Vitest suite, production build, and inspection of generated tag HTML.
