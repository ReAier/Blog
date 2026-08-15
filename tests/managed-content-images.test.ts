import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { copyManagedImages } from '../src/integrations/managed-content';
import { remarkManagedImages } from '../src/lib/remark-managed-images';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true }))));

describe('managed image markdown', () => {
  it('rewrites content-relative image nodes to stable media URLs', () => {
    const tree = { type: 'root', children: [{ type: 'paragraph', children: [
      { type: 'image', url: '../images/hello/picture.webp', alt: 'hello' },
      { type: 'image', url: 'https://cdn.example.com/image.webp', alt: 'remote' },
    ] }] };
    remarkManagedImages()(tree);
    expect(tree.children[0].children[0].url).toBe('/media/hello/picture.webp');
    expect(tree.children[0].children[1].url).toBe('https://cdn.example.com/image.webp');
  });
});

describe('managed image build assets', () => {
  it('copies private content images into dist/media without copying placeholders', async () => {
    const root = await mkdtemp(join(tmpdir(), 'managed-images-')); roots.push(root);
    const images = join(root, 'images'); const dist = join(root, 'dist');
    await mkdir(join(images, 'hello'), { recursive: true });
    await writeFile(join(images, 'hello', 'picture.webp'), 'image');
    await writeFile(join(images, '.gitkeep'), '');
    await copyManagedImages(images, dist);
    expect(await readFile(join(dist, 'media', 'hello', 'picture.webp'), 'utf8')).toBe('image');
    await expect(readFile(join(dist, 'media', '.gitkeep'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
