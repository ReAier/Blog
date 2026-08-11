import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

describe('mobile page background', () => {
  it('keeps the page image fixed at mobile widths like the desktop layout', async () => {
    const css = await read('src/styles/global.css');
    const mobileStyles = css.slice(css.indexOf('@media (max-width: 560px)'));

    expect(css).toContain('background-attachment: fixed;');
    expect(mobileStyles).toContain('body { background-attachment: fixed; }');
    expect(mobileStyles).not.toContain('body { background-attachment: scroll; }');
  });
});
