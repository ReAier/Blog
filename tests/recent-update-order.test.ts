import { describe, expect, it } from 'vitest';
import { sortPostsRecentlyUpdated } from '../src/lib/recent-updates';

describe('sortPostsRecentlyUpdated', () => {
  it('sorts by updated date with published date as a fallback without mutating the source', () => {
    const posts = [
      { data: { publishedAt: new Date('2026-07-30'), updatedAt: new Date('2026-08-01') } },
      { data: { publishedAt: new Date('2026-07-10'), updatedAt: new Date('2026-08-03') } },
      { data: { publishedAt: new Date('2026-08-02') } },
    ];

    const sorted = sortPostsRecentlyUpdated(posts);

    expect(sorted.map((post) => post.data.publishedAt.toISOString().slice(0, 10))).toEqual([
      '2026-07-10',
      '2026-08-02',
      '2026-07-30',
    ]);
    expect(posts[0].data.publishedAt.toISOString()).toContain('2026-07-30');
  });
});
