import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { SITE } from '../config';
import { sortPostsNewestFirst } from '../lib/content';

export async function GET(context: { site?: URL }) {
  const posts = sortPostsNewestFirst((await getCollection('blog')).filter((post) => !post.data.draft));
  return rss({
    title: SITE.title,
    description: SITE.description,
    site: context.site ?? SITE.url,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.publishedAt,
      link: `/posts/${post.id}/`,
      categories: post.data.tags,
    })),
  });
}
