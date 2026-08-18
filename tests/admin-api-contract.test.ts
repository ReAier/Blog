import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildServer } from '../admin/server/app';
import { createBackup } from '../admin/server/backups/service';
import { createAdminConfig } from '../admin/server/config';
import { createContentRepository } from '../admin/server/content/repository';
import { migrateAdminDatabase } from '../admin/server/db/migrations';

const roots: string[] = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'admin-api-contract-'));
  roots.push(root);
  const contentRoot = join(root, 'content');
  for (const name of ['blog', 'clips', 'images']) await mkdir(join(contentRoot, name), { recursive: true });
  await writeFile(join(contentRoot, 'blog', 'owner.md'), '---\ntitle: Owner\ndescription: Post\npublishedAt: 2026-08-13\ntags: []\ndraft: true\nfeatured: false\n---\n\nBody\n');
  const database = new DatabaseSync(':memory:');
  migrateAdminDatabase(database);
  const app = await buildServer({
    config: createAdminConfig({
      contentRoot,
      dataRoot: root,
      projectRoot: process.cwd(),
      publicOrigin: 'https://admin.blog.reaier.top',
      secureCookies: false,
    }),
    database,
    repository: createContentRepository({ root: contentRoot }),
    authOverride: async () => ({ adminId: 1, username: 'owner', csrfToken: 'csrf' }),
  });
  return { app, database, contentRoot };
}

const writeHeaders = {
  origin: 'https://admin.blog.reaier.top',
  'x-csrf-token': 'csrf',
};

function postInput(slug: string, title = 'Created') {
  return {
    slug,
    frontmatter: {
      title,
      description: 'Description',
      publishedAt: '2026-08-13',
      tags: ['Admin'],
      draft: true,
      featured: false,
    },
    body: '# Body\n',
  };
}

