import { isEnhancedNavigation, resolvePageKind } from '../lib/motion';

const ARTICLE_SELECTOR = '.prose h2[id], .prose h3[id]';

function onAbort(signal: AbortSignal, cleanup: () => void) {
  signal.addEventListener('abort', cleanup, { once: true });
}

function scheduleFrame(callback: () => void) {
  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      callback();
    });
  };
  return {
    schedule,
    cancel: () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    },
  };
}

export function initializeMotionPage(): () => void {
  const controller = new AbortController();
  const { signal } = controller;
  const pageKind = resolvePageKind(location.pathname);
  document.body.dataset.pageKind = pageKind;

  const shell = document.querySelector<HTMLElement>('[data-motion-shell]');
  const veil = document.querySelector<HTMLElement>('[data-transition-veil]');
  const progress = document.querySelector<HTMLElement>('[data-reading-progress]');
  const status = document.querySelector<HTMLElement>('[data-motion-status]');
  const nav = document.querySelector<HTMLElement>('[data-site-nav]');
  const navIndicator = document.querySelector<HTMLElement>('[data-nav-indicator]');
  const menuTrigger = document.querySelector<HTMLButtonElement>('[data-menu-trigger]');

  if (shell) shell.dataset.pageKind = pageKind;

  const revealTargets = [...document.querySelectorAll<HTMLElement>('[data-reveal]')];
  if ('IntersectionObserver' in window && revealTargets.length) {
    const revealObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        (entry.target as HTMLElement).dataset.revealed = 'true';
        revealObserver.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealTargets.forEach((target) => revealObserver.observe(target));
    onAbort(signal, () => revealObserver.disconnect());
  } else {
    revealTargets.forEach((target) => { target.dataset.revealed = 'true'; });
  }

  if (pageKind === 'article' && progress) {
    const updateProgress = () => {
      const scrollable = document.documentElement.scrollHeight - innerHeight;
      const value = scrollable > 0 ? Math.min(1, Math.max(0, scrollY / scrollable)) : 0;
      progress.style.setProperty('--reading-progress', String(value));
    };
    const progressFrame = scheduleFrame(updateProgress);
    addEventListener('scroll', progressFrame.schedule, { passive: true, signal });
    addEventListener('resize', progressFrame.schedule, { passive: true, signal });
    onAbort(signal, progressFrame.cancel);
    updateProgress();
  } else {
    progress?.style.setProperty('--reading-progress', '0');
  }

  const tocLinks = [...document.querySelectorAll<HTMLAnchorElement>('[data-toc-link]')];
  const headings = [...document.querySelectorAll<HTMLElement>(ARTICLE_SELECTOR)];
  if ('IntersectionObserver' in window && tocLinks.length && headings.length) {
    const linkById = new Map(tocLinks.map((link) => [decodeURIComponent(link.hash.slice(1)), link]));
    const visible = new Map<string, IntersectionObserverEntry>();
    const updateCurrent = () => {
      const candidates = [...visible.values()]
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => Math.abs(a.boundingClientRect.top - 120) - Math.abs(b.boundingClientRect.top - 120));
      const current = candidates[0]?.target as HTMLElement | undefined;
      tocLinks.forEach((link) => link.removeAttribute('aria-current'));
      if (current) linkById.get(current.id)?.setAttribute('aria-current', 'location');
    };
    const tocObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => visible.set((entry.target as HTMLElement).id, entry));
      updateCurrent();
    }, { rootMargin: '-96px 0px -68% 0px', threshold: [0, 1] });
    headings.forEach((heading) => tocObserver.observe(heading));
    onAbort(signal, () => tocObserver.disconnect());
  }

  const closeMenu = () => {
    if (nav) nav.dataset.open = 'false';
    menuTrigger?.setAttribute('aria-expanded', 'false');
  };
  menuTrigger?.addEventListener('click', () => {
    const open = nav?.dataset.open !== 'true';
    if (nav) nav.dataset.open = String(open);
    menuTrigger.setAttribute('aria-expanded', String(open));
    if (open) requestAnimationFrame(positionNavIndicator);
  }, { signal });
  nav?.addEventListener('click', (event) => {
    if ((event.target as Element | null)?.closest('a')) closeMenu();
  }, { signal });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  }, { signal });

  const positionNavIndicator = () => {
    const current = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !navIndicator || !current) {
      navIndicator?.style.setProperty('--nav-w', '0px');
      return;
    }
    const navRect = nav.getBoundingClientRect();
    const currentRect = current.getBoundingClientRect();
    navIndicator.style.setProperty('--nav-x', `${currentRect.left - navRect.left}px`);
    navIndicator.style.setProperty('--nav-w', `${currentRect.width}px`);
  };
  const navFrame = scheduleFrame(positionNavIndicator);
  addEventListener('resize', navFrame.schedule, { passive: true, signal });
  onAbort(signal, navFrame.cancel);
  positionNavIndicator();

  document.addEventListener('pointerdown', (event) => {
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest<HTMLAnchorElement>('a[href]');
    if (!link || !veil || !isEnhancedNavigation({
      href: link.href,
      currentHref: location.href,
      origin: location.origin,
      target: link.target,
      download: link.hasAttribute('download'),
      modified: event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0,
    })) return;
    veil.style.setProperty('--veil-x', `${event.clientX}px`);
    veil.style.setProperty('--veil-y', `${event.clientY}px`);
  }, { signal });

  let transitionFallback = 0;
  document.addEventListener('astro:before-preparation', () => {
    document.documentElement.dataset.transitioning = 'true';
    closeMenu();
    clearTimeout(transitionFallback);
    transitionFallback = window.setTimeout(() => {
      document.documentElement.dataset.transitioning = 'false';
    }, 1200);
  }, { signal });
  onAbort(signal, () => clearTimeout(transitionFallback));

  document.documentElement.dataset.transitioning = 'false';
  if (status) status.textContent = `${document.title} 已加载`;

  return () => controller.abort();
}

let cleanup = () => {};
const boot = () => {
  cleanup();
  cleanup = initializeMotionPage();
};

document.addEventListener('astro:page-load', boot);
boot();
