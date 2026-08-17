import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { SectionCard } from '../components/AppShell';
import { ErrorBlock, LoadingBlock, PageHeader, formatBytes, formatDate } from '../components/ui';
import { useApiResource } from '../hooks/useApiResource';

export function DashboardPage() {
  const { data, loading, error, reload } = useApiResource(() => api.dashboard(), []);

  if (loading) return <LoadingBlock label="正在汇总今日编辑进度…" />;
  if (error || !data) return <ErrorBlock message={error || '工作台数据不可用'} onRetry={reload} />;

  const stats = [
    { label: '全部文章', value: data.counts.posts, detail: `${data.counts.drafts} 篇草稿`, mark: '文' },
    { label: '剪切板', value: data.counts.clips, detail: '独立复用内容', mark: '</>' },
    { label: '图片资产', value: data.counts.images, detail: formatBytes(data.storageBytes), mark: '▧' },
    { label: '最近发布', value: data.latestPublish?.status === 'succeeded' ? '正常' : data.latestPublish?.status ?? '暂无', detail: data.latestPublish ? formatDate(data.latestPublish.startedAt) : '尚无记录', mark: '↗' },
  ];

  return (
    <div className="page-stack dashboard-page">
      <PageHeader
        eyebrow="Morning edition"
        title="今日编辑台"
        description="从草稿到上线，所有内容工作在一处完成。"
        actions={<Link className="primary-button" to="/posts/new">＋ 新建文章</Link>}
      />
      <section className="stat-grid" aria-label="内容统计">
        {stats.map((stat, index) => (
          <article className="stat-card" key={stat.label}>
            <span className="stat-index">0{index + 1}</span>
            <span className="stat-mark" aria-hidden="true">{stat.mark}</span>
            <strong>{stat.value}</strong>
            <h2>{stat.label}</h2>
            <p>{stat.detail}</p>
          </article>
        ))}
      </section>
      <div className="dashboard-grid">
        <SectionCard title="最近稿件" eyebrow="Recent desk" action={<Link className="text-link" to="/posts">查看全部 →</Link>}>
          <div className="story-list">
            {data.recentPosts.length ? data.recentPosts.slice(0, 6).map((post, index) => (
              <Link className="story-row" key={post.slug} to={`/posts/${encodeURIComponent(post.slug)}`}>
                <span className="story-number">{String(index + 1).padStart(2, '0')}</span>
                <span className="story-main"><strong>{post.title}</strong><small>{post.slug} · {formatDate(post.updatedAt || post.publishedAt)}</small></span>
                <span className={`status-pill ${post.draft ? 'status-draft' : 'status-live'}`}>{post.draft ? '草稿' : '已发布'}</span>
              </Link>
            )) : <p className="muted-copy">还没有稿件。从第一篇文章开始。</p>}
          </div>
        </SectionCard>
        <SectionCard title="发布脉搏" eyebrow="Production" className="publish-pulse">
          <div className={`publish-orbit status-${data.latestPublish?.status ?? 'idle'}`} aria-hidden="true"><span /></div>
          <div className="pulse-copy">
            <strong>{data.latestPublish ? ({
              preparing: '正在准备快照', queued: '等待发布', validating: '正在检查', building: '正在构建', switching: '正在切换', succeeded: '线上版本正常', failed: '最近发布失败',
            })[data.latestPublish.status] : '尚未执行发布'}</strong>
            <p>{data.latestPublish?.release ? `当前版本 ${data.latestPublish.release}` : '准备好后前往发布台生成新版本。'}</p>
            <Link className="secondary-button" to="/publish">打开发布台</Link>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
