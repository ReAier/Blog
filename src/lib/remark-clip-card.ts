import { formatClipBytes, loadClip, parseClipDefinition, type ClipRecord } from './clips';

interface MarkdownNode {
  type: string;
  lang?: string | null;
  value?: string;
  children?: MarkdownNode[];
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderClipCard(clip: ClipRecord): string {
  const title = escapeHtml(clip.title);
  const language = escapeHtml(clip.language);
  const description = clip.description ? `<p>${escapeHtml(clip.description)}</p>` : '';

  return `<aside class="clip-card glass" data-clip-card>
  <div class="clip-card__topline">
    <span class="clip-card__mark" aria-hidden="true">&lt;/&gt;</span>
    <span>${language}</span>
    <span>${clip.lineCount} 行</span>
    <span>${formatClipBytes(clip.byteSize)}</span>
  </div>
  <h3><a href="${clip.pageUrl}">${title}</a></h3>
  ${description}
  <div class="clip-card__actions">
    <a class="clip-action clip-action--primary" href="${clip.pageUrl}">查看完整代码</a>
    <button class="clip-action" type="button" data-copy-clip data-raw-url="${clip.rawUrl}" data-copy-state="idle" aria-label="复制代码">复制代码</button>
    <span class="sr-only" aria-live="polite" data-copy-status></span>
  </div>
</aside>`;
}

function transformNode(node: MarkdownNode): void {
  if (!node.children) return;

  node.children = node.children.map((child) => {
    if (child.type === 'code' && child.lang === 'clip') {
      const definition = parseClipDefinition(child.value ?? '');
      return {
        type: 'html',
        value: renderClipCard(loadClip(definition)),
      };
    }
    return child;
  });
}

export function remarkClipCards() {
  return (tree: MarkdownNode) => transformNode(tree);
}
