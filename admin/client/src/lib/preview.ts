const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

function inlineMarkdown(value: string) {
  return value
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

function renderMarkdown(markdown: string) {
  const escaped = escapeHtml(markdown.replaceAll('\r\n', '\n'));
  const lines = escaped.split('\n');
  const output: string[] = [];
  let paragraph: string[] = [];
  let code: string[] | null = null;
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) output.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) output.push(`<ul>${list.map((item) => `<li>${inlineMarkdown(item)}</li>`).join('')}</ul>`);
    list = [];
  };

  for (const line of lines) {
    if (line.startsWith('```')) {
      flushParagraph();
      flushList();
      if (code) {
        output.push(`<pre><code>${code.join('\n')}</code></pre>`);
        code = null;
      } else {
        code = [];
      }
      continue;
    }
    if (code) {
      code.push(line);
      continue;
    }
    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      output.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    const listItem = /^[-*]\s+(.+)$/.exec(line);
    if (listItem) {
      flushParagraph();
      list.push(listItem[1]);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    paragraph.push(line.trim());
  }
  flushParagraph();
  flushList();
  if (code) output.push(`<pre><code>${code.join('\n')}</code></pre>`);
  return output.join('\n');
}

export function buildInstantPreview(markdown: string) {
  const content = renderMarkdown(markdown);
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root{color-scheme:light;font-family:Georgia,'Noto Serif CJK SC','Songti SC',serif;color:#292722;background:#f8f2e7}body{margin:0;padding:clamp(22px,5vw,64px);line-height:1.75}article{max-width:760px;margin:auto}h1,h2,h3,h4{line-height:1.2;margin:1.8em 0 .65em;color:#1e1d1a}h1{font-size:2.25rem;border-bottom:3px double #d76b54;padding-bottom:.35em}a{color:#a83f2d;text-decoration-thickness:2px;text-underline-offset:3px}code{font-family:'Cascadia Code','SFMono-Regular',monospace;background:#eae1d3;padding:.12em .32em;border-radius:3px}pre{background:#262521;color:#f8f2e7;padding:18px;overflow:auto;border-left:4px solid #d76b54}pre code{background:none;padding:0}p,li{font-size:1.04rem}strong{color:#a83f2d}</style>
</head>
<body><article>${content || '<p>开始写作后，即时预览会在这里出现。</p>'}</article></body>
</html>`;
}


function safeStyleText(value: string): string {
  return value.replaceAll('</style', '<\\/style');
}

export function buildInstantPreviewDocument(
  renderedHtml: string,
  siteCss: string,
  katexCss: string,
): string {
  return `<!doctype html>
<html lang="zh-CN" data-theme="dark" data-accent="rose" data-background="default">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base href="/">
<style>${safeStyleText(siteCss)}</style>
<style>${safeStyleText(katexCss)}</style>
<style>
html,body{min-height:100%}.instant-preview-main{padding:clamp(20px,4vw,46px) 0 72px}.instant-preview-layout{grid-template-columns:minmax(0,var(--reading));justify-content:center}.instant-preview-layout>.prose{min-width:0}.instant-preview-empty{color:var(--muted)}
</style>
</head>
<body data-page-kind="article">
<div class="page-background" aria-hidden="true"></div>
<main class="site-main instant-preview-main">
  <div class="article-layout container instant-preview-layout">
    <div class="prose">${renderedHtml || '<p class="instant-preview-empty">\u5f00\u59cb\u5199\u4f5c\u540e\uff0c\u5373\u65f6\u9884\u89c8\u4f1a\u5728\u8fd9\u91cc\u51fa\u73b0\u3002</p>'}</div>
  </div>
</main>
</body>
</html>`;
}
