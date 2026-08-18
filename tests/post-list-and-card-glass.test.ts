import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

describe('post index list contract', () => {
  it('renders the posts page as a semantic information list instead of cards', async () => {
    const page = await read('src/pages/posts/index.astro');
    const item = await read('src/components/PostListItem.astro');

    expect(page).toContain('<ol class="post-list"');
    expect(page).toContain("import PostListItem from '../../components/PostListItem.astro'");
    expect(page).toContain('<PostListItem post={post} />');
    expect(item).toContain('<li class="post-list-item"');
    expect(item).toContain('class="post-list-item__link"');
    expect(item).toContain('post.data.description');
    expect(item).toContain('post.data.tags');
    expect(item).toContain('post.data.updatedAt');
    expect(page).not.toContain("import PostCard from '../../components/PostCard.astro'");
    expect(page).not.toContain('post-grid');
    expect(page).not.toContain('post-card');
    expect(page).not.toContain('data-motion-card');
  });

  it('defines responsive, unboxed list rows with visible focus treatment', async () => {
    const css = await read('src/styles/global.css');

    expect(css).toContain('.post-list {');
    expect(css).toContain('.post-list-item__link {');
    expect(css).toContain('.post-list-item__link:focus-visible');
    expect(css).toContain('.post-list-item__description');
    expect(css).toContain('.post-list-item__tags');
    expect(css).toMatch(/@media \(max-width: 760px\)[\s\S]*\.post-list-item__link/);
  });
});

describe('home latest writing list contract', () => {
  it('renders recent writing as a compact semantic list without motion cards', async () => {
    const page = await read('src/pages/index.astro');
    const item = await read('src/components/PostListItem.astro');
    const latestSection = page.slice(page.indexOf('<section class="section home-latest">'));

    expect(latestSection).toContain('<ol class="post-list post-list--compact"');
    expect(latestSection).toContain('<PostListItem post={post} />');
    expect(page).toContain('sortPostsRecentlyUpdated(posts).slice(0, 4)');
    expect(item).toContain('post.data.publishedAt');
    expect(item).toContain('post.data.updatedAt');
    expect(item).toContain('post.data.title');
    expect(item).toContain('post.data.description');
    expect(item).toContain("post.data.tags.join(' · ')");
    expect(latestSection).toContain('href="/posts/"');
    expect(latestSection).not.toContain('post-grid');
    expect(latestSection).not.toContain('post-card');
    expect(latestSection).not.toContain('data-motion-card');
  });

  it('keeps the home list compact and responsive', async () => {
    const css = await read('src/styles/global.css');

    expect(css).toContain('.post-list--compact .post-list-item__link');
    expect(css).toContain('.post-list--compact .post-list-item__description');
    expect(css).toContain('-webkit-line-clamp: 2;');
    expect(css).toMatch(/@media \(max-width: 760px\)[\s\S]*\.post-list--compact \.post-list-item__link\s*\{[^}]*grid-template-columns:\s*1fr/);
  });
});

describe('theme-aware post card glass contract', () => {
  it('uses a stronger resting tint in light mode and a softer tint in dark mode', async () => {
    const css = await read('src/styles/global.css');

    expect(css).toContain('--post-card-tint: rgba(var(--accent-rgb), .24);');
    expect(css).toContain('--backdrop-overlay: linear-gradient(rgba(244, 241, 235, .58), rgba(244, 241, 235, .72));');
    expect(css).toContain('--post-card-neutral: rgba(255, 255, 255, .32);');
    expect(css).toContain('--post-card-neutral-hover: rgba(255, 255, 255, .62);');
    expect(css).toContain('--post-card-muted: #4f514d;');
    expect(css).toMatch(/:root\[data-theme="dark"\]\s*\{[^}]*--post-card-tint:\s*rgba\(var\(--accent-rgb\), \.06\);[^}]*--post-card-pigment-soft:\s*rgba\(var\(--accent-rgb\), \.23\);/);
    expect(css).toContain('--post-card-neutral:');
    expect(css).toContain('--post-card-blur:');
    expect(css).toMatch(/\.post-card\s*\{[^}]*background:\s*var\(--post-card-neutral\)[^}]*backdrop-filter:\s*blur\(var\(--post-card-blur\)\)/);
    expect(css).toMatch(/\.post-card:hover,[\s\S]*background:\s*var\(--post-card-neutral-hover\)/);
    expect(css).toMatch(/\.post-card p,[\s\S]*\.post-card \.post-meta\s*\{[^}]*color:\s*var\(--post-card-muted\)/);
  });

  it('contracts the full pigment layer toward the pointer instead of fading in a glow', async () => {
    const css = await read('src/styles/global.css');

    expect(css).toContain('--post-card-pigment-radius-rest:');
    expect(css).toContain('--post-card-pigment-radius-hover: 220px;');
    expect(css).toContain('@property --post-card-pigment-radius');
    expect(css).toMatch(/\.post-card::before\s*\{[\s\S]*background-color:\s*var\(--post-card-tint\)[\s\S]*mask-image:\s*radial-gradient\([\s\S]*var\(--post-card-pigment-radius\)[\s\S]*rgba\(0, 0, 0, \.28\)[\s\S]*transparent 100%/);
    expect(css).toMatch(/\.post-card:hover::before,[\s\S]*--post-card-pigment-radius:\s*var\(--post-card-pigment-radius-hover\)[\s\S]*background-color:\s*var\(--post-card-pigment-soft\)/);
    expect(css).not.toContain('clip-path: circle(');
    expect(css).not.toMatch(/\.post-card::before\s*\{[^}]*opacity:\s*0/);
    expect(css).toMatch(/@media \(hover: none\)[\s\S]*--post-card-pigment-radius:\s*var\(--post-card-pigment-radius-rest\)/);
    const reducedMotion = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reducedMotion).toContain('.post-card:focus-within');
  });

  it('moves pigment toward the pointer with frame-based inertia and skips it for reduced motion', async () => {
    const controller = await read('src/scripts/motion-controller.ts');

    expect(controller).toContain("matchMedia('(prefers-reduced-motion: reduce)')");
    expect(controller).toMatch(/!hoverless\.matches\s*&&\s*!reducedMotion\.matches/);
    for (const token of ['currentX', 'currentY', 'targetX', 'targetY', 'requestAnimationFrame', 'cancelAnimationFrame', "'pointerenter'", "'pointermove'", "'pointerleave'"]) {
      expect(controller).toContain(token);
    }
    expect(controller).toMatch(/currentX\s*\+=\s*\(targetX\s*-\s*currentX\)\s*\*\s*0\.16/);
    expect(controller).toMatch(/currentY\s*\+=\s*\(targetY\s*-\s*currentY\)\s*\*\s*0\.16/);
  });
});
