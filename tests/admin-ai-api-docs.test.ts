import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('AI REST API documentation', () => {
  it('documents token lifecycle, scopes, OpenAPI, concurrency, limits and the publish boundary', async () => {
    const [readme, guide, admin, architecture, environment] = await Promise.all([
      readFile('README.md', 'utf8'),
      readFile('docs/ai-api.md', 'utf8'),
      readFile('docs/admin-backend.md', 'utf8'),
      readFile('docs/architecture.md', 'utf8'),
      readFile('.env.example', 'utf8'),
    ]);

    expect(readme).toContain('[AI REST API](docs/ai-api.md)');
    expect(readme).toContain('npm run admin:key -- create');
    expect(readme).not.toContain('npm run admin:init');
    expect(admin).toContain('Admin database:');
    expect(admin).toContain('--data-root /var/lib/aier-blog');
    expect(admin).toContain('PowerShell');
    expect(architecture).toContain('`er-`');
    expect(architecture).toContain('`ai-`');
    expect(environment).not.toContain('ADMIN_MASTER_KEY');
    for (const value of [
      'ai-',
      'posts:read',
      'posts:write',
      'clips:read',
      'clips:write',
      'images:read',
      'images:write',
      '/api/v1/openapi.json',
      'If-Match',
      '428 PRECONDITION_REQUIRED',
      '409 REVISION_CONFLICT',
      '每个 Token 每分钟 120 次',
      '每个 Token 每分钟 20 次',
      '不能发布',
    ]) {
      expect(guide).toContain(value);
    }
    expect(admin).toContain('[AI REST API usage](ai-api.md)');
    expect(admin).not.toContain('run a full preview');
    expect(architecture).toContain('OpenAPI 3.1');
    expect(architecture).toContain('机器 API 只能读写文章、独立代码片段和图片');
  });
});
