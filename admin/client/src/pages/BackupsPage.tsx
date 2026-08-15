import { useRef, useState, type ChangeEvent } from 'react';
import { api } from '../api/client';
import { useConfirmDialog } from '../context/ConfirmDialogContext';
import {
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  formatBytes,
  formatDate,
} from '../components/ui';
import { useApiResource } from '../hooks/useApiResource';

export function BackupsPage() {
  const confirmAction = useConfirmDialog();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [candidate, setCandidate] = useState<{ id: string; fileCount: number }>();
  const { data, loading, error, reload } = useApiResource(() => api.listBackups(), []);

  const create = async () => {
    setBusy('create');
    setMessage(undefined);
    try {
      const backup = await api.createBackup();
      setMessage(`备份 ${backup.name} 已创建。`);
      reload();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '创建失败');
    } finally {
      setBusy(undefined);
    }
  };

  const validateStored = async (id: string, name: string) => {
    setBusy(id);
    setCandidate(undefined);
    try {
      const result = await api.validateStoredBackup(id);
      setCandidate({ id: result.id, fileCount: result.manifest.files.length });
      setMessage(`${name} \u6821\u9a8c\u901a\u8fc7\uff0c\u5171 ${result.manifest.files.length} \u4e2a\u5185\u5bb9\u6587\u4ef6\u3002`);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '\u5907\u4efd\u6821\u9a8c\u5931\u8d25');
    } finally {
      setBusy(undefined);
    }
  };

  const validateUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy('validate');
    setCandidate(undefined);
    try {
      const result = await api.validateBackup(file);
      setCandidate({ id: result.id, fileCount: result.manifest.files.length });
      setMessage(`ZIP 校验通过，共 ${result.manifest.files.length} 个内容文件。`);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '备份校验失败');
    } finally {
      setBusy(undefined);
      event.target.value = '';
    }
  };

  const applyCandidate = async () => {
    if (!candidate) return;
    const accepted = await confirmAction({
      eyebrow: 'Restore workspace',
      title: '应用这份备份？',
      message: '已验证的 ZIP 将完整替换当前工作副本，并在恢复前创建旧内容快照。',
      confirmLabel: '确认应用',
      tone: 'danger',
    });
    if (!accepted) return;
    setBusy('apply');
    try {
      const result = await api.applyBackup(candidate.id);
      setMessage(`恢复完成；旧内容快照位于 ${result.snapshotPath}。`);
      setCandidate(undefined);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '应用备份失败');
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Archive room"
        title="备份"
        description="导出或验证包含文章、Clips、图片和重定向清单的全量 ZIP。"
        actions={(
          <>
            <input
              ref={fileInput}
              className="visually-hidden-input"
              type="file"
              accept="application/zip,.zip"
              onChange={validateUpload}
            />
            <button className="secondary-button" type="button" onClick={() => fileInput.current?.click()}>
              验证恢复 ZIP
            </button>
            <button className="primary-button" type="button" onClick={() => void create()} disabled={Boolean(busy)}>
              {busy === 'create' ? '正在归档…' : '＋ 创建备份'}
            </button>
          </>
        )}
      />
      {message && (
        <div className="inline-notice" role="status">
          {message}
          {candidate && (
            <button type="button" disabled={busy === 'apply'} onClick={() => void applyCandidate()}>
              确认应用 {candidate.fileCount} 个文件
            </button>
          )}
          <button type="button" aria-label="关闭提示" onClick={() => setMessage(undefined)}>×</button>
        </div>
      )}
      <section className="backup-principle">
        <span className="edition-seal">备</span>
        <div><h2>先验证，再替换</h2><p>恢复前自动保存当前全量快照；校验和、路径和体积限制均由服务端执行。</p></div>
        <ol><li><strong>01</strong> 上传并验证</li><li><strong>02</strong> 确认完整替换</li><li><strong>03</strong> 预览并重新发布</li></ol>
      </section>
      {loading ? <LoadingBlock label="正在读取归档目录…" /> : error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : !data?.length ? (
        <EmptyBlock title="还没有备份" detail="创建第一个内容归档，为后续发布保留安全锚点。" />
      ) : (
        <section className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>归档</th><th>创建时间</th><th>文件数</th><th>大小</th><th><span className="sr-only">操作</span></th></tr></thead>
            <tbody>{data.map((backup) => (
              <tr key={backup.id}>
                <td><strong>{backup.name}</strong><span className="cell-subtitle">{backup.id}</span></td>
                <td>{formatDate(backup.createdAt)}</td><td>{backup.fileCount}</td><td>{formatBytes(backup.byteSize)}</td>
                <td><div className="row-actions"><a className="row-action" href={backup.downloadUrl}>下载</a><button className="danger-text" type="button" disabled={Boolean(busy)} onClick={() => void validateStored(backup.id, backup.name)}>{busy === backup.id ? '\u6821\u9a8c\u4e2d\u2026' : '\u9a8c\u8bc1\u6062\u590d'}</button></div></td>
              </tr>
            ))}</tbody>
          </table>
        </section>
      )}
    </div>
  );
}
