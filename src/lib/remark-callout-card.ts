import { fromMarkdown } from 'mdast-util-from-markdown';

interface MarkdownNode {
  type: string;
  lang?: string | null;
  value?: string;
  children?: MarkdownNode[];
}

interface CalloutDefinition {
  title: string;
  body: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function parseCalloutDefinition(value: string): CalloutDefinition {
  const [firstLine = '', ...bodyLines] = value.split(/\r?\n/);
  const titleMatch = /^title:\s*(.*)$/.exec(firstLine);

  if (!titleMatch) {
    throw new Error('Callout first line must use the "title: value" format.');
  }

  const title = titleMatch[1].trim();
  if (!title) {
    throw new Error('Callout title must not be empty.');
  }

  const body = bodyLines.join('\n').trim();
  if (!body) {
    throw new Error('Callout body is required.');
  }

  return { title, body };
}

function renderCalloutNodes(definition: CalloutDefinition): MarkdownNode[] {
  const parsedBody = fromMarkdown(definition.body) as MarkdownNode;
  transformNode(parsedBody);

  return [
    {
      type: 'html',
      value: `<details class="callout-card glass" data-callout-card>
  <summary class="callout-card__summary">
    <span class="callout-card__icon" aria-hidden="true">!</span>
    <span class="callout-card__title">${escapeHtml(definition.title)}</span>
    <span class="callout-card__chevron" aria-hidden="true"></span>
  </summary>
  <div class="callout-card__content">`,
    },
    ...(parsedBody.children ?? []),
    {
      type: 'html',
      value: '</div>\n</details>',
    },
  ];
}

function transformNode(node: MarkdownNode): void {
  if (!node.children) return;

  node.children = node.children.flatMap((child) => {
    if (child.type === 'code' && child.lang === 'callout') {
      return renderCalloutNodes(parseCalloutDefinition(child.value ?? ''));
    }

    transformNode(child);
    return [child];
  });
}

export function remarkCalloutCards() {
  return (tree: MarkdownNode) => transformNode(tree);
}