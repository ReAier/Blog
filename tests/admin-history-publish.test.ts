import { DatabaseSync } from 'node:sqlite';
import { access, lstat, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HistoryService } from '../admin/server/history/service';
import { migrateAdminDatabase } from '../admin/server/db/migrations';
import { validateContentRoot } from '../admin/server/publish/runner';
import { createBuildSnapshot, hashContentTree } from '../admin/server/publish/snapshot';

const roots: string[] = [];
async function temp(prefix: string) { const root = await mkdtemp(join(tmpdir(), prefix)); roots.push(root); return root; }
afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe('content history', () => {
  it('deduplicates blobs, keeps version groups and restores as a new revision', async () => {
    const root = await temp('admin-history-');
    const database = new DatabaseSync(':memory:'); migrateAdminDatabase(database);
    const history = new HistoryService({ database, blobRoot: join(root, 'blobs'), maxVersions: 100 });
    const first = await history.record({ contentPath: 'blog/hello.md', content: 'first', groupId: 'autosave-1', createdAt: 1 });
    const second = await history.record({ contentPath: 'blog/hello.md', content: 'second', groupId: 'manual-2', createdAt: 2 });
    const duplicate = await history.record({ contentPath: 'blog/other.md', content: 'second', groupId: 'manual-2', createdAt: 2 });
    expect(first.revisionNumber).toBe(1);
    expect(second.revisionNumber).toBe(2);
    expect(duplicate.blobSha256).toBe(second.blobSha256);
    expect(await history.readBlob(second.blobSha256)).toBe('second');
    const restored = await history.restore({ contentPath: 'blog/hello.md', revisionNumber: 1, createdAt: 3, write: async (content) => expect(content).toBe('first') });
    expect(restored.revisionNumber).toBe(3);
    database.close();
  });
});

describe('content-root validation', () => {
  async function contentFixture(prefix: string) {
    const content = await temp(prefix);
    for (const name of ['blog', 'clips', 'images']) {
      await (await import('node:fs/promises')).mkdir(join(content, name), { recursive: true });
    }
    return content;
  }

  it('rejects oversized Markdown before restore or publish', async () => {
    vi.stubEnv('BLOG_MAX_MARKDOWN_BYTES', '256');
    const content = await contentFixture('admin-invalid-post-');
    const markdown = [
      '---',
      'title: Large',
      'description: Test',
      'publishedAt: 2026-08-13',
      'tags: []',
      'draft: true',
      'featured: false',
      '---',
      '',
      'x'.repeat(512),
      '',
    ].join('\n');
    await writeFile(join(content, 'blog', 'large.md'), markdown);

    await expect(validateContentRoot({
      contentRoot: content,
      outputPath: join(content, 'redirects.conf'),
    })).rejects.toMatchObject({ code: 'CONTENT_TOO_LARGE' });
  });

  it('rejects non-WebP image assets before restore or publish', async () => {
    const content = await contentFixture('admin-invalid-image-');
    await (await import('node:fs/promises')).mkdir(join(content, 'images', 'owner'), { recursive: true });
    await writeFile(join(content, 'images', 'owner', 'unsafe.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>');

    await expect(validateContentRoot({
      contentRoot: content,
      outputPath: join(content, 'redirects.conf'),
    })).rejects.toThrow(/WebP/i);
  });
  it('rejects oversized orphan clip sources before restore or publish', async () => {
    vi.stubEnv('BLOG_MAX_CLIP_BYTES', '16');
    const content = await contentFixture('admin-invalid-clip-');
    await (await import('node:fs/promises')).mkdir(join(content, 'clips', 'standalone'), { recursive: true });
    await writeFile(join(content, 'clips', 'standalone', 'meta.json'), JSON.stringify({
      version: 1,
      title: 'Standalone',
      language: 'text',
      file: 'standalone.txt',
      createdAt: '2026-08-14',
    }));
    await writeFile(join(content, 'clips', 'standalone', 'standalone.txt'), 'x'.repeat(32));

    await expect(validateContentRoot({
      contentRoot: content,
      outputPath: join(content, 'redirects.conf'),
    })).rejects.toMatchObject({ code: 'CONTENT_TOO_LARGE' });
  });
});
describe('isolated build snapshots', () => {
  it('copies private content into a workspace and returns a stable tree hash', async () => {
    const project = await temp('admin-project-');
    const content = await temp('admin-content-');
    const jobs = await temp('admin-jobs-');
    await (await import('node:fs/promises')).mkdir(join(project, 'src', 'content'), { recursive: true });
    await (await import('node:fs/promises')).mkdir(join(content, 'blog'), { recursive: true });
    await writeFile(join(project, 'package.json'), '{}\n');
    await writeFile(join(content, 'blog', 'hello.md'), '# Hello\n');
    const expectedHash = await hashContentTree(content);
    const snapshot = await createBuildSnapshot({ projectRoot: project, contentRoot: content, jobsRoot: jobs, id: 'job-1' });
    expect(snapshot.contentHash).toBe(expectedHash);
    expect(await readFile(join(snapshot.workspace, 'src', 'content', 'blog', 'hello.md'), 'utf8')).toBe('# Hello\n');
    expect(await readFile(join(snapshot.workspace, 'package.json'), 'utf8')).toBe('{}\n');
  });

  it('creates a writable dependency tree without linking the workspace node_modules directory', async () => {
    const project = await temp('admin-project-deps-');
    const content = await temp('admin-content-deps-');
    const jobs = await temp('admin-jobs-deps-');
    await mkdir(join(project, 'src', 'content'), { recursive: true });
    await mkdir(join(project, 'node_modules', 'example-package'), { recursive: true });
    await mkdir(join(project, 'node_modules', '.vite', 'deps'), { recursive: true });
    await mkdir(join(content, 'blog'), { recursive: true });
    await writeFile(join(project, 'package.json'), '{}\n');
    await writeFile(join(project, 'node_modules', 'example-package', 'index.js'), 'export default 1;\n');
    await writeFile(join(project, 'node_modules', '.vite', 'deps', 'stale.js'), 'stale\n');

    const snapshot = await createBuildSnapshot({ projectRoot: project, contentRoot: content, jobsRoot: jobs, id: 'job-deps' });
    const workspaceModules = join(snapshot.workspace, 'node_modules');
    expect((await lstat(workspaceModules)).isSymbolicLink()).toBe(false);
    expect(await readFile(join(workspaceModules, 'example-package', 'index.js'), 'utf8')).toBe('export default 1;\n');
    await expect(access(join(workspaceModules, '.vite'))).rejects.toMatchObject({ code: 'ENOENT' });
    await writeFile(join(workspaceModules, 'example-package', 'generated.cache'), 'workspace-only\n');
    await expect(access(join(project, 'node_modules', 'example-package', 'generated.cache'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
