export function estimateReadingMinutes(text: string, charsPerMinute = 400): number {
  const visibleCharacters = text.replace(/\s+/g, '').length;
  return Math.max(1, Math.ceil(visibleCharacters / charsPerMinute));
}

type DatedPost = { data: { publishedAt: Date } };

type TaggedPost = { data: { tags: string[] } };

export function sortPostsNewestFirst<T extends DatedPost>(posts: readonly T[]): T[] {
  return [...posts].sort(
    (left, right) => right.data.publishedAt.getTime() - left.data.publishedAt.getTime(),
  );
}

export function collectTags(posts: readonly TaggedPost[]): Array<{ name: string; count: number }> {
  const tags = new Map<string, { name: string; count: number }>();
  for (const post of posts) {
    for (const tag of post.data.tags) {
      const key = tag.toLocaleLowerCase('zh-CN');
      const current = tags.get(key);
      if (current) current.count += 1;
      else tags.set(key, { name: tag, count: 1 });
    }
  }
  return [...tags.values()].sort((left, right) => left.name.localeCompare(right.name, 'en'));
}
