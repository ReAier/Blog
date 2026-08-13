import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

describe('visual shell contract', () => {
  it('defines the required visual and accessibility primitives', async () => {
    const css = await read('src/styles/global.css');
    expect(css).toContain('--accent:');
    expect(css).toContain('backdrop-filter');
    expect(css).toContain(':focus-visible');
    expect(css).toContain('prefers-reduced-motion');
    expect(css).toContain('overflow-x: auto');
    expect(css).toContain('::view-transition-old(root)');
    expect(css).toContain('::view-transition-new(root)');
  });

  it('keeps rich article content constrained to the mobile viewport', async () => {
    const css = await read('src/styles/global.css');
    expect(css).toMatch(/\.article-layout\s*>\s*\.prose\s*\{[^}]*min-width:\s*0/);
    expect(css).toMatch(/\.prose\s+\.katex-display\s*\{[^}]*overflow-x:\s*auto/);
  });

  it('provides semantic shell landmarks and a skip link', async () => {
    const layout = await read('src/layouts/BaseLayout.astro');
    expect(layout).toContain('class="skip-link"');
    expect(layout).toContain('<main id="main-content"');
    expect(layout).toContain('<SiteHeader');
    expect(layout).toContain('<SiteFooter');
  });

  it('provides the approved ICP registration link in the global footer', async () => {
    const footer = await read('src/components/SiteFooter.astro');
    expect(footer).toContain('赣ICP备2026016483号');
    expect(footer).toContain('href=\"https://beian.miit.gov.cn/\"');
    expect(footer).toContain('target=\"_blank\"');
    expect(footer).toContain('rel=\"noopener noreferrer\"');
  });

  it('provides public-security registration and contact email in the global footer', async () => {
    const footer = await read('src/components/SiteFooter.astro');
    expect(footer).toContain('赣公网安备36012402000305号');
    expect(footer).toContain('recordcode=36012402000305');
    expect(footer).toContain('href=\"mailto:re.aier@outlook.com\"');
    expect(footer).toContain('class=\"footer-records\"');
    expect(footer).toContain('class=\"footer-email\"');
    expect(footer.indexOf('class=\"footer-email\"')).toBeGreaterThan(footer.indexOf('class=\"footer-records\"'));
    expect(footer).toContain('re.aier@outlook.com');
  });

  it('provides accessible image backgrounds and 44px color controls with compact swatches', async () => {
    const panel = await read('src/components/PreferencePanel.astro');
    const css = await read('src/styles/global.css');
    expect(panel).toContain('aria-label="背景样式"');
    expect(panel).toContain('data-background-choice={background.name}');
    expect(panel).toContain('aria-label={background.label}');
    expect(panel).toContain('aria-pressed={background.name === DEFAULT_BACKGROUND}');
    expect(panel).not.toContain('<span>{background.label}</span>');
    expect(css).toMatch(/\.accent-choice \{[^}]*width: 44px;[^}]*height: 44px;[^}]*\}/);
    expect(css).toMatch(/\.accent-choice::before \{[^}]*inset: 3px;[^}]*border-radius: 50%;[^}]*\}/);
    expect(css).toMatch(/\.background-choice\[data-background-kind="solid"\] \{[^}]*width: 44px;[^}]*height: 44px;[^}]*flex: 0 0 44px;[^}]*border-radius: 50%;[^}]*\}/);
    expect(css).toMatch(/\.background-choice\[data-background-kind="solid"\]::before \{[^}]*inset: 3px;[^}]*border-radius: 50%;[^}]*\}/);
    expect(css).toMatch(/\.background-choice\[data-background-kind="image"\] \{[^}]*aspect-ratio: 4 \/ 3;[^}]*\}/);
  });
  it('keeps mobile navigation and preferences inside a single viewport-safe interaction layer', async () => {
    const controller = await read('src/scripts/motion-controller.ts');
    const css = await read('src/styles/global.css');

    expect(controller).toContain("document.addEventListener('click'");
    expect(controller).toContain("!nav.contains(target)");
    expect(controller).toContain("!menuTrigger?.contains(target)");
    expect(css).toMatch(/@media \(max-width: 820px\)[\s\S]*?\.preference-panel\s*\{[^}]*position:\s*fixed/);
    expect(css).toMatch(/@media \(max-width: 820px\)[\s\S]*?\.preference-panel\s*\{[^}]*left:\s*20px[^}]*right:\s*20px/);
    expect(css).toMatch(/@media \(max-width: 820px\)[\s\S]*?\.preference-panel\s*\{[^}]*max-height:\s*calc\(100dvh\s*-\s*102px\)[^}]*overflow-y:\s*auto/);
  });

  it('provides theme controls and all five labeled accent choices', async () => {
    const panel = await read('src/components/PreferencePanel.astro');
    expect(panel).toContain('aria-label="外观设置"');
    for (const accent of ['coral', 'teal', 'indigo', 'amber', 'rose']) {
      expect(panel).toContain(`data-accent="${accent}"`);
    }
  });
});
