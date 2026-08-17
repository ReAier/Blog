# Unified content trash implementation plan

1. Add failing server tests for referenced asset deletion, unified trash listing/restoration, and publish-time missing clip/image errors.
2. Add failing client tests for the Settings trash destination, the unified trash page, and removal of old reference/trash UI.
3. Implement trash storage helpers and `/api/trash` routes; move clip/image delete operations through them.
4. Relax normal clip listing and move missing-reference enforcement into publish validation.
5. Add the Trash page, API/types, Settings link, and remove reference records plus the old post trash filter.
6. Run targeted tests, full Vitest, admin checks, and production build.
