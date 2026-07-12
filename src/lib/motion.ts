export type PageKind = 'home' | 'posts' | 'article' | 'taxonomy' | 'about' | 'default';

export interface MotionProfile {
  enabled: boolean;
  fps: 0 | 30 | 60;
  dpr: number;
  intensity: number;
}

const intensity: Record<PageKind, number> = {
  home: 1,
  posts: 0.7,
  article: 0.3,
  taxonomy: 0.6,
  about: 0.55,
  default: 0.45,
};

const staticAssetExtension =
  /\.(?:avif|bmp|css|eot|gif|ico|jpe?g|js|json|map|mjs|mp3|mp4|ogg|otf|pdf|png|svg|ttf|webm|webmanifest|webp|woff2?)$/i;

export function resolvePageKind(path: string): PageKind {
  if (path === '/') return 'home';
  if (path === '/posts' || path === '/posts/') return 'posts';
  if (path.startsWith('/posts/')) return 'article';
  if (path.startsWith('/tags/') || path.startsWith('/archive/')) return 'taxonomy';
  if (path.startsWith('/about/')) return 'about';
  return 'default';
}

export function resolveMotionProfile(input: {
  mobile: boolean;
  reduced: boolean;
  pageKind: PageKind;
}): MotionProfile {
  if (input.reduced) return { enabled: false, fps: 0, dpr: 1, intensity: 0 };

  return {
    enabled: true,
    fps: input.mobile ? 30 : 60,
    dpr: input.mobile ? 1.25 : 1.75,
    intensity: intensity[input.pageKind],
  };
}

export function isEnhancedNavigation(input: {
  href: string;
  currentHref: string;
  origin: string;
  target: string;
  download: boolean;
  modified: boolean;
}) {
  if (input.modified || input.download || (input.target && input.target !== '_self')) return false;

  const url = new URL(input.href, input.origin);
  if (url.origin !== input.origin) return false;

  const currentUrl = new URL(input.currentHref, input.origin);
  if (url.hash && url.pathname === currentUrl.pathname && url.search === currentUrl.search) return false;

  const pathname = url.pathname.toLowerCase();
  const filename = pathname.slice(pathname.lastIndexOf('/') + 1);
  if (
    pathname === '/rss.xml' ||
    pathname === '/robots.txt' ||
    /^\/sitemap[^/]*\.xml$/.test(pathname) ||
    /^favicon(?:[.-]|$)/.test(filename) ||
    staticAssetExtension.test(pathname)
  ) {
    return false;
  }

  return true;
}

export function createFrameGate(fps: 30 | 60) {
  const interval = 1000 / fps;
  let previous = -Infinity;

  return (time: number) => {
    if (time - previous < interval) return false;
    previous = time;
    return true;
  };
}