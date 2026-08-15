import { resolveCoverUrl } from './image-paths';

interface MarkdownNode { type?: string; url?: string; children?: MarkdownNode[]; }

function transform(node: MarkdownNode): void {
  if (node.type === 'image' && node.url) node.url = resolveCoverUrl(node.url) ?? node.url;
  node.children?.forEach(transform);
}

export function remarkManagedImages() {
  return (tree: MarkdownNode) => transform(tree);
}
