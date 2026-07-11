import { describe, expect, it } from 'vitest';
import { collectTags, estimateReadingMinutes, sortPostsNewestFirst } from '../src/lib/content';

describe('estimateReadingMinutes', () => {
  it('returns at least one minute for empty content', () => {
    expect(estimateReadingMinutes('')).toBe(1);
  });

  it('counts Chinese content by visible characters', () => {
    expect(estimateReadingMinutes('你'.repeat(800), 400)).toBe(2);
  });
});

describe('sortPostsNewestFirst', () => {
  it('sorts by published date without mutating the source array', () => {
    const posts = [
      { data: { publishedAt: new Date('2026-01-01') } },
      { data: { publishedAt: new Date('2026-07-11') } },
    ];
    const sorted = sortPostsNewestFirst(posts);
    expect(sorted[0].data.publishedAt.toISOString()).toContain('2026-07-11');
    expect(posts[0].data.publishedAt.toISOString()).toContain('2026-01-01');
  });
});

describe('collectTags', () => {
  it('deduplicates tags case-insensitively while preserving the first label', () => {
    const posts = [
      { data: { tags: ['AI', '建站'] } },
      { data: { tags: ['ai', 'Astro'] } },
    ];
    expect(collectTags(posts)).toEqual([
      { name: 'AI', count: 2 },
      { name: 'Astro', count: 1 },
      { name: '建站', count: 1 },
    ]);
  });
});
