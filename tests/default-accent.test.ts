import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('default accent integration', () => {
  it('boots with rose and uses the versioned preference key', async () => {
    const layout = await readFile(new URL('../src/layouts/BaseLayout.astro', import.meta.url), 'utf8');
    const panel = await readFile(new URL('../src/components/PreferencePanel.astro', import.meta.url), 'utf8');
    expect(layout).toContain('data-accent="rose"');
    expect(layout).toContain("aier-accent-v2");
    expect(panel).toContain("aier-accent-v2");
    expect(panel).toContain('data-accent="rose" aria-label="玫红" aria-pressed="true"');
  });
});
