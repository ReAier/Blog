import { useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useConfirmDialog } from '../context/ConfirmDialogContext';
import { BlogSelect } from '../components/BlogSelect';
import { ClipImportDialog, type ClipImportFields } from '../components/ClipImportDialog';
import { EmptyBlock, ErrorBlock, LoadingBlock, PageHeader, formatDate } from '../components/ui';
import { useApiResource } from '../hooks/useApiResource';
import {
  CLIP_IMPORT_ACCEPT,
  clipLanguageLabel,
  detectClipLanguage,
} from '../lib/languages';

function shanghaiDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function emptyImportFields(): ClipImportFields {
  return {
    title: '',
    description: '',
    language: 'text',
    createdAt: shanghaiDate(),
  };
}

export function ClipsPage() {
  const confirmAction = useConfirmDialog();
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState('');
  const [message, setMessage] = useState<string>();
  const [importBusy, setImportBusy] = useState(false);
  const [deletingSlug, setDeletingSlug] = useState<string>();
  const [importFile, setImportFile] = useState<File>();
  const [importFields, setImportFields] = useState<ClipImportFields>(emptyImportFields);
  const importInput = useRef<HTMLInputElement>(null);
  const { data, loading, error, reload } = useApiResource(
    () => api.listClips({ query, language }),
    [query, language],
  );
  const languages = data?.languages ?? [];

  const selectImportFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const detectedLanguage = detectClipLanguage(file.name);
    if (!detectedLanguage) {
      setImportFile(undefined);
      setImportFields(emptyImportFields());
      setMessage(`不支持文件类型：${file.name}。请选择受支持的源码或纯文本文件。`);
      event.target.value = '';
      return;
    }
    setMessage(undefined);
    setImportFile(file);
    setImportFields({
      ...emptyImportFields(),
      title: file.name.replace(/\.[^.]+$/, ''),
      language: detectedLanguage,
    });
  };

  const resetImport = () => {
    setImportFile(undefined);
    setImportFields(emptyImportFields());
    if (importInput.current) importInput.current.value = '';
  };

  const closeImport = () => {
    if (!importBusy) resetImport();
  };

  const importClip = async () => {
    if (!importFile || !importFields.title.trim() || !importFields.language) {
      setMessage('请选择源码文件，并填写标题和语言。');
      return;
    }
    setImportBusy(true);
    setMessage(undefined);
    try {
      await api.importClip(importFile, {
        title: importFields.title.trim(),
        description: importFields.description.trim(),
        language: importFields.language,
        createdAt: importFields.createdAt,
      });
      setMessage(`已导入剪切内容：${importFile.name}。`);
      resetImport();
      reload();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '剪切内容导入失败');
    } finally {
      setImportBusy(false);
    }
  };

  const deleteClip = async (slug: string, title: string) => {
    const accepted = await confirmAction({
      eyebrow: 'Delete source',
      title: '删除剪切内容？',
      message: `“${title}”将移入统一回收站，可从设置中恢复。`,
      confirmLabel: '移入回收站',
      tone: 'danger',
    });
    if (!accepted) return;
    setDeletingSlug(slug);
    setMessage(undefined);
    try {
      await api.deleteClip(slug);
      setMessage(`已将剪切内容移入回收站：${title}。`);
      reload();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '剪切内容删除失败');
    } finally {
      setDeletingSlug(undefined);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Code library"
        title="剪切板"
        description="管理可独立复用的代码与文本剪切内容。"
        actions={(
          <>
            <input
              ref={importInput}
              className="visually-hidden-input"
              type="file"
              accept={CLIP_IMPORT_ACCEPT}
              onChange={selectImportFile}
            />
            <button className="secondary-button compact-action" type="button" onClick={() => importInput.current?.click()}>导入</button>
            <Link className="primary-button" to="/clips/new">＋ 新建剪切内容</Link>
          </>
        )}
      />
      {message && <div className="inline-notice" role="status">{message}<button type="button" aria-label="关闭提示" onClick={() => setMessage(undefined)}>×</button></div>}
      <section className="toolbar paper-strip" aria-label="剪切板筛选">
        <form className="search-field post-title-search" role="search" onSubmit={(event) => event.preventDefault()}>
          <span aria-hidden="true">⌕</span><label className="sr-only" htmlFor="clip-search">搜索剪切板文件名</label>
          <input id="clip-search" type="search" placeholder="按文件名搜索" value={query} onChange={(event) => setQuery(event.target.value)} />
        </form>
        <div className="compact-select">
          <span>语言</span>
          <BlogSelect
            ariaLabel="语言"
            value={language}
            options={[
              { value: '', label: '全部' },
              ...languages.map((item) => ({ value: item, label: clipLanguageLabel(item) })),
            ]}
            onChange={setLanguage}
          />
        </div>
      </section>
      {loading ? <LoadingBlock /> : error ? <ErrorBlock message={error} onRetry={reload} /> : !data?.items.length ? (
        <EmptyBlock title="剪切板还是空的" detail="把经常复用的实现整理为独立剪切内容。" action={<Link className="primary-button" to="/clips/new">新建剪切内容</Link>} />
      ) : (
        <section className="editorial-resource-list clip-resource-list" aria-label="剪切板列表">
          {data.items.map((clip) => (
            <article className="editorial-resource-row clip-resource-row" key={clip.slug}>
              <Link className="editorial-resource-link" to={`/clips/${encodeURIComponent(clip.slug)}`} aria-label={`打开剪切内容 ${clip.title}`}>
                <span className="editorial-resource-meta">
                  <span>{formatDate(clip.updatedAt)}</span>
                  <small>最近修改</small>
                </span>
                <span className="editorial-resource-main">
                  <strong className="editorial-resource-title">{clip.title}</strong>
                  <small className="editorial-resource-detail">{clip.file}</small>
                </span>
                <span className="editorial-resource-aside">
                  <span className="language-label">{clipLanguageLabel(clip.language)}</span>
                </span>
              </Link>
              <div className="editorial-resource-actions">
                <button className="danger-text clip-row-delete" type="button" aria-label={`删除 ${clip.title}`} disabled={deletingSlug === clip.slug} onClick={() => void deleteClip(clip.slug, clip.title)}>{deletingSlug === clip.slug ? '删除中…' : '删除'}</button>
              </div>
            </article>
          ))}
        </section>      )}
      {importFile && (
        <ClipImportDialog
          file={importFile}
          fields={importFields}
          busy={importBusy}
          onChange={setImportFields}
          onSubmit={() => void importClip()}
          onClose={closeImport}
        />
      )}
    </div>
  );
}
