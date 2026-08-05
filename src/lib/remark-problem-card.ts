interface MarkdownNode {
  type: string;
  lang?: string | null;
  value?: string;
  children?: MarkdownNode[];
}

const difficulties = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'black'] as const;
type ProblemDifficulty = (typeof difficulties)[number];

interface ProblemCardFields {
  code: string;
  title: string;
  url: string;
  difficulty: ProblemDifficulty;
  categories: string[];
}

const allowedFields = new Set(['code', 'title', 'url', 'difficulty', 'categories']);
const difficultySet = new Set<string>(difficulties);
function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function parseProblemFields(value: string): ProblemCardFields {
  const fields = new Map<string, string>();

  for (const rawLine of value.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const match = /^([a-z]+)\s*:\s*(.*)$/.exec(line);
    if (!match) {
      throw new Error('Each problem line must use the "key: value" format.');
    }

    const [, key, fieldValue] = match;
    if (!allowedFields.has(key)) {
      throw new Error(`Unknown problem field "${key}".`);
    }
    if (fields.has(key)) {
      throw new Error(`Duplicate problem field "${key}".`);
    }
    if (!fieldValue) {
      throw new Error(`Problem ${key} must not be empty.`);
    }

    fields.set(key, fieldValue);
  }

  const code = fields.get('code');
  const title = fields.get('title');
  const url = fields.get('url');
  const difficulty = fields.get('difficulty');
  const categoryValue = fields.get('categories');

  if (!code) throw new Error('Problem code is required.');
  if (!title) throw new Error('Problem title is required.');
  if (!url) throw new Error('Problem url is required.');
  if (!difficulty) throw new Error('Problem difficulty is required.');
  if (!categoryValue) throw new Error('Problem categories is required.');

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('Problem url must be an absolute http or https URL.');
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('Problem url must be an absolute http or https URL.');
  }

  if (!difficultySet.has(difficulty)) {
    throw new Error(`Problem difficulty must be one of: ${difficulties.join(', ')}.`);
  }

  const categories = [...new Set(categoryValue.split(/[,，]/).map((category) => category.trim()).filter(Boolean))];
  if (categories.length === 0) {
    throw new Error('Problem categories must contain at least one category.');
  }

  return {
    code,
    title,
    url: parsedUrl.href,
    difficulty: difficulty as ProblemDifficulty,
    categories,
  };
}

function getProblemPlatform(url: string): string {
  const hostname = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  const knownPlatforms: Record<string, string> = {
    'atcoder.jp': 'ATCODER',
    'codeforces.com': 'CODEFORCES',
    'leetcode.cn': 'LEETCODE',
    'leetcode.com': 'LEETCODE',
    'luogu.com.cn': 'LUOGU',
  };

  return knownPlatforms[hostname] ?? hostname;
}

function renderProblemCard(fields: ProblemCardFields): string {
  const title = escapeHtml(fields.title);
  const watermark = `<span class="problem-card__watermark" aria-hidden="true">${escapeHtml(fields.code)}</span>`;
  const url = escapeHtml(fields.url);
  const platform = escapeHtml(getProblemPlatform(fields.url));
  const categories = fields.categories
    .map((category) => `<li class="problem-card__category"># ${escapeHtml(category)}</li>`)
    .join('\n    ');

  return `<aside class="problem-card glass" data-problem-card data-difficulty="${fields.difficulty}">
  <a class="problem-card__platform" href="${url}" target="_blank" rel="noopener noreferrer" aria-label="在新标签页打开 ${platform} 题目">${platform} <span aria-hidden="true">↗</span></a>
  <h3 class="problem-card__title"><a class="problem-card__title-link" href="${url}" target="_blank" rel="noopener noreferrer">${title}</a></h3>
  <ul class="problem-card__categories" aria-label="题目分类">
    ${categories}
  </ul>
  ${watermark}
</aside>`;
}

function transformNode(node: MarkdownNode): void {
  if (!node.children) return;

  node.children = node.children.map((child) => {
    if (child.type === 'code' && child.lang === 'problem') {
      return {
        type: 'html',
        value: renderProblemCard(parseProblemFields(child.value ?? '')),
      };
    }

    transformNode(child);
    return child;
  });
}

export function remarkProblemCards() {
  return (tree: MarkdownNode) => transformNode(tree);
}
