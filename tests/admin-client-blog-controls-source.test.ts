import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function normalizeSource(value: string) {
  return value.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
}

async function source(relativePath: string) {
  return normalizeSource(await readFile(join(process.cwd(), 'admin', 'client', 'src', relativePath), 'utf8'));
}

describe('blog-styled form control integration', () => {
  it('uses a neutral API token example and the shared themed select', async () => {
    const security = await source('pages/SecurityPage.tsx');

    expect(security).toContain("import { BlogSelect } from '../components/BlogSelect'");
    expect(security).toContain('例如：文章草稿助手');
    expect(security).not.toContain('Claude');
    expect(security).not.toMatch(/<select[\s>]/);
    expect(security).toContain('<div className="field">\n            <span>有效期</span>');
  });

  it('replaces every native admin date input with the shared themed date field', async () => {
    const files = await Promise.all([
      source('pages/PostEditorPage.tsx'),
      source('pages/ClipEditorPage.tsx'),
      source('components/ClipImportDialog.tsx'),
    ]);

    for (const file of files) {
      expect(file).toContain('BlogDateField');
      expect(file).not.toContain('type="date"');
      expect(file).not.toMatch(/<label[^>]*>[\s\S]{0,160}<BlogDateField/);
    }
  });
  it('uses the shared themed select for every clip language control', async () => {
    const files = await Promise.all([
      source('pages/ClipsPage.tsx'),
      source('pages/ClipEditorPage.tsx'),
      source('components/ClipImportDialog.tsx'),
    ]);

    for (const file of files) {
      expect(file).toContain('BlogSelect');
      expect(file).not.toMatch(/<select[\s>]/);
    }
  });

});
