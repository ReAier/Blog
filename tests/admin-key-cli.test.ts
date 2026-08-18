import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('admin key CLI', () => {
  it('reports the exact database receiving a newly created key', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'aier-admin-key-cli-'));
    roots.push(dataRoot);
    const result = spawnSync(process.execPath, [
      '--import', 'tsx', 'admin/cli/key.ts', 'create',
      '--role', 'owner', '--expires', 'permanent', '--name', 'Recovery owner',
    ], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, BLOG_ADMIN_DATA_ROOT: dataRoot },
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(`Admin database: ${dataRoot}/state/admin.sqlite`);
    expect(result.stdout).toMatch(/er-[A-Za-z0-9_-]{43}/);
    const databaseBytes = await readFile(join(dataRoot, 'state', 'admin.sqlite'));
    expect(databaseBytes.length).toBeGreaterThan(0);
  });
});

