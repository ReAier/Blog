import { useState } from 'react';
import { api } from '../api/client';
import { EmptyBlock, ErrorBlock, LoadingBlock, PageHeader, formatDate } from '../components/ui';
import { useConfirmDialog } from '../context/ConfirmDialogContext';
import { useApiResource } from '../hooks/useApiResource';
import type { TrashItem, TrashItemType } from '../types';

type TrashFilter = 'all' | TrashItemType;

const typeLabels: Record<TrashItemType, string> = {
  post: '文章',
  clip: '剪切内容',
  image: '图片',
};

export function TrashPage() {
  const confirmAction = useConfirmDialog();
  const { data, loading, error, reload } = useApiResource(() => api.listTrash(), []);
  const [restoringKey, setRestoringKey] = useState<string>();
  const [deletingKey, setDeletingKey] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [filter, setFilter] = useState<TrashFilter>('all');
  const items = data?.items ?? [];
  const counts: Record<TrashFilter, number> = {
    all: items.length,
    post: items.filter((item) => item.type === 'post').length,
    clip: items.filter((item) => item.type === 'clip').length,
    image: items.filter((item) => item.type === 'image').length,
  };
  const visibleItems = filter === 'all' ? items : items.filter((item) => item.type === filter);
  const filters: Array<{ value: TrashFilter; label: string }> = [
    { value: 'all', label: '全部' },
    { value: 'post', label: typeLabels.post },
    { value: 'clip', label: typeLabels.clip },
    { value: 'image', label: typeLabels.image },
  ];

  const permanentlyDelete = async (item: TrashItem) => {
    const accepted = await confirmAction({
      eyebrow: 'Permanent deletion',
      title: `彻底删除${typeLabels[item.type]}？`,
      message: `“${item.title}”删除后无法恢复，此操作不可撤销。`,
      confirmLabel: '永久删除',
      tone: 'danger',
    });
    if (!accepted) return;
    const key = `${item.type}:${item.id}`;
    setDeletingKey(key);
    setMessage(undefined);
    try {
      await api.deleteTrashItem(item.type, item.id);
      setMessage(`已彻底删除：${item.title}。`);
      reload();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '彻底删除失败');
    } finally {
      setDeletingKey(undefined);
    }
  };

  const restore = async (item: TrashItem) => {
    const accepted = await confirmAction({
      eyebrow: 'Restore content',
      title: `恢复${typeLabels[item.type]}？`,
      message: `“${item.title}”将恢复到原来的内容列表。`,
      confirmLabel: '确认恢复',
    });
    if (!accepted) return;
    setRestoringKey(`${item.type}:${item.id}`);
    setMessage(undefined);
    try {
      await api.restoreTrashItem(item.type, item.id);
      setMessage(`已恢复：${item.title}。`);
      reload();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '恢复失败');
    } finally {
      setRestoringKey(undefined);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Recovery"
        title="回收站"
        description="统一查看并恢复已删除的文章、剪切内容和图片。"
      />
      {message && <div className="inline-notice" role="status">{message}<button type="button" aria-label="关闭提示" onClick={() => setMessage(undefined)}>×</button></div>}
      {!loading && !error && !!items.length && (
        <section className="toolbar paper-strip" aria-label="回收站筛选">
          <div className="filter-tabs" aria-label="回收站类型筛选">
            {filters.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={filter === option.value}
                className={filter === option.value ? 'is-active' : ''}
                onClick={() => setFilter(option.value)}
              >
                {option.label} {counts[option.value]}
              </button>
            ))}
          </div>
        </section>
      )}
      {loading ? <LoadingBlock label="正在读取回收站…" /> : error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : !items.length ? (
        <EmptyBlock title="回收站是空的" detail="删除的文章、剪切内容和图片会统一出现在这里。" />
      ) : !visibleItems.length ? (
        <EmptyBlock title={`没有${filter === 'all' ? '内容' : typeLabels[filter]}`} detail="切换其他类型查看回收站内容。" />
      ) : (
        <section className="data-table-wrap">
          <table className="data-table trash-table" aria-label="回收站列表">
            <thead><tr><th>内容</th><th>类型</th><th>删除时间</th><th><span className="sr-only">操作</span></th></tr></thead>
            <tbody>{visibleItems.map((item) => (
              <tr key={`${item.type}-${item.id}`}>
                <td><span className="table-title"><strong>{item.title}</strong><span>{item.detail}</span></span></td>
                <td><span className="status-pill status-draft">{typeLabels[item.type]}</span></td>
                <td>{formatDate(item.deletedAt)}</td>
                <td className="row-action-cell">
                  <div className="trash-row-actions">
                    <button className="row-action" type="button" aria-label={`恢复 ${item.title}`} disabled={restoringKey === `${item.type}:${item.id}` || deletingKey === `${item.type}:${item.id}`} onClick={() => void restore(item)}>{restoringKey === `${item.type}:${item.id}` ? '恢复中…' : '恢复 →'}</button>
                    <button className="danger-text" type="button" aria-label={`彻底删除 ${item.title}`} disabled={restoringKey === `${item.type}:${item.id}` || deletingKey === `${item.type}:${item.id}`} onClick={() => void permanentlyDelete(item)}>{deletingKey === `${item.type}:${item.id}` ? '删除中…' : '彻底删除'}</button>
                  </div>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </section>
      )}
    </div>
  );
}
