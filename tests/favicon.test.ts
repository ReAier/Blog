import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFile(join(process.cwd(), path));
const readText = (path: string) => readFile(join(process.cwd(), path), 'utf8');
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

describe('site favicon', () => {
  it('ships the same ICO, PNG, and apple-touch icons on the public site and admin client', async () => {
    for (const file of ['favicon.ico', 'favicon.png', 'apple-touch-icon.png']) {
      const publicBytes = await read(`public/${file}`);
      const adminBytes = await read(`admin/client/public/${file}`);
      expect(digest(publicBytes)).toBe(digest(adminBytes));
      expect(publicBytes.byteLength).toBeGreaterThan(100);
    }
  });

  it('uses a square PNG raster icon instead of the letter-mark SVG', async () => {
    const png = await read('public/favicon.png');
    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const meta = await sharp(png).metadata();
    expect(meta.format).toBe('png');
    expect(meta.width).toBe(meta.height);
    expect(meta.width).toBeGreaterThanOrEqual(32);
  });

  it('provides an apple-touch-icon at 180px', async () => {
    const meta = await sharp(await read('public/apple-touch-icon.png')).metadata();
    expect(meta.format).toBe('png');
    expect(meta.width).toBe(180);
    expect(meta.height).toBe(180);
  });

  it('declares favicon links in the public site head and admin document', async () => {
    const seo = await readText('src/components/SeoHead.astro');
    const admin = await readText('admin/client/index.html');

    for (const source of [seo, admin]) {
      expect(source).toContain('rel="icon"');
      expect(source).toContain('href="/favicon.ico"');
      expect(source).toContain('href="/favicon.png"');
      expect(source).toContain('rel="apple-touch-icon"');
      expect(source).toContain('href="/apple-touch-icon.png"');
    }
  });
});
