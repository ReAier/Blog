const copyLabels = {
  success: '已复制 ✓',
  error: '复制失败',
  unsupported: '浏览器不支持',
} as const;

function enhanceClipCopy() {
  document.querySelectorAll<HTMLButtonElement>('[data-copy-clip]:not([data-clip-copy-enhanced])').forEach((button) => {
    button.setAttribute('data-clip-copy-enhanced', '');
    const idleLabel = button.textContent?.trim() || '复制代码';
    const status = button.parentElement?.querySelector<HTMLElement>('[data-copy-status]');
    let resetTimer = 0;

    const setState = (state: keyof typeof copyLabels | 'idle', announcement: string) => {
      button.dataset.copyState = state;
      button.textContent = state === 'idle' ? idleLabel : copyLabels[state];
      if (status) status.textContent = announcement;
    };

    const reset = () => {
      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => setState('idle', ''), 1600);
    };

    button.addEventListener('click', async () => {
      if (!navigator.clipboard?.writeText) {
        setState('unsupported', '当前浏览器不支持自动复制，请打开代码页后手动复制。');
        return;
      }

      const rawUrl = button.dataset.rawUrl;
      if (!rawUrl) return;

      try {
        const response = await fetch(rawUrl);
        if (!response.ok) throw new Error(`Request failed: ${response.status}`);
        await navigator.clipboard.writeText(await response.text());
        setState('success', '代码已复制到剪贴板。');
        reset();
      } catch {
        setState('error', '复制失败，请打开代码页后手动复制。');
      }
    });
  });
}

document.addEventListener('astro:page-load', enhanceClipCopy);
enhanceClipCopy();