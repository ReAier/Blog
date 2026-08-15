import { describe, expect, it } from 'vitest';
import {
  automaticClipSlug,
  automaticPostSlug,
  todayInShanghai,
} from '../admin/client/src/lib/content-defaults';

describe('admin automatic content metadata', () => {
  it('derives readable article slugs and falls back for non-Latin titles', () => {
    const now = new Date('2026-08-15T04:34:56.789Z');
    expect(automaticPostSlug('Astro Admin Notes', now)).toBe('astro-admin-notes');
    expect(automaticPostSlug('算法状态', now)).toBe('post-20260815-123456-789');
  });

  it('derives clip slugs from source file names without manual input', () => {
    const now = new Date('2026-08-15T04:34:56.789Z');
    expect(automaticClipSlug('Fenwick Tree.cpp', now)).toBe('fenwick-tree');
    expect(automaticClipSlug('算法.cpp', now)).toBe('clip-20260815-123456-789');
  });

  it('formats the current Shanghai calendar date', () => {
    expect(todayInShanghai(new Date('2026-08-14T16:01:00.000Z'))).toBe('2026-08-15');
  });
});
