import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

describe('tag article list contract', () => {
  it('uses the same semantic list and article component as the posts index', async () => {
    for (const path of ['src/pages/tags/[tag].astro', 'src/pages/posts/index.astro']) {
      const page = await read(path);

      expect(page).toContain("import PostListItem from '../../components/PostListItem.astro'");
      expect(page).toMatch(/<ol class="post-list">\s*\{posts\.map\(\(post\) => <PostListItem post=\{post\} \/>\)\}\s*<\/ol>/);
      expect(page).not.toContain('PostCard');
      expect(page).not.toContain('post-grid');
    }
  });

  it('retains tag headings, article counts, filtering and newest-first sorting', async () => {
    const page = await read('src/pages/tags/[tag].astro');

    expect(page).toContain('collectTags(posts).map((tag) =>');
    expect(page).toContain('<h1 class="page-title">#{tag}</h1>');
    expect(page).toContain('共 {posts.length} 篇文章。');
    expect(page).toContain('const posts = sortPostsNewestFirst(');
    expect(page).toContain('!post.data.draft && post.data.tags.some(');
    expect(page).toContain("item.toLocaleLowerCase('zh-CN') === tag.toLocaleLowerCase('zh-CN')");
  });

  it('keeps featured cards on the homepage and topic links on the tags index', async () => {
    const home = await read('src/pages/index.astro');
    const tags = await read('src/pages/tags/index.astro');

    expect(home).toContain('<div class="post-grid">{featured.map((post) => <PostCard');
    expect(tags).toContain('<ul class="tag-list">');
    expect(tags).toContain('href={`/tags/${encodeURIComponent(tag.name)}/`}');
  });
});
