import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

describe('post cover rendering contract', () => {
  it('renders resolved decorative covers in reusable card and list components', async () => {
    const card = await read('src/components/PostCard.astro');
    const listItem = await read('src/components/PostListItem.astro');

    for (const component of [card, listItem]) {
      expect(component).toContain("import { resolveCoverUrl } from '../lib/image-paths'");
      expect(component).toContain('cover?: string');
      expect(component).toContain('resolveCoverUrl(post.data.cover)');
      expect(component).toContain('alt=""');
      expect(component).toContain('loading="lazy"');
      expect(component).toContain('decoding="async"');
      expect(component).toContain("this.closest('[data-has-cover]')?.removeAttribute('data-has-cover')");
      expect(component).toContain("this.setAttribute('hidden', '')");
    }

    expect(card).toContain('class="post-card__cover"');
    expect(listItem).toContain('class="post-list-item__cover"');
  });

  it('uses shared cover-aware components across card and row layouts', async () => {
    const home = await read('src/pages/index.astro');
    const posts = await read('src/pages/posts/index.astro');
    const tag = await read('src/pages/tags/[tag].astro');

    expect(home).toContain("import PostCard from '../components/PostCard.astro'");
    expect(home).toContain("import PostListItem from '../components/PostListItem.astro'");
    expect(home).toContain('<PostCard post={post} headingLevel={3} tagLimit={1} />');
    expect(home).toContain('<PostListItem post={post} />');
    expect(posts).toContain("import PostListItem from '../../components/PostListItem.astro'");
    expect(posts).toContain('<PostListItem post={post} />');
    expect(tag).toContain('<PostCard post={post} />');
  });

  it('keeps detail covers metadata-only and archive entries text-only', async () => {
    const layout = await read('src/layouts/PostLayout.astro');
    const archive = await read('src/pages/archive.astro');

    expect(layout).toContain('const cover = resolveCoverUrl(entry.data.cover);');
    expect(layout).toContain('image={cover}');
    expect(layout).not.toContain('post-card__cover');
    expect(layout).not.toContain('post-list-item__cover');
    expect(layout).not.toMatch(/<img[^>]+cover/);
    expect(archive).not.toContain('resolveCoverUrl');
    expect(archive).not.toContain('post-card__cover');
    expect(archive).not.toContain('post-list-item__cover');
  });
});

describe('post cover visual contract', () => {
  it('keeps card covers invisible at rest and reveals them through a soft right-side mask', async () => {
    const css = await read('src/styles/global.css');

    expect(css).toMatch(/\.post-card__cover\s*\{[^}]*opacity:\s*0[^}]*mask-image:\s*linear-gradient\(90deg/s);
    expect(css).not.toMatch(/\.post-card\[data-has-cover="true"\]::after\s*\{/);
    expect(css).toMatch(/\.post-card:hover \.post-card__cover,[\s\S]*opacity:\s*\.34[\s\S]*transform:\s*scale\(1\.035\)/);
    expect(css).toMatch(/\.post-card::before\s*\{[^}]*z-index:\s*2/s);
    expect(css).toMatch(/\.post-card > :not\(\.post-card__cover\)\s*\{[^}]*z-index:\s*3/s);
    expect(css).toContain('--post-card-pigment-radius-hover: 220px;');
    expect(css).toMatch(/@media \(hover: none\)[\s\S]*\.post-card__cover\s*\{[^}]*opacity:\s*0/s);
  });

  it('shows a faint full-row list cover without a dark overlay or hard image seam', async () => {
    const css = await read('src/styles/global.css');

    expect(css).toMatch(/\.post-list-item__cover\s*\{[^}]*inset:\s*0[^}]*width:\s*100%[^}]*opacity:\s*\.14[^}]*mask-image:\s*linear-gradient\(90deg/s);
    expect(css).not.toMatch(/\.post-list-item__link\[data-has-cover="true"\]::after\s*\{/);
    expect(css).toMatch(/\.post-list-item__link:hover \.post-list-item__cover,[\s\S]*opacity:\s*\.28[\s\S]*transform:\s*scale\(1\.025\)/);
    expect(css).toContain('.post-list-item__link:hover::before, .post-list-item__link:focus-visible::before');
    expect(css).toContain('.post-list-item__link:hover h2, .post-list-item__link:focus-visible h2');
    expect(css).toMatch(/@media \(max-width: 760px\)[\s\S]*\.post-list-item__cover\s*\{[^}]*opacity:\s*\.09/s);
  });

  it('disables cover scaling for reduced motion', async () => {
    const css = await read('src/styles/global.css');
    const reducedMotion = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));

    expect(reducedMotion).toContain('.post-card__cover');
    expect(reducedMotion).toContain('.post-list-item__cover');
    expect(reducedMotion).toContain('transform: none;');
  });
});