describe('admin API client contract', () => {
  it('returns paged post lists and accepts the structured editor payload', async () => {
    const { app, database } = await fixture();
    const list = await app.inject({ method: 'GET', url: '/api/posts?status=draft&page=1' });
    expect(list.json()).toMatchObject({ total: 1, page: 1, pageSize: 50, counts: { all: 1, published: 0, drafts: 1, deleted: 0 }, items: [{ slug: 'owner' }] });

    const created = await app.inject({
      method: 'POST',
      url: '/api/posts',
      headers: writeHeaders,
      payload: postInput('created-post'),
    });
    expect(created.statusCode, created.body).toBe(201);
    expect(created.json()).toMatchObject({ slug: 'created-post', title: 'Created', body: '# Body\n' });

    const updated = await app.inject({
      method: 'PUT',
      url: '/api/posts/created-post',
      headers: { ...writeHeaders, 'if-match': created.json().revision },
      payload: postInput('created-post', 'Updated'),
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({ title: 'Updated' });
    await app.close();
    database.close();
  });

  it('renders same-site public image Markdown through the admin media route', async () => {
    const { app, database } = await fixture();
    const response = await app.inject({
      method: 'POST',
      url: '/api/previews/instant',
      headers: writeHeaders,
      payload: {
        markdown: '![preview](https://blog.reaier.top/media/unpublished.webp)',
      },
    });

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().html).toContain('src=\"/media/unpublished.webp\"');
    expect(response.json().html).not.toContain('src=\"https://blog.reaier.top/media/unpublished.webp\"');
    await app.close();
    database.close();
  });
  it('records editor history only for explicitly manual saves', async () => {
    const { app, database } = await fixture();
    const owner = await app.inject({ method: 'GET', url: '/api/posts/owner' });
    const autosaved = await app.inject({
      method: 'PUT',
      url: '/api/posts/owner',
      headers: { ...writeHeaders, 'if-match': owner.json().revision },
      payload: { ...postInput('owner', 'Owner'), body: '# Autosaved\n' },
    });
    expect(autosaved.statusCode, autosaved.body).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/posts/owner/history' })).json()).toEqual([]);

    const manuallySaved = await app.inject({
      method: 'PUT',
      url: '/api/posts/owner',
      headers: {
        ...writeHeaders,
        'if-match': autosaved.json().revision,
        'x-history-mode': 'manual',
        'x-history-group': 'manual-test',
      },
      payload: { ...postInput('owner', 'Owner'), body: '# Manual\n' },
    });
    expect(manuallySaved.statusCode, manuallySaved.body).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/posts/owner/history' })).json()).toMatchObject([
      { revisionNumber: 1, groupId: 'manual-test' },
    ]);    const manualRevision = await app.inject({
      method: 'GET',
      url: '/api/posts/owner/history/1',
    });
    expect(manualRevision.statusCode, manualRevision.body).toBe(200);
    expect(manualRevision.json()).toMatchObject({
      body: '# Manual\n',
      content: expect.stringMatching(/^---/),
    });

    const autoCreated = await app.inject({
      method: 'POST',
      url: '/api/posts',
      headers: writeHeaders,
      payload: postInput('auto-created'),
    });
    expect(autoCreated.statusCode, autoCreated.body).toBe(201);
    expect((await app.inject({ method: 'GET', url: '/api/posts/auto-created/history' })).json()).toEqual([]);

    const manualCreated = await app.inject({
      method: 'POST',
      url: '/api/posts',
      headers: {
        ...writeHeaders,
        'x-history-mode': 'manual',
        'x-history-group': 'manual-create',
      },
      payload: postInput('manual-created'),
    });
    expect(manualCreated.statusCode, manualCreated.body).toBe(201);
    expect((await app.inject({ method: 'GET', url: '/api/posts/manual-created/history' })).json()).toMatchObject([
      { revisionNumber: 1, groupId: 'manual-create' },
    ]);

    await app.close();
    database.close();
  });
  it('lists soft-deleted posts and restores them with revision checks', async () => {
    const { app, database } = await fixture();
    const owner = await app.inject({ method: 'GET', url: '/api/posts/owner' });
    const deleted = await app.inject({
      method: 'DELETE',
      url: '/api/posts/owner',
      headers: { ...writeHeaders, 'if-match': owner.json().revision },
    });
    expect(deleted.statusCode).toBe(200);
    expect(deleted.json()).toMatchObject({ slug: 'owner', deleted: true });

    const trash = await app.inject({ method: 'GET', url: '/api/posts?includeDeleted=true' });
    expect(trash.json()).toMatchObject({ counts: { all: 0, published: 0, drafts: 0, deleted: 1 }, items: [{ slug: 'owner', deleted: true }] });
    const restored = await app.inject({
      method: 'POST',
      url: '/api/posts/owner/restore',
      headers: { ...writeHeaders, 'if-match': deleted.json().revision },
    });
    expect(restored.statusCode).toBe(200);
    expect(restored.json()).toMatchObject({ slug: 'owner', deleted: false });
    await app.close();
    database.close();
  });

  it('creates a clip and its article fence as one logical operation', async () => {
    const { app, database } = await fixture();
    const owner = await app.inject({ method: 'GET', url: '/api/posts/owner' });
    const created = await app.inject({
      method: 'POST',
      url: '/api/clips',
      headers: writeHeaders,
      payload: {
        slug: 'sample',
        ownerPostSlug: 'owner',
        expectedPostRevision: owner.json().revision,
        title: 'Sample',
        description: 'Example',
        language: 'typescript',
        file: 'sample.ts',
        createdAt: '2026-08-13',
        code: 'export {};\n',
      },
    });
    expect(created.statusCode, created.body).toBe(201);
    expect(created.json()).toMatchObject({ slug: 'sample', revision: expect.any(String) });
    expect(created.json()).not.toHaveProperty('references');
    const updatedOwner = await app.inject({ method: 'GET', url: '/api/posts/owner' });
    expect(updatedOwner.json().body).toContain('```clip');
    expect(updatedOwner.json().body).toContain('slug: sample');
    await app.close();
    database.close();
  });

  it('returns the updated article after attaching an existing Clip', async () => {
    const { app, database } = await fixture();
    const created = await app.inject({
      method: 'POST',
      url: '/api/clips',
      headers: writeHeaders,
      payload: {
        slug: 'shared-answer',
        title: 'Shared answer',
        description: 'Reusable source.',
        language: 'typescript',
        file: 'answer.ts',
        createdAt: '2026-08-17',
        code: 'export const answer = 42;\n',
      },
    });
    expect(created.statusCode, created.body).toBe(201);
    const owner = await app.inject({ method: 'GET', url: '/api/posts/owner' });

    const attached = await app.inject({
      method: 'POST',
      url: '/api/posts/owner/clip-references',
      headers: writeHeaders,
      payload: {
        clipSlug: 'shared-answer',
        expectedPostRevision: owner.json().revision,
        insertOffset: owner.json().body.length,
      },
    });

    expect(attached.statusCode, attached.body).toBe(200);
    expect(attached.json()).toMatchObject({
      slug: 'owner',
      body: expect.stringContaining('slug: shared-answer'),
    });
    expect(attached.json().revision).not.toBe(owner.json().revision);

    const preview = await app.inject({
      method: 'POST',
      url: '/api/previews/instant',
      headers: writeHeaders,
      payload: { markdown: attached.json().body },
    });
    expect(preview.statusCode, preview.body).toBe(200);
    expect(preview.json().html).toContain('data-clip-card');
    expect(preview.json().html).not.toContain('即时预览生成失败');
    await app.close();
    database.close();
  });

  it('keeps the complete language facet when clip results are filtered', async () => {
    const { app, database } = await fixture();
    for (const clip of [
      { slug: 'cpp-sample', title: 'C++ sample', language: 'cpp', file: 'sample.cpp' },
      { slug: 'ts-sample', title: 'TypeScript sample', language: 'typescript', file: 'sample.ts' },
    ]) {
      const created = await app.inject({
        method: 'POST',
        url: '/api/clips',
        headers: writeHeaders,
        payload: {
          ...clip,
          description: '',
          createdAt: '2026-08-15',
          code: 'example\n',
        },
      });
      expect(created.statusCode, created.body).toBe(201);
    }

    const response = await app.inject({ method: 'GET', url: '/api/clips?language=cpp' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      items: [{ slug: 'cpp-sample', language: 'cpp' }],
      total: 1,
      languages: ['cpp', 'typescript'],
    });
    await app.close();
    database.close();
  });
  it('enforces configured Markdown and clip source limits for editor JSON requests', async () => {
    vi.stubEnv('BLOG_MAX_MARKDOWN_BYTES', '256');
    vi.stubEnv('BLOG_MAX_CLIP_BYTES', '16');
    const { app, database } = await fixture();

    const post = await app.inject({
      method: 'POST',
      url: '/api/posts',
      headers: writeHeaders,
      payload: { ...postInput('oversized'), body: 'x'.repeat(512) },
    });
    expect(post.statusCode).toBe(413);
    expect(post.json()).toMatchObject({ code: 'CONTENT_TOO_LARGE' });

    const owner = await app.inject({ method: 'GET', url: '/api/posts/owner' });
    const clip = await app.inject({
      method: 'POST',
      url: '/api/clips',
      headers: writeHeaders,
      payload: {
        slug: 'oversized',
        ownerPostSlug: 'owner',
        expectedPostRevision: owner.json().revision,
        title: 'Oversized',
        language: 'text',
        file: 'oversized.txt',
        createdAt: '2026-08-13',
        code: 'x'.repeat(32),
      },
    });
    expect(clip.statusCode).toBe(413);
    expect(clip.json()).toMatchObject({ code: 'CONTENT_TOO_LARGE' });
    await app.close();
    database.close();
  });

  it('keeps a detached clip as an independent unreferenced resource', async () => {
    const { app, database } = await fixture();
    const owner = await app.inject({ method: 'GET', url: '/api/posts/owner' });
    const created = await app.inject({
      method: 'POST',
      url: '/api/clips',
      headers: writeHeaders,
      payload: {
        slug: 'retained',
        ownerPostSlug: 'owner',
        expectedPostRevision: owner.json().revision,
        title: 'Retained',
        language: 'text',
        file: 'retained.txt',
        createdAt: '2026-08-13',
        code: 'keep me\n',
      },
    });
    expect(created.statusCode, created.body).toBe(201);
    const updatedOwner = await app.inject({ method: 'GET', url: '/api/posts/owner' });
    const removed = await app.inject({
      method: 'POST',
      url: '/api/posts/owner/clips/retained/remove',
      headers: writeHeaders,
      payload: { expectedPostRevision: updatedOwner.json().revision, trashSource: false },
    });
    expect(removed.statusCode, removed.body).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/dashboard' })).json()).toMatchObject({
      orphanClips: [{ file: 'retained.txt', slug: 'retained' }],
    });
    await app.close();
    database.close();
  });

  it('validates a stored backup before applying it and exposes no one-step restore route', async () => {
    const { app, database } = await fixture();
    const created = await app.inject({ method: 'POST', url: '/api/backups', headers: writeHeaders });
    expect(created.statusCode, created.body).toBe(201);
    const backupId = created.json().id as string;

    const legacyRestore = await app.inject({
      method: 'POST',
      url: `/api/backups/${encodeURIComponent(backupId)}/restore`,
      headers: writeHeaders,
    });
    expect(legacyRestore.statusCode).toBe(404);

    const validated = await app.inject({
      method: 'POST',
      url: `/api/backups/${encodeURIComponent(backupId)}/validate`,
      headers: writeHeaders,
    });
    expect(validated.statusCode, validated.body).toBe(200);
    expect(validated.json()).toMatchObject({
      id: expect.any(String),
      manifest: { version: 1, files: expect.any(Array) },
    });
    const applied = await app.inject({
      method: 'POST',
      url: '/api/backups/apply',
      headers: writeHeaders,
      payload: { id: validated.json().id },
    });
    expect(applied.statusCode, applied.body).toBe(200);
    await app.close();
    database.close();
  });
  it('rejects a checksum-valid backup whose content violates semantic limits', async () => {
    vi.stubEnv('BLOG_MAX_MARKDOWN_BYTES', '256');
    const { app, database } = await fixture();
    const source = await mkdtemp(join(tmpdir(), 'admin-invalid-backup-'));
    roots.push(source);
    for (const name of ['blog', 'clips', 'images']) {
      await mkdir(join(source, name), { recursive: true });
    }
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
    await writeFile(join(source, 'blog', 'large.md'), markdown);
    const archive = join(source, 'invalid.zip');
    await createBackup({ contentRoot: source, outputPath: archive });
    const form = new FormData();
    form.append('file', new File([await readFile(archive)], 'invalid.zip', { type: 'application/zip' }));

    const response = await app.inject({
      method: 'POST',
      url: '/api/backups/validate',
      headers: writeHeaders,
      payload: form,
    });
    expect(response.statusCode, response.body).toBe(413);
    expect(response.json()).toMatchObject({ code: 'CONTENT_TOO_LARGE' });
    await app.close();
    database.close();
  });
  it('loads the latest persisted publish state on the dashboard after a restart', async () => {
    const { app, database } = await fixture();
    database.prepare(`
      INSERT INTO publish_job_state (
        id, status, content_hash, release_id, log,
        created_at, started_at, finished_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'persisted-job',
      'succeeded',
      'a'.repeat(64),
      'release-1',
      'persisted log\n',
      '2026-08-13T10:00:00.000Z',
      '2026-08-13T10:00:01.000Z',
      '2026-08-13T10:01:00.000Z',
    );

    const dashboard = await app.inject({ method: 'GET', url: '/api/dashboard' });
    expect(dashboard.statusCode).toBe(200);
    expect(dashboard.json()).toMatchObject({
      latestPublish: { id: 'persisted-job', status: 'succeeded', release: 'release-1' },
    });
    await app.close();
    database.close();
  });
  it('marks persisted active publish jobs as interrupted when routes restart', async () => {
    const root = await mkdtemp(join(tmpdir(), 'admin-publish-recovery-'));
    roots.push(root);
    const contentRoot = join(root, 'content');
    for (const name of ['blog', 'clips', 'images']) await mkdir(join(contentRoot, name), { recursive: true });
    const database = new DatabaseSync(':memory:');
    migrateAdminDatabase(database);
    database.exec(`
      CREATE TABLE publish_job_state (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        release_id TEXT,
        log TEXT NOT NULL,
        created_at TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT
      ) STRICT;
    `);
    database.prepare(`
      INSERT INTO publish_job_state (
        id, status, content_hash, release_id, log,
        created_at, started_at, finished_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'interrupted-job',
      'preparing',
      'b'.repeat(64),
      null,
      '',
      '2026-08-16T14:35:51.947Z',
      null,
      null,
    );

    const app = await buildServer({
      config: createAdminConfig({
        contentRoot,
        dataRoot: root,
        projectRoot: process.cwd(),
        publicOrigin: 'https://admin.blog.reaier.top',
        secureCookies: false,
      }),
      database,
      repository: createContentRepository({ root: contentRoot }),
      authOverride: async () => ({ adminId: 1, username: 'owner', csrfToken: 'csrf' }),
    });

    const response = await app.inject({ method: 'GET', url: '/api/publish/jobs/interrupted-job' });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toMatchObject({
      id: 'interrupted-job',
      status: 'failed',
      finishedAt: expect.any(String),
      log: ['Publish interrupted because the admin service restarted.'],
    });
    await app.close();
    database.close();
  });
  it('reports clipboard and image storage independently on the dashboard', async () => {
    const { app, database, contentRoot } = await fixture();
    await writeFile(join(contentRoot, 'clips', 'size-probe.txt'), '12345');
    await writeFile(join(contentRoot, 'images', 'size-probe.webp'), '1234567');

    const dashboard = await app.inject({ method: 'GET', url: '/api/dashboard' });

    expect(dashboard.statusCode, dashboard.body).toBe(200);
    expect(dashboard.json()).toMatchObject({
      clipStorageBytes: 5,
      imageStorageBytes: 7,
    });
    expect(dashboard.json().storageBytes).toBeGreaterThan(12);
    await app.close();
    database.close();
  });
  it('exposes dashboard, paged images and publish job collection endpoints', async () => {
    const { app, database } = await fixture();
    expect((await app.inject({ method: 'GET', url: '/api/dashboard' })).json()).toMatchObject({
      counts: { posts: 1, drafts: 1, clips: 0, images: 0 },
    });
    expect((await app.inject({ method: 'GET', url: '/api/images' })).json()).toMatchObject({ items: [], total: 0 });
    expect((await app.inject({ method: 'GET', url: '/api/publish/jobs' })).json()).toEqual([]);
    await app.close();
    database.close();
  });
});
