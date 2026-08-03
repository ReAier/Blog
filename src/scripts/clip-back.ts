const backSelector = '[data-clip-back]';

function enhanceClipBackLinks(): void {
  document.querySelectorAll<HTMLAnchorElement>(backSelector).forEach((link) => {
    if (link.dataset.clipBackEnhanced === 'true') return;
    link.dataset.clipBackEnhanced = 'true';

    link.addEventListener('click', (event) => {
      if (window.history.length > 1) {
        event.preventDefault();
        window.history.back();
      }
    });
  });
}

document.addEventListener('astro:page-load', enhanceClipBackLinks);
enhanceClipBackLinks();
