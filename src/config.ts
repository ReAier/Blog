import { ACCENTS } from './lib/preferences';

export const SITE = {
  title: "Aier's blogs",
  mark: 'AIER.',
  description: 'Aier 的技术笔记、工程实践与独立思考。',
  tagline: '关于技术、AI 与持续构建',
  author: 'Aier',
  locale: 'zh-CN',
  url: 'http://blog.reaier.top',
  navigation: [
    { label: '首页', href: '/' },
    { label: '文章', href: '/posts/' },
    { label: '标签', href: '/tags/' },
    { label: '归档', href: '/archive/' },
    { label: '关于', href: '/about/' },
    { label: 'RSS', href: '/rss.xml' },
  ],
  accents: ACCENTS,
} as const;
