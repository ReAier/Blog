import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('deployment shell safety', () => {
  it('keeps deployment shell scripts free of UTF-8 BOM bytes', async () => {
    for (const path of [
      'deployment/install-code.sh',
      'deployment/publish-worker.sh',
      'deployment/publish-release.sh',
    ]) {
      const bytes = await readFile(path);
      expect([...bytes.subarray(0, 3)]).not.toEqual([0xef, 0xbb, 0xbf]);
    }
  });
  it('exposes SSH system upgrades without retaining the old deploy command', async () => {
    const packageJson = JSON.parse(await readFile('package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(packageJson.scripts.upgrade).toBe('tsx scripts/upgrade.ts');
    expect(packageJson.scripts).not.toHaveProperty('deploy');
    expect(packageJson.scripts.test).toBe('vitest --configLoader runner');
  });

  it('guards previous-release resolution and removes the first-install link on rollback', async () => {
    const script = await readFile('deployment/install-code.sh', 'utf8');
    expect(script).toContain('PREVIOUS=""');
    expect(script).toMatch(/if \[\[ -L "\$CURRENT" \]\]; then\s+PREVIOUS=/);
    expect(script).toContain('"$PREVIOUS" != "$CURRENT"');
    expect(script).toContain('rm -f -- "$CURRENT"');
  });

  it('excludes local worktrees, agent metadata, logs, and environment files from code releases', async () => {
    const script = await readFile('scripts/upgrade.ts', 'utf8');
    for (const excluded of [
      '--exclude=.worktrees',
      '--exclude=.superpowers',
      '--exclude=*.log',
      '--exclude=.env*',
      '--exclude=.deploy-redirects.conf',
    ]) {
      expect(script).toContain(excluded);
    }
  });

  it('migrates persistent server content before validating it', async () => {
    const script = await readFile('deployment/install-code.sh', 'utf8');
    const migration = script.indexOf('admin:migrate-independent-assets');
    const validation = script.indexOf('admin:validate-content');
    expect(migration).toBeGreaterThan(-1);
    expect(validation).toBeGreaterThan(migration);
    expect(script).toContain('BLOG_ADMIN_DATA_ROOT=/var/lib/aier-blog');
    expect(script).toContain('sudo systemctl stop aier-blog-admin.service');
    expect(script).toContain('sudo cp -a -- "$CONTENT_ROOT" "$CONTENT_BACKUP"');
    expect(script).toContain('sudo cp -a -- "$CONTENT_BACKUP" "$CONTENT_ROOT.restore"');
  });
  it('normalizes copied public release ownership and permissions before switching', async () => {
    const script = await readFile('deployment/publish-release.sh', 'utf8');
    const copy = script.indexOf('cp -a -- "$DIST/." "$DESTINATION/"');
    const ownership = script.indexOf('chown -R root:root -- "$DESTINATION"');
    const directoryMode = script.indexOf('find "$DESTINATION" -type d -exec chmod 0755 {} +');
    const fileMode = script.indexOf('find "$DESTINATION" -type f -exec chmod 0644 {} +');
    const switchLink = script.lastIndexOf('mv -Tf -- "$NEXT_LINK" "$CURRENT_LINK"');

    expect(copy).toBeGreaterThan(-1);
    expect(ownership).toBeGreaterThan(copy);
    expect(directoryMode).toBeGreaterThan(ownership);
    expect(fileMode).toBeGreaterThan(directoryMode);
    expect(switchLink).toBeGreaterThan(fileMode);
  });
  it('leaves public release construction and switching to the admin publish worker', async () => {
    const installer = await readFile('deployment/install-code.sh', 'utf8');
    const worker = await readFile('deployment/publish-worker.sh', 'utf8');
    expect(installer).not.toContain('npm run build');
    expect(installer).not.toContain('admin:content-hash');
    expect(installer).not.toContain('aier-blog-publish-release');
    expect(worker).toContain('SWITCH_HELPER=/usr/local/sbin/aier-blog-publish-release');
  });

  it('waits for a slow admin startup before declaring the deployment unhealthy', async () => {
    const script = await readFile('deployment/install-code.sh', 'utf8');
    expect(script).toContain('for attempt in {1..30}');
    expect(script).toContain('ADMIN_HEALTHY=1');
    expect(script).toContain('[[ "$ADMIN_HEALTHY" == 1 ]]');
  });

  it('normalizes Windows archive permissions before running server installation', async () => {
    const script = await readFile('scripts/upgrade.ts', 'utf8');
    expect(script).toContain('-type d -exec chmod 0755 {} +');
    expect(script).toContain('-type f -exec chmod 0644 {} +');
    expect(script).toContain('/deployment/*.sh');
  });

  it('keeps Astro and Vite caches outside the shared node_modules tree', async () => {
    const config = await readFile('astro.config.ts', 'utf8');
    expect(config).toMatch(/output:\s*['"]static['"],\s*cacheDir:\s*['"]\.\/\.astro['"]/);
    expect(config).toMatch(/vite:\s*\{\s*cacheDir:\s*['"]\.astro\/vite['"]/);
    expect(config).not.toContain('node_modules/.astro');
    expect(config).not.toContain('node_modules/.vite');
  });
});
