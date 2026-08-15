import { mkdtemp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { applyBackup, createBackup, installContentReplacement, validateBackup } from '../admin/server/backups/service';
import { compileRedirects } from '../admin/server/redirects/service';

const paths: string[] = [];
async function temp(prefix: string) { const value = await mkdtemp(join(tmpdir(), prefix)); paths.push(value); return value; }
afterEach(async () => Promise.all(paths.splice(0).map((path) => rm(path, { recursive: true, force: true }))));

describe('backup restore', () => {
  it('validates checksums then replaces the entire content root with an automatic snapshot', async () => {
    const source = await temp('backup-source-');
    const target = await temp('backup-target-');
    const history = await temp('backup-history-');
    await mkdir(join(source, 'blog'), { recursive: true });
    await mkdir(join(source, 'clips'), { recursive: true });
    await mkdir(join(source, 'images'), { recursive: true });
    await writeFile(join(source, 'blog', 'new.md'), '# New\n');
    await writeFile(join(source, 'redirects.json'), '{}\n');
    await mkdir(join(target, 'blog'), { recursive: true });
    await writeFile(join(target, 'blog', 'old.md'), '# Old\n');
    const archive = join(source, '..', `${Date.now()}-restore.zip`); paths.push(archive);
    await createBackup({ contentRoot: source, outputPath: archive });

    const candidate = await validateBackup({ archivePath: archive, stagingRoot: join(history, 'staging') });
    expect(candidate.manifest.files.map((file) => file.path)).toContain('blog/new.md');

    const result = await applyBackup({ candidate, contentRoot: target, snapshotRoot: join(history, 'snapshots') });
    expect(await readFile(join(target, 'blog', 'new.md'), 'utf8')).toBe('# New\n');
    await expect(readFile(join(target, 'blog', 'old.md'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    expect(result.snapshotPath).toContain('snapshots');
    expect(await readFile(join(result.snapshotPath, 'blog', 'old.md'), 'utf8')).toBe('# Old\n');
  });

  it('restores the previous content root when the final switch fails', async () => {
    const parent = await temp('backup-switch-');
    const contentRoot = join(parent, 'content');
    const replacement = join(parent, '.replacement');
    await mkdir(join(contentRoot, 'blog'), { recursive: true });
    await mkdir(join(replacement, 'blog'), { recursive: true });
    await writeFile(join(contentRoot, 'blog', 'old.md'), '# Old\n');
    await writeFile(join(replacement, 'blog', 'new.md'), '# New\n');
    let renameCalls = 0;

    await expect(installContentReplacement({
      contentRoot,
      replacement,
      renamePath: async (source, target) => {
        renameCalls += 1;
        if (renameCalls === 2) throw new Error('simulated switch failure');
        await rename(source, target);
      },
    })).rejects.toThrow('simulated switch failure');

    expect(await readFile(join(contentRoot, 'blog', 'old.md'), 'utf8')).toBe('# Old\n');
    await expect(readFile(join(contentRoot, 'blog', 'new.md'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });
});

describe('redirect compiler', () => {
  it('creates exact 308 nginx rules and rejects loops or missing targets', () => {
    const output = compileRedirects({
      redirects: {
        '/posts/old/': '/posts/new/',
        '/clips/old.txt': '/clips/new.txt',
      },
      existingPaths: new Set(['/posts/new/', '/clips/new.txt']),
    });
    expect(output).toContain('location = /posts/old/ { return 308 /posts/new/; }');
    expect(output).toContain('location = /clips/old.txt { return 308 /clips/new.txt; }');
    expect(() => compileRedirects({ redirects: { '/a': '/b', '/b': '/a' }, existingPaths: new Set(['/a', '/b']) })).toThrow('loop');
    expect(() => compileRedirects({ redirects: { '/old': '/missing' }, existingPaths: new Set() })).toThrow('does not exist');
  });
});
