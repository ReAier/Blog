import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createBackup, validateArchiveEntryPath } from '../admin/server/backups/service';
import { ImageService } from '../admin/server/images/service';
import { PublishCoordinator } from '../admin/server/publish/coordinator';
import sharp from 'sharp';
import { getContentPaths } from '../src/lib/content-paths';

const roots: string[] = [];

async function tempRoot(prefix: string) {
  const root = await mkdtemp(join(tmpdir(), prefix));
  roots.push(root);
  return root;
}

afterEach(async () => {
  delete process.env.BLOG_CONTENT_ROOT;
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('external content root', () => {
  it('uses BLOG_CONTENT_ROOT while preserving the repository default', async () => {
    const projectRoot = await tempRoot('aier-content-project-');
    const privateRoot = await tempRoot('aier-private-content-');
    const defaultPaths = getContentPaths(projectRoot);
    expect(defaultPaths.root).toBe(resolve(projectRoot, 'src/content'));

    process.env.BLOG_CONTENT_ROOT = privateRoot;
    const external = getContentPaths(projectRoot);
    expect(external.root).toBe(privateRoot);
    expect(external.blog).toBe(join(privateRoot, 'blog'));
    expect(external.clips).toBe(join(privateRoot, 'clips'));
    expect(external.images).toBe(join(privateRoot, 'images'));
  });
});

describe('backup archive safety', () => {
  it.each(['../secret', '/etc/passwd', 'C:/windows/system.ini', 'blog/../../secret', '']) (
    'rejects unsafe archive entry %s',
    (entry) => expect(() => validateArchiveEntryPath(entry)).toThrow(),
  );

  it('exports a versioned archive with a checksummed manifest', async () => {
    const root = await tempRoot('aier-backup-');
    await mkdir(join(root, 'blog'), { recursive: true });
    await mkdir(join(root, 'clips'), { recursive: true });
    await mkdir(join(root, 'images'), { recursive: true });
    await writeFile(join(root, 'blog', 'hello.md'), '# Hello\n', 'utf8');
    await writeFile(join(root, 'clips', 'hello.ts'), 'export {};\n', 'utf8');
    await writeFile(join(root, 'redirects.json'), '{}\n', 'utf8');

    const output = join(root, '..', `${Date.now()}-backup.zip`);
    roots.push(output);
    const result = await createBackup({ contentRoot: root, outputPath: output, now: new Date('2026-08-13T00:00:00Z') });

    expect(result.fileCount).toBe(3);
    expect(result.manifest.version).toBe(1);
    expect(result.manifest.files.map((item) => item.path)).toEqual([
      'blog/hello.md',
      'clips/hello.ts',
      'redirects.json',
    ]);
    expect(result.manifest.files.every((item) => /^[a-f0-9]{64}$/.test(item.sha256))).toBe(true);
    expect((await readFile(output)).byteLength).toBeGreaterThan(100);
  });
});

describe('managed images', () => {
  it('normalizes uploaded raster images to bounded webp assets', async () => {
    const root = await tempRoot('aier-images-');
    const service = new ImageService({ contentRoot: root, maxBytes: 12 * 1024 * 1024, maxPixels: 30_000_000 });
    const png = await sharp({
      create: { width: 2, height: 1, channels: 4, background: { r: 240, g: 80, b: 60, alpha: 1 } },
    }).png().toBuffer();

    const asset = await service.upload({ originalName: 'Hero Image.PNG', bytes: png });

    expect(asset.relativePath).toMatch(/^images\/hero-image-[a-f0-9]{12}\.webp$/);
    expect(asset.width).toBe(2);
    expect(asset.height).toBe(1);
    expect(asset.byteSize).toBeGreaterThan(0);
    expect(asset.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('records the release selected by the switch helper', async () => {
    const coordinator = new PublishCoordinator({
      snapshot: async () => ({ workspace: 'snapshot', contentHash: 'abc123' }),
      validate: async () => undefined,
      build: async () => undefined,
      switchRelease: async () => ({ releaseId: 'release-20260813' }),
      cleanup: async () => undefined,
    });

    const job = await coordinator.publish();
    await coordinator.wait(job.id);

    expect(coordinator.get(job.id)).toMatchObject({
      status: 'succeeded',
      releaseId: 'release-20260813',
    });
  });
});

describe('publish coordinator', () => {
  it('serializes full builds and never switches a failed build', async () => {
    const events: string[] = [];
    const coordinator = new PublishCoordinator({
      snapshot: async () => ({ workspace: 'snapshot', contentHash: 'abc123' }),
      validate: async () => events.push('validate'),
      build: async () => { events.push('build'); throw new Error('broken markdown'); },
      switchRelease: async () => { events.push('switch'); },
      cleanup: async () => events.push('cleanup'),
    });

    const job = await coordinator.publish();
    await coordinator.wait(job.id);
    const result = coordinator.get(job.id);

    expect(result?.status).toBe('failed');
    expect(result?.log).toContain('broken markdown');
    expect(events).toEqual(['validate', 'build', 'cleanup']);
  });
});
