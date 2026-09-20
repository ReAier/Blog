# Mermaid and modal shared glass material

User approved the visual scope on 2026-09-18: reuse the existing article glass material, without changing layout or interactions.

- Mermaid figures use the existing article surface, blur, saturation and shadow tokens. Only the SVG canvas is transparent; nodes, edges, labels, source fallback and rendering behavior stay unchanged.
- Shared admin dialogs retain their dimensions, focus management, dismissal and scrim. Replace the scrim opacity animation with a background-color animation so the parent does not isolate the dialog's backdrop sampling. Use the shared shadow rather than an extra dark shadow.
- Preserve light/dark themes, reduced motion, and the existing no-backdrop-filter fallback pattern.
- Inline shared glass tokens into the sandboxed preview document: its raw global CSS imports cannot reliably resolve inside srcdoc.
- Preserve all existing uncommitted Mermaid work. No deployment, dependency update, content edits or unrelated refactoring.

Verification: add failing CSS and preview integration regressions first, run the targeted and full Vitest suites, and build both the site and admin. Browser visual QA is attempted separately and any tooling blocker is reported.
