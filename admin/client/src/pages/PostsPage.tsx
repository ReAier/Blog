import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { EmptyBlock, ErrorBlock, LoadingBlock, PageHeader, formatDate } from '../components/ui';
import { useApiResource } from '../hooks/useApiResource';

export function PostsPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagQuery, setTagQuery] = useState('');
  const [showTagFilter, setShowTagFilter] = useState(false);
  const [message, setMessage] = useState<string>();
  const importInput = useRef<HTMLInputElement>(null);
  const { data, loading, error, reload } = useApiResource(
    () => api.listPosts({
      query,
      status: status === 'all' ? undefined : status,
      tags: selectedTags.join(','),
    }),
    [query, selectedTags, status],
  );
  const availableTags = useMemo(
    () => [...new Set([...(data?.items.flatMap((post) => post.tags) ?? []), ...selectedTags])].sort(),
    [data, selectedTags],
  );
  const filteredTags = useMemo(() => {
    const search = tagQuery.trim().toLocaleLowerCase();
    return search ? availableTags.filter((tag) => tag.toLocaleLowerCase().includes(search)) : availableTags;
  }, [availableTags, tagQuery]);
  const counts = {
    all: data?.counts.all ?? 0,
    visible: data?.counts.published ?? 0,
    drafts: data?.counts.drafts ?? 0,
  };

  const importPost = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage(undefined);
    try {
      const imported = await api.importPost(file);
      setMessage(`已导入 ${file.name}`);
      navigate(`/posts/${encodeURIComponent(imported.slug)}`);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '文章导入失败');
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Story desk" title="文章" description="维护 frontmatter、正文、预览与每一次修订。" actions={<><input ref={importInput} className="visually-hidden-input" type="file" accept="text/markdown,.md" onChange={importPost} /><button className="secondary-button compact-action" type="button" onClick={() => importInput.current?.click()}>导入</button><Link className="primary-button" to="/posts/new">＋ 新建文章</Link></>} />
      {message && <div className="inline-notice" role="status">{message}<button type="button" aria-label="关闭提示" onClick={() => setMessage(undefined)}>×</button></div>}
      <section className="toolbar paper-strip" aria-label="文章筛选">
        <form className="search-field post-title-search" role="search" onSubmit={(event) => event.preventDefault()}><span aria-hidden="true">⌕</span><label className="sr-only" htmlFor="post-search">搜索文章标题</label><input id="post-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题" /></form>
        <div className="filter-tabs" aria-label="状态筛选">{[['all', `全部 ${counts.all}`], ['published', `已发布 ${counts.visible}`], ['draft', `草稿 ${counts.drafts}`]].map(([value, label]) => <button key={value} type="button" aria-pressed={status === value} className={status === value ? 'is-active' : ''} onClick={() => setStatus(value)}>{label}</button>)}</div>
        <div className="tag-filter-control">
          <button className="secondary-button compact-action" type="button" aria-expanded={showTagFilter} onClick={() => setShowTagFilter((open) => !open)}>筛选标签{selectedTags.length ? ` · ${selectedTags.length}` : ''}</button>
          {showTagFilter && <div className="tag-filter-popover"><label className="search-field"><span aria-hidden="true">⌕</span><span className="sr-only">搜索标签</span><input type="search" placeholder="搜索标签" value={tagQuery} onChange={(event) => setTagQuery(event.target.value)} /></label><div className="tag-option-grid">{filteredTags.length ? filteredTags.map((tag) => <button type="button" className="tag-option" aria-pressed={selectedTags.includes(tag)} key={tag} onClick={() => setSelectedTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag])}>{tag}</button>) : <p className="empty-inline">没有匹配的标签。</p>}</div><div className="dialog-actions"><button className="danger-text" type="button" disabled={!selectedTags.length} onClick={() => setSelectedTags([])}>清除筛选</button><button className="primary-button" type="button" onClick={() => setShowTagFilter(false)}>完成</button></div></div>}
        </div>
      </section>
      {loading ? <LoadingBlock /> : error ? <ErrorBlock message={error} onRetry={reload} /> : !data?.items.length ? <EmptyBlock title="没有找到稿件" detail="调整筛选条件，或者建立一篇新文章。" action={<Link className="primary-button" to="/posts/new">新建文章</Link>} /> : (
        <section className="data-table-wrap">
          <table className="data-table post-table" aria-label="文章列表">
            <thead><tr><th>稿件</th><th>状态</th><th>标签</th><th>最近修改</th></tr></thead>
            <tbody>{data.items.map((post) => (
              <tr key={post.slug}>
                <td><Link className="table-title row-stretched-link" to={`/posts/${encodeURIComponent(post.slug)}`} aria-label={`打开文章 ${post.title}`}><strong>{post.title}</strong><span>{post.slug}</span></Link></td>
                <td><span className={`status-pill ${post.draft ? 'status-draft' : 'status-live'}`}>{post.draft ? '草稿' : '已发布'}</span>{post.featured && <span className="featured-mark" title="首页精选">★</span>}</td>
                <td><div className="tag-row">{post.tags.slice(0, 3).map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div></td>
                <td>{formatDate(post.updatedAt || post.publishedAt)}</td>
              </tr>
            ))}</tbody>
          </table>
        </section>
      )}
    </div>
  );
}
