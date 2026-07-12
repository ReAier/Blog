import { describe, expect, it } from 'vitest';
import {
  createFrameGate,
  isEnhancedNavigation,
  resolveMotionProfile,
  resolvePageKind,
  type PageKind,
} from '../src/lib/motion';

describe('motion policy', () => {
  it.each([
    ['/', 'home'],
    ['/posts', 'posts'],
    ['/posts/', 'posts'],
    ['/posts/welcome', 'article'],
    ['/posts/welcome/', 'article'],
    ['/posts/guides/motion', 'article'],
    ['/posts/guides/motion/', 'article'],
    ['/tags/', 'taxonomy'],
    ['/archive/', 'taxonomy'],
    ['/about/', 'about'],
    ['/x/', 'default'],
  ] as const)('maps %s to %s', (path, kind) => expect(resolvePageKind(path)).toBe(kind));

  it('disables motion when reduced', () =>
    expect(resolveMotionProfile({ mobile: false, reduced: true, pageKind: 'home' })).toEqual({
      enabled: false,
      fps: 0,
      dpr: 1,
      intensity: 0,
    }));

  it.each([
    ['home', 1],
    ['posts', 0.7],
    ['article', 0.3],
    ['taxonomy', 0.6],
    ['about', 0.55],
    ['default', 0.45],
  ] satisfies ReadonlyArray<readonly [PageKind, number]>)('uses the %s page intensity', (pageKind, intensity) =>
    expect(resolveMotionProfile({ mobile: false, reduced: false, pageKind })).toEqual({
      enabled: true,
      fps: 60,
      dpr: 1.75,
      intensity,
    }),
  );

  it('caps mobile article motion', () =>
    expect(resolveMotionProfile({ mobile: true, reduced: false, pageKind: 'article' })).toEqual({
      enabled: true,
      fps: 30,
      dpr: 1.25,
      intensity: 0.3,
    }));

  describe('enhanced navigation', () => {
    const origin = 'http://localhost:4321';
    const currentHref = `${origin}/posts/welcome/`;
    const navigation = (href: string, overrides: Partial<Parameters<typeof isEnhancedNavigation>[0]> = {}) => ({
      href,
      origin,
      currentHref,
      target: '',
      download: false,
      modified: false,
      ...overrides,
    });

    it('enhances same-origin page links', () => {
      expect(isEnhancedNavigation(navigation(`${origin}/posts/`))).toBe(true);
    });

    it.each([
      ['external links', 'https://github.com/ReAier/Blog'],
      ['same-document hashes', `${currentHref}#example`],
      ['RSS', `${origin}/rss.xml`],
      ['robots', `${origin}/robots.txt`],
      ['sitemaps', `${origin}/sitemap-index.xml`],
      ['favicons', `${origin}/favicon.svg`],
      ['images', `${origin}/images/cover.webp`],
      ['fonts', `${origin}/fonts/site.woff2`],
      ['static assets', `${origin}/assets/app.js`],
    ])('does not enhance %s', (_label, href) => {
      expect(isEnhancedNavigation(navigation(href))).toBe(false);
    });

    it('does not enhance links with a non-self target', () => {
      expect(isEnhancedNavigation(navigation(`${origin}/about/`, { target: '_blank' }))).toBe(false);
    });

    it('does not enhance downloads', () => {
      expect(isEnhancedNavigation(navigation(`${origin}/about/`, { download: true }))).toBe(false);
    });

    it('does not enhance modified clicks', () => {
      expect(isEnhancedNavigation(navigation(`${origin}/about/`, { modified: true }))).toBe(false);
    });
  });

  it('throttles frames', () => {
    const gate = createFrameGate(30);
    expect(gate(0)).toBe(true);
    expect(gate(10)).toBe(false);
    expect(gate(34)).toBe(true);
  });
});