interface MarkdownNode {
  type: string;
  lang?: string | null;
  value?: string;
  children?: MarkdownNode[];
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

export function remarkMermaid() {
  const transform = (node: MarkdownNode): void => {
    if (!node.children) return;
    node.children = node.children.map((child) => {
      if (child.type === 'code' && child.lang === 'mermaid') {
        return {
          type: 'html',
          value: `<figure class="mermaid-figure" data-mermaid="" aria-label="Mermaid 图表">
<pre data-mermaid-source><code>${escapeHtml(child.value ?? '')}</code></pre>
<div class="mermaid-output" data-mermaid-output></div>
<p class="mermaid-error" data-mermaid-error role="status" hidden></p>
</figure>`,
        };
      }
      transform(child);
      return child;
    });
  };
  return transform;
}
