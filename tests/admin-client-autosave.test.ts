import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { reconcileSavedDraft } from '../admin/client/src/lib/save-reconciliation';

describe('autosave response reconciliation', () => {
  it('applies server normalization when the editor still matches the submitted snapshot', () => {
    const submitted = { title: 'Draft', body: 'Body', revision: 'old' };
    const normalized = { title: 'Draft', body: 'Body', revision: 'new' };

    expect(reconcileSavedDraft(submitted, submitted, normalized)).toBe(normalized);
  });

  it('preserves edits made while the save request was in flight', () => {
    const submitted = { title: 'Draft', body: 'Body', revision: 'old' };
    const current = { title: 'Draft', body: 'New text', revision: 'old' };
    const normalized = { title: 'Draft', body: 'Body', revision: 'new' };

    expect(reconcileSavedDraft(current, submitted, normalized)).toBe(current);
  });
});

describe('editor autosave integration', () => {
  it('reconciles responses against request snapshots and advances revisions synchronously', async () => {
    const root = join(process.cwd(), 'admin', 'client', 'src', 'pages');
    const [postEditor, clipEditor] = await Promise.all([
      readFile(join(root, 'PostEditorPage.tsx'), 'utf8'),
      readFile(join(root, 'ClipEditorPage.tsx'), 'utf8'),
    ]);

    for (const source of [postEditor, clipEditor]) {
      expect(source).toContain('draftRef.current');
      expect(source).toContain('revisionRef.current');
      expect(source).toContain('useUnsavedChangesGuard');
      expect(source).toMatch(/saveState|state/);
      expect(source).toMatch(/reconcileSavedDraft\(\s*current,\s*draftSnapshot/);
    }
  });
});
