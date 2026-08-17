# Unified content trash design

## Goal

Images, clips, and posts can all be moved to one recoverable trash view under Settings. Asset usage/reference records are no longer shown or used to block deletion. Broken local image or clip references are reported by publish validation.

## Behavior

- Remove the article-list trash filter and all image/clip reference-count UI.
- Deleting a post, clip, or image moves it to recoverable storage.
- Add `/trash` under the Settings menu with a single mixed list and restore actions.
- Keep existing post/image restore endpoints for compatibility; add a unified trash API used by the new page.
- Clip and image deletion succeeds even when an article still references the asset.
- Publish validation checks every active post and fails with explicit post/asset details for missing clips and local images.
- Trash data remains recoverable; the existing image retention behavior is unchanged.

## Storage

- Posts continue using `src/content/.trash/blog` so existing deleted posts remain visible.
- Images continue using the data trash metadata format.
- Clips are moved to `data/trash/clips/<trash-id>/<slug>` with `restore.json` metadata.
- The unified API normalizes all three storage formats into one `TrashItem` model.
