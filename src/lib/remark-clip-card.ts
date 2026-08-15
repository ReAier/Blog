import {
  formatClipBytes,
  loadClip,
  loadClipBySlug,
  parseClipDefinition,
  parseClipReference,
  type ClipRecord,
} from './clips';

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
  <h3><a href="${clip.pageUrl}" target="_blank" rel="noopener noreferrer">${title} <span aria-hidden="true">↗</span></a></h3>
  ${description}
</aside>`;
}

function transformNode(node: MarkdownNode, clipsRoot?: string): void {
  if (!node.children) return;
  node.children = node.children.map((child) => {
    if (child.type === 'code' && child.lang === 'clip') {
      const value = child.value ?? '';
      const slug = parseClipReference(value);
      const clip = slug
        ? loadClipBySlug(slug, clipsRoot)
        : loadClip(parseClipDefinition(value), clipsRoot);
      return { type: 'html', value: renderClipCard(clip) };
    }
    return child;
  });
}

export function remarkClipCards(options: { clipsRoot?: string } = {}) {
  return (tree: MarkdownNode) => transformNode(tree, options.clipsRoot);
}
