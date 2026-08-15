import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useConfirmDialog } from '../context/ConfirmDialogContext';
import { EmptyBlock, ErrorBlock, LoadingBlock, PageHeader, formatDate } from '../components/ui';
import { useApiResource } from '../hooks/useApiResource';

export function PostsPage() {
  const confirmAction = useConfirmDialog();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [message, setMessage] = useState<string>();
  const importInput = useRef<HTMLInputElement>(null);
  const includeDeleted = status === 'deleted';
  const { data, loading, error, reload } = useApiResource(
    () => api.listPosts({
      query,
      status: status === 'all' || status === 'deleted' ? undefined : status,
      includeDeleted,
    }),
    [includeDeleted, query, status],
  );
  const visibleItems = useMemo(
    () => data?.items.filter((post) => status === 'deleted' ? post.deleted : !post.deleted) ?? [],
    [data, status],
  );
  const counts = useMemo(() => ({
    all: data?.items.filter((post) => !post.deleted).length ?? 0,
    visible: data?.items.filter((post) => !post.deleted && !post.draft).length ?? 0,
    drafts: data?.items.filter((post) => !post.deleted && post.draft).length ?? 0,
    deleted: data?.items.filter((post) => post.deleted).length ?? 0,
  }), [data]);

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

  const restorePost = async (slug: string, revision: string) => {
    const accepted = await confirmAction({
      eyebrow: 'Restore article',
      title: '恢复这篇文章？',
      message: `文章“${slug}”将从回收站恢复并重新出现在文章列表中。`,
      confirmLabel: '确认恢复',
    });
    if (!accepted) return;
    try {
      await api.restorePost(slug, revision);
      setMessage(`已恢复 ${slug}`);
      reload();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '文章恢复失败');
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Story desk"
        title="文章"
        description="维护 frontmatter、正文、预览与每一次修订。"
        actions={<><input ref={importInput} className="visually-hidden-input" type="file" accept="text/markdown,.md" onChange={importPost} /><button className="secondary-button compact-action" type="button" onClick={() => importInput.current?.click()}>导入</button><Link className="primary-button" to="/posts/new">＋ 新建文章</Link></>}
      />
      {message && <div className="inline-notice" role="status">{message}<button type="button" aria-label="关闭提示" onClick={() => setMessage(undefined)}>×</button></div>}
      <section className="toolbar paper-strip" aria-label="文章筛选">
        <form className="search-field" role="search" onSubmit={(event) => event.preventDefault()}>
          <span aria-hidden="true">⌕</span>
          <label className="sr-only" htmlFor="post-search">搜索文章</label>
          <input id="post-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、slug 或标签" />
        </form>
        <div className="filter-tabs" aria-label="状态筛选">
          {[
            ['all', `全部 ${counts.all}`],
            ['published', `已发布 ${counts.visible}`],
            ['draft', `草稿 ${counts.drafts}`],
            ['deleted', `回收站 ${counts.deleted}`],
          ].map(([value, label]) => (
            <button key={value} type="button" aria-pressed={status === value} className={status === value ? 'is-active' : ''} onClick={() => setStatus(value)}>{label}</button>
          ))}
        </div>
      </section>
      {loading ? <LoadingBlock /> : error ? <ErrorBlock message={error} onRetry={reload} /> : !visibleItems.length ? (
        <EmptyBlock title={status === 'deleted' ? '回收站是空的' : '没有找到稿件'} detail={status === 'deleted' ? '删除的 Markdown 会出现在这里，图片仍需单独管理。' : '调整筛选条件，或者建立一篇新文章。'} action={status !== 'deleted' ? <Link className="primary-button" to="/posts/new">新建文章</Link> : undefined} />
      ) : (
        <section className="data-table-wrap">
          <table className="data-table post-table">
            <thead><tr><th>稿件</th><th>状态</th><th>标签</th><th>最近修改</th><th><span className="sr-only">操作</span></th></tr></thead>
            <tbody>
              {visibleItems.map((post) => (
                <tr key={post.slug}>
                  <td>{post.deleted ? <span className="table-title"><strong>{post.title}</strong><span>{post.slug}</span></span> : <Link className="table-title" to={`/posts/${encodeURIComponent(post.slug)}`}><strong>{post.title}</strong><span>{post.slug}</span></Link>}</td>
                  <td><span className={`status-pill ${post.deleted ? 'status-failed' : post.draft ? 'status-draft' : 'status-live'}`}>{post.deleted ? '已删除' : post.draft ? '草稿' : '已发布'}</span>{post.featured && !post.deleted && <span className="featured-mark" title="首页精选">★</span>}</td>
                  <td><div className="tag-row">{post.tags.slice(0, 3).map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div></td>
                  <td>{formatDate(post.updatedAt || post.publishedAt)}</td>
                  <td>{post.deleted ? <button className="row-action" type="button" onClick={() => void restorePost(post.slug, post.revision)}>恢复 →</button> : <Link className="row-action" to={`/posts/${encodeURIComponent(post.slug)}`} aria-label={`编辑 ${post.title}`}>编辑 →</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
