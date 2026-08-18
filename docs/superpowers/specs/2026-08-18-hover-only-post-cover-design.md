# Restrained post cover design

## Goal

Article covers should feel like a secondary interaction layer rather than a second page background. Covered and uncovered entries keep the same glass surface, spacing and text hierarchy. Cards reveal their cover only through hover or keyboard focus, while list rows may retain a faint resting image without becoming darker than neighboring rows.

## Card behavior

- Keep the current post-card glass surface, pointer-following pigment, lift, border, shadow and press behavior unchanged.
- A cover image remains an absolutely positioned decorative layer with zero opacity at rest.
- Do not add a cover-specific overlay or alter the card background when a cover exists.
- On `:hover` or `:focus-within`, reveal the cover from the right through a horizontal CSS mask: transparent across the text side, a gradual transition through the middle, and strongest visibility at the right edge.
- Limit the revealed image to approximately 34% opacity with restrained brightness and saturation. The existing pointer pigment remains above the image.
- Removing hover or focus returns the card to the same resting appearance as a card without a cover.

## List behavior

- Keep the current list-row columns, height, glass surface, pink leading line, hover gradient, title color and title movement unchanged.
- Let the cover layer span the entire row so there is no physical image boundary or vertical seam.
- Use a horizontal mask to keep the date and main text side clear and gradually reveal the image toward the right.
- Show the masked cover at approximately 14% opacity at rest and 28% on hover or keyboard focus.
- Do not place light- or dark-theme cover overlays above the image. The shared list glass surface remains the only surface treatment, preventing covered rows from turning black.
- Rows without covers render the existing design with no placeholder or reserved image space.

## Responsive and accessibility behavior

- Hoverless devices keep card covers hidden so covered and uncovered cards remain identical.
- Mobile list rows retain a subtler resting cover at approximately 9% opacity with a stronger left-side fade for text contrast.
- Keyboard focus receives the same reveal as mouse hover where hover interaction is available.
- Reduced-motion mode keeps opacity changes but removes cover scaling and animated movement.
- Cover images remain decorative with empty alt text and hide themselves while removing the cover state if loading fails.
- Article detail pages remain free of visible covers; the cover continues to provide Open Graph and Twitter metadata.

## Implementation boundaries

- Keep the existing `cover` schema, backend format and URL resolver unchanged.
- Retain the shared `PostCard` and `PostListItem` components.
- Make the correction in `src/styles/global.css`; do not change article dimensions or content layout.
- Do not change archive presentation or generate placeholder covers.

## Verification

- Source tests assert zero resting opacity and masked right-side reveal for cards.
- Source tests assert full-row masked list covers, 14% resting opacity, 28% hover opacity and the absence of cover-specific `::after` overlays.
- Visual QA compares adjacent covered and uncovered entries in the dark theme over a detailed page background.
- Visual QA confirms that list rows no longer become black, no hard vertical image edge is visible, and all text remains readable on desktop and mobile.
- Run Astro checks, the full Vitest suite and the production build.
