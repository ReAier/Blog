import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('code copy enhancement', () => {
  it('adds a labeled copy button to every rendered code block', async () => {
    const component = await readFile(new URL('../src/components/CodeEnhancer.astro', import.meta.url), 'utf8');
    expect(component).toContain('data-copy-code');
    expect(component).toContain('复制代码');
    expect(component).toContain('navigator.clipboard.writeText');
    for (const token of [
      'data-code-enhanced',
      "dataset.copyState = 'success'",
      "dataset.copyState = 'error'",
      'astro:page-load',
    ]) expect(component).toContain(token);
  });
});
