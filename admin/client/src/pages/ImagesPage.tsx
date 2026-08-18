import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Dialog } from '../components/Dialog';
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
import { createImageMarkdown } from '../lib/editor-actions';

export function ImagesPage() {
  const confirmAction = useConfirmDialog();
  const [query, setQuery] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string>();
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string>();
  const messageTimerRef = useRef<number | undefined>(undefined);
  const [lastTrashId, setLastTrashId] = useState<string>();
  const { data, loading, error, reload } = useApiResource(
    () => api.listImages({ query }),
    [query],
  );

  useEffect(() => () => {
    if (messageTimerRef.current !== undefined) window.clearTimeout(messageTimerRef.current);
  }, []);

  const showTransientMessage = (value: string) => {
    if (messageTimerRef.current !== undefined) window.clearTimeout(messageTimerRef.current);
    setMessage(value);
    messageTimerRef.current = window.setTimeout(() => {
      setMessage((current) => current === value ? undefined : current);
      messageTimerRef.current = undefined;
    }, 3_000);
  };

  const openUpload = () => {
    setSelectedFiles([]);
    setUploadError(undefined);
    setShowUpload(true);
  };

  const closeUpload = () => {
    if (uploading) return;
    setShowUpload(false);
  };

  const upload = async () => {
    if (!selectedFiles.length) {
      setUploadError('请选择至少一张图片。');
      return;
    }

    setUploading(true);
    setUploadError(undefined);
    try {
      for (const file of selectedFiles) await api.uploadImage(file);
      setMessage('已上传 ' + selectedFiles.length + ' 张图片。');
      setShowUpload(false);
      setSelectedFiles([]);
      reload();
    } catch (reason) {
      setUploadError(reason instanceof Error ? reason.message : '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const copy = async (markdown: string) => {
    await navigator.clipboard.writeText(markdown);
    showTransientMessage('Markdown 已复制到剪贴板。');
  };

  const remove = async (id: string, name: string) => {
    const accepted = await confirmAction({
      eyebrow: 'Delete image',
      title: '删除这张图片？',
      message: `“${name}”将移入统一回收站，可从设置中恢复。文章中的错误引用会在发布时报告。`,
      confirmLabel: '移入回收站',
      tone: 'danger',
    });
    if (!accepted) return;
    try {
      const result = await api.deleteImage(id);
      setLastTrashId(result.trashId);
      setMessage('图片已移入回收站，可立即撤销。');
      reload();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '删除失败');
    }
  };

  const restore = async () => {
    if (!lastTrashId) return;
    await api.restoreImage(lastTrashId);
    setLastTrashId(undefined);
    setMessage('图片已恢复。');
    reload();
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Visual archive"
        title="图片库"
        description="上传 JPEG、PNG 或 WebP；服务端会纠正方向、压缩并统一转为 WebP。"
        actions={(
          <button
            className="primary-button"
            type="button"
            disabled={uploading}
            onClick={openUpload}
          >
            {uploading ? '正在处理…' : '↑ 上传图片'}
          </button>
        )}
      />
      {message && (
        <div className="inline-notice" role="status">
          {message}
          {lastTrashId && <button type="button" onClick={() => void restore()}>撤销删除</button>}
          <button type="button" aria-label="关闭提示" onClick={() => setMessage(undefined)}>×</button>
        </div>
      )}
      <section className="toolbar paper-strip image-filter-toolbar" aria-label="图片筛选">
        <label className="search-field">
          <span aria-hidden="true">⌕</span>
          <span className="sr-only">搜索图片</span>
          <input
            type="search"
            placeholder="搜索图片名"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </section>
      {loading ? <LoadingBlock label="正在读取图片索引…" /> : error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : !data?.items.length ? (
        <EmptyBlock title="图片库还是空的" detail="点击上传图片，添加第一张图片。" />
      ) : (
        <section className="image-grid">
          {data.items.map((image) => {
            const markdown = createImageMarkdown({
              alt: image.originalName || image.name,
              path: image.publicUrl,
            });
            return (
              <article className="image-card" key={image.id}>
                <div className="image-frame">
                  <img src={image.url} alt={image.originalName || image.name} loading="lazy" />
                </div>
                <div className="image-meta">
                  <h2>{image.originalName || image.name}</h2>
                  <p>{image.width} × {image.height} · {formatBytes(image.byteSize)}</p>
                  <p>{formatDate(image.createdAt)}</p>
                </div>
                <footer>
                  <button className="image-card-action image-card-copy" type="button" onClick={() => void copy(markdown)}>复制 Markdown</button>
                  <button
                    className="image-card-action image-card-delete"
                    type="button"
                    onClick={() => void remove(image.id, image.originalName || image.name)}
                  >
                    删除
                  </button>
                </footer>
              </article>
            );
          })}
        </section>
      )}

      {showUpload && (
        <ImageUploadDialog
          files={selectedFiles}
          error={uploadError}
          uploading={uploading}
          onFilesChange={(files) => {
            setSelectedFiles(files);
            setUploadError(undefined);
          }}
          onClose={closeUpload}
          onSubmit={upload}
        />
      )}
    </div>
  );
}

interface ImageUploadDialogProps {
  files: File[];
  error?: string;
  uploading: boolean;
  onFilesChange: (files: File[]) => void;
  onClose: () => void;
  onSubmit: () => Promise<void>;
}

function ImageUploadDialog({
  files,
  error,
  uploading,
  onFilesChange,
  onClose,
  onSubmit,
}: ImageUploadDialogProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const selectFiles = (event: ChangeEvent<HTMLInputElement>) => {
    onFilesChange(Array.from(event.target.files ?? []));
  };

  return (
    <Dialog
      className="image-upload-dialog"
      ariaLabelledBy="image-upload-title"
      initialFocusRef={fileInput}
      closeOnBackdrop={!uploading}
      closeOnEscape={!uploading}
      onClose={onClose}
    >
      <header>
        <div>
          <span className="eyebrow">Image intake</span>
          <h2 id="image-upload-title">上传图片</h2>
        </div>
        <button type="button" aria-label="关闭上传窗口" disabled={uploading} onClick={onClose}>×</button>
      </header>
      <div className="picker-list">
        <form className="image-upload-form" onSubmit={(event) => { event.preventDefault(); void onSubmit(); }}>
       <label className="upload-strip image-upload-dropzone">
            <input
              ref={fileInput}
              className="visually-hidden-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={uploading}
              onChange={selectFiles}
            />
            <span aria-hidden="true">＋</span>
            <strong>{files.length ? '重新选择图片' : '选择图片'}</strong>
            <small>JPEG、PNG 或 WebP，可一次选择多张</small>
          </label>

          {!!files.length && (
            <section className="selected-file-list" aria-label="已选择的图片">
              <header><strong>已选择 {files.length} 张</strong><button type="button" disabled={uploading} onClick={() => fileInput.current?.click()}>更换</button></header>
              <ul>
                {files.map((file) => (
                  <li key={file.name + '-' + file.lastModified}>
                    <span>{file.name}</span>
                    <small>{formatBytes(file.size)}</small>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {error && <p className="inline-alert image-upload-error" role="alert">{error}</p>}

          <footer className="editor-actions image-upload-actions">
            <button className="secondary-button" type="button" disabled={uploading} onClick={onClose}>取消</button>
            <button className="primary-button" type="submit" disabled={uploading}>
              {uploading ? '正在上传…' : files.length ? '上传 ' + files.length + ' 张图片' : '确认上传'}
            </button>
          </footer>
        </form>
      </div>

    </Dialog>
  );
}
