import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useConfirmDialog } from '../context/ConfirmDialogContext';
import { ErrorBlock, LoadingBlock, PageHeader, formatDate } from '../components/ui';
import { useApiResource } from '../hooks/useApiResource';
import type { PublishJob } from '../types';

const activeStatuses = new Set<PublishJob['status']>(['queued', 'validating', 'building', 'switching']);
const statusLabels: Record<PublishJob['status'], string> = {
  queued: '等待中',
  validating: '内容检查',
  building: '构建站点',
  switching: '切换版本',
  succeeded: '发布成功',
  failed: '发布失败',
};

export function PublishPage() {
  const confirmAction = useConfirmDialog();
  const [selectedId, setSelectedId] = useState<string>();
  const [job, setJob] = useState<PublishJob>();
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<string>();
  const [level, setLevel] = useState('');
  const { data: jobs, loading, error, reload } = useApiResource(() => api.listPublishJobs(), []);
  const { data: logs, reload: reloadLogs } = useApiResource(
    () => api.listLogs({ level: level || undefined }),
    [level],
  );

  useEffect(() => {
    const id = selectedId || jobs?.[0]?.id;
    if (!id) return;
    setSelectedId(id);
    let closed = false;
    let unsubscribe: () => void = () => undefined;

    void api.getPublishJob(id).then((current) => {
      if (closed) return;
      setJob(current);
      if (!activeStatuses.has(current.status)) {
        reloadLogs();
        return;
      }
      unsubscribe = api.subscribePublishJob(
        id,
        (next) => {
          if (closed) return;
          setJob(next);
          if (!activeStatuses.has(next.status)) {
            unsubscribe();
            reloadLogs();
            reload();
          }
        },
        () => {
          if (!closed) setMessage('无法继续接收发布日志，请稍后重新加载。');
        },
      );
    }).catch((reason) => {
      if (!closed) setMessage(reason instanceof Error ? reason.message : '发布任务加载失败');
    });

    return () => {
      closed = true;
      unsubscribe();
    };
  }, [jobs, reload, reloadLogs, selectedId]);

  const startPublish = async () => {
    const accepted = await confirmAction({
      eyebrow: 'Release control',
      title: '构建并切换线上版本？',
      message: '系统将从当前内容快照构建站点，验证通过后切换线上版本。',
      confirmLabel: '确认发布',
    });
    if (!accepted) return;
    setPublishing(true);
    setMessage(undefined);
    try {
      const next = await api.publish();
      setJob(next);
      setSelectedId(next.id);
      reload();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '无法启动发布');
    } finally {
      setPublishing(false);
    }
  };

  const progress = useMemo(() => ({
    queued: 10,
    validating: 30,
    building: 65,
    switching: 88,
    succeeded: 100,
    failed: 100,
  })[job?.status || 'queued'], [job]);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Production room"
        title="发布与日志"
        description="创建内容快照、跟踪完整构建，并检查管理端运行记录。"
        actions={(
          <button
            className="primary-button"
            type="button"
            disabled={publishing || Boolean(job && activeStatuses.has(job.status))}
            onClick={() => void startPublish()}
          >
            {publishing ? '正在排队…' : '↗ 发布新版本'}
          </button>
        )}
      />
      {message && (
        <div className="inline-notice" role="status">
          {message}
          <button type="button" aria-label="关闭提示" onClick={() => setMessage(undefined)}>×</button>
        </div>
      )}
      <section className="release-stage" aria-live="polite">
        <div className="release-heading">
          <div>
            <span className="eyebrow">Current operation</span>
            <h2>{job ? statusLabels[job.status] : '等待下一次发布'}</h2>
            <p>{job ? `任务 ${job.id} · ${formatDate(job.startedAt)}` : '发布会先校验内容，再构建并原子切换版本。'}</p>
          </div>
          <div className={`release-stamp status-${job?.status ?? 'idle'}`}>
            {job?.status === 'succeeded' ? 'LIVE' : job?.status === 'failed' ? 'FAILED' : 'READY'}
          </div>
        </div>
        <div className="release-progress"><span style={{ width: `${progress}%` }} /></div>
        <ol className="release-steps">
          <li className={job ? 'done' : ''}><b>01</b>快照</li>
          <li className={job && job.status !== 'queued' ? 'done' : ''}><b>02</b>校验</li>
          <li className={job && ['building', 'switching', 'succeeded'].includes(job.status) ? 'done' : ''}><b>03</b>构建</li>
          <li className={job?.status === 'succeeded' ? 'done' : ''}><b>04</b>切换</li>
        </ol>
      </section>
      <div className="logs-layout">
        <aside className="job-list paper-card">
          <header className="card-heading"><div><span>History</span><h2>发布记录</h2></div></header>
          {loading ? <LoadingBlock /> : error ? <ErrorBlock message={error} onRetry={reload} /> : jobs?.map((item) => (
            <button
              type="button"
              key={item.id}
              className={selectedId === item.id ? 'is-active' : ''}
              onClick={() => { setSelectedId(item.id); setJob(item); }}
            >
              <span className={`job-dot status-${item.status}`} />
              <span><strong>{statusLabels[item.status]}</strong><small>{formatDate(item.startedAt)}</small></span>
              <code>{item.release || item.contentHash?.slice(0, 8) || item.id.slice(0, 8)}</code>
            </button>
          ))}
        </aside>
        <section className="terminal-card">
          <header><div className="terminal-lights" aria-hidden="true"><i /><i /><i /></div><strong>publish.log</strong><span>{job?.log.length || 0} lines</span></header>
          <pre tabIndex={0}>{job?.log.length ? job.log.join('\n') : '$ 等待发布任务输出…'}</pre>
        </section>
      </div>
      <section className="paper-card system-logs">
        <header className="card-heading">
          <div><span>Operations</span><h2>系统日志</h2></div>
          <label className="compact-select">级别
            <select value={level} onChange={(event) => setLevel(event.target.value)}>
              <option value="">全部</option>
              <option value="info">信息</option>
              <option value="warn">警告</option>
              <option value="error">错误</option>
            </select>
          </label>
        </header>
        <div className="log-table" role="log" aria-live="polite">
          {logs?.items.length ? logs.items.map((entry) => (
            <div className={`log-row level-${entry.level}`} key={entry.id}>
              <time>{formatDate(entry.timestamp)}</time>
              <span>{entry.level.toUpperCase()}</span>
              <code>{entry.scope}</code>
              <p>{entry.message}</p>
            </div>
          )) : <p className="muted-copy">暂无系统日志。</p>}
        </div>
      </section>
    </div>
  );
}
