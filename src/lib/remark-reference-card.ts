interface MarkdownNode {
  type: string;
  lang?: string | null;
  value?: string;
  children?: MarkdownNode[];
}

interface ReferenceCardFields {
  url: string;
  title: string;
  description?: string;
}

const allowedFields = new Set(['url', 'title', 'description']);

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function parseReferenceFields(value: string): ReferenceCardFields {
  const fields = new Map<string, string>();
  const lines = value.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const match = /^([a-z]+)\s*:\s*(.*)$/.exec(line);
    if (!match) {
      throw new Error('Each reference line must use the "key: value" format.');
    }

    const [, key, fieldValue] = match;

    if (!allowedFields.has(key)) {
      throw new Error(`Unknown reference field "${key}".`);
    }
    if (fields.has(key)) {
      throw new Error(`Duplicate reference field "${key}".`);
    }
    if (!fieldValue) {
      throw new Error(`Reference ${key} must not be empty.`);
    }

    fields.set(key, fieldValue);
  }

  const url = fields.get('url');
  const title = fields.get('title');
  if (!url) throw new Error('Reference url is required.');
  if (!title) throw new Error('Reference title is required.');

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('Reference url must be an absolute http or https URL.');
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('Reference url must be an absolute http or https URL.');
  }

  return {
    url: parsedUrl.href,
    title,
    description: fields.get('description'),
  };
}

function renderReferenceCard(fields: ReferenceCardFields): string {
  const parsedUrl = new URL(fields.url);
  const url = escapeHtml(fields.url);
  const title = escapeHtml(fields.title);
  const source = escapeHtml(parsedUrl.hostname);
  const description = fields.description
    ? `<p class="reference-card__description">${escapeHtml(fields.description)}</p>`
    : '';
  const ariaLabel = '访问原文（在新标签页打开）';

  return `<aside class="reference-card glass" data-reference-card>
  <div class="reference-card__source">
    <span class="reference-card__mark" aria-hidden="true">↗</span>
    <span>${source}</span>
  </div>
  <h3 class="reference-card__title"><a href="${url}" target="_blank" rel="noopener noreferrer">${title}</a></h3>
  ${description}
  <a class="reference-card__action" href="${url}" target="_blank" rel="noopener noreferrer" aria-label="${ariaLabel}">访问原文 <span aria-hidden="true">↗</span></a>
</aside>`;
}

function transformNode(node: MarkdownNode): void {
  if (!node.children) return;

  node.children = node.children.map((child) => {
    if (child.type === 'code' && child.lang === 'reference') {
      return {
        type: 'html',
        value: renderReferenceCard(parseReferenceFields(child.value ?? '')),
      };
    }
    transformNode(child);
    return child;
  });
}

export function remarkReferenceCards() {
  return (tree: MarkdownNode) => transformNode(tree);
}
