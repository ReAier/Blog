import { execFile } from 'node:child_process';
import { access, readFile, readdir } from 'node:fs/promises';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const root = new URL('../', import.meta.url);
const read = (path: string) => readFile(new URL(path, root), 'utf8');

const placeholders = [
  'src/content/blog/.gitkeep',
  'src/content/clips/.gitkeep',
  'src/content/images/.gitkeep',
];

describe('private content repository policy', () => {
  it('ignores authored content while retaining directory placeholders', async () => {
    const ignore = await read('.gitignore');

    for (const directory of ['blog', 'clips', 'images']) {
      expect(ignore).toContain(`src/content/${directory}/**`);
      expect(ignore).toContain(`!src/content/${directory}/.gitkeep`);
    }

    await Promise.all(placeholders.map((path) => expect(access(new URL(path, root))).resolves.toBeUndefined()));
  });

  it.skipIf(process.env.BLOG_BUILD_SNAPSHOT === '1')('tracks only content directory placeholders', async () => {
    const { stdout } = await execFileAsync('git', ['ls-files', 'src/content'], {
      cwd: new URL('.', root),
    });
    const tracked = stdout.trim().split(/\r?\n/).filter(Boolean).sort();

    expect(tracked).toEqual([...placeholders].sort());
  });

  it('does not hard-code private article fixtures in active tests', async () => {
    const testsDirectory = new URL('tests/', root);
    const files = (await readdir(testsDirectory)).filter(
      (file) => file.endsWith('.test.ts') && file !== 'private-content-policy.test.ts',
    );
    const source = (await Promise.all(files.map((file) => read(`tests/${file}`)))).join('\n');

    for (const privatePath of [
      'src/content/blog/markdown-guide.md',
      'src/content/clips/astro.config.ts',
      'build-result.webp',
    ]) {
      expect(source).not.toContain(privatePath);
    }
  });

  it('documents that authored content is local-only', async () => {
    const readme = await read('README.md');
    expect(readme).toContain('内容仅保存在本机');
    expect(readme).toContain('src/content/blog/.gitkeep');
  });
});