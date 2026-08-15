import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiConflictError } from '../api/client';
import { useConfirmDialog } from '../context/ConfirmDialogContext';
import { BlogDateField } from '../components/BlogDateField';
import { BlogSelect } from '../components/BlogSelect';
import { MarkdownEditor } from '../components/MarkdownEditor';
import { ErrorBlock, LoadingBlock } from '../components/ui';
import { useAutosave } from '../hooks/useAutosave';
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard';
import { automaticClipSlug, todayInShanghai } from '../lib/content-defaults';
import { clipLanguageOptions } from '../lib/languages';
import { reconcileSavedDraft } from '../lib/save-reconciliation';
import type { ClipDocument, ClipSaveInput } from '../types';

const emptyClip: ClipSaveInput = {
  slug: '',
  title: '',
  description: '',
  language: 'typescript',
  file: '',
  createdAt: todayInShanghai(),
  code: '',
};

function clipToInput(clip: ClipDocument): ClipSaveInput {
  return {
    slug: clip.slug,
    title: clip.title,
    description: clip.description,
    language: clip.language,
    file: clip.file,
    createdAt: clip.createdAt.slice(0, 10),
    updatedAt: clip.updatedAt?.slice(0, 10),
    code: clip.code,
  };
}


export function ClipEditorPage() {
  const confirmAction = useConfirmDialog();
  const { slug = 'new' } = useParams();
  const isNew = slug === 'new';
  const navigate = useNavigate();
  const [draft, setDraft] = useState<ClipSaveInput>(emptyClip);
  const [revision, setRevision] = useState('');
  const [references, setReferences] = useState<ClipDocument['references']>([]);
  const [loaded, setLoaded] = useState(isNew);
  const [loadError, setLoadError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState<{ current?: ClipDocument; revision?: string }>();
  const draftRef = useRef(draft);
  const revisionRef = useRef(revision);
  const persistedSlugRef = useRef<string | undefined>(isNew ? undefined : slug);
  const navigationBypassRef = useRef(false);
  draftRef.current = draft;

  const navigateWithoutPrompt = useCallback((to: string, options?: { replace?: boolean }) => {
    navigationBypassRef.current = true;
    navigate(to, options);
    window.setTimeout(() => {
      navigationBypassRef.current = false;
    }, 0);
  }, [navigate]);

  useEffect(() => {
    if (isNew) return;
    setLoaded(false);
    api.getClip(slug).then((clip) => {
      setDraft(clipToInput(clip));
      revisionRef.current = clip.revision;
      setRevision(clip.revision);
      persistedSlugRef.current = clip.slug;
      setReferences(clip.references);
      setLoaded(true);
    }).catch((reason) => setLoadError(reason instanceof Error ? reason.message : 'Clip 加载失败'));
  }, [isNew, slug]);

  const save = useCallback(async () => {
    const draftSnapshot = draftRef.current;
    if (!draftSnapshot.file) throw new Error('请填写源文件名');
    const persistedSlug = persistedSlugRef.current;
    const payload: ClipSaveInput = {
      ...draftSnapshot,
      slug: persistedSlug ?? automaticClipSlug(draftSnapshot.file),
      updatedAt: todayInShanghai(),
    };
    try {
      const saved = persistedSlug
        ? await api.saveClip(payload, revisionRef.current)
        : await api.createClip(payload);
      const normalized = clipToInput(saved);
      revisionRef.current = saved.revision;
      persistedSlugRef.current = saved.slug;
      setDraft((current) => reconcileSavedDraft(
        current,
        draftSnapshot,
        normalized,
        (left, right) => JSON.stringify(left) === JSON.stringify(right),
      ));
      setRevision(saved.revision);
      setReferences(saved.references);
      setConflict(undefined);
      if (!persistedSlug) navigate(`/clips/${encodeURIComponent(saved.slug)}`, { replace: true });
      return saved;
    } catch (reason) {
      if (reason instanceof ApiConflictError) {
        setConflict({
          current: reason.current as ClipDocument | undefined,
          revision: reason.revision,
        });
      }
      throw reason;
    }
  }, [navigateWithoutPrompt]);

  const canSave = loaded && Boolean(
    draft.file
    && draft.title
    && draft.language,
  );
  const autosave = useCallback(async () => { await save(); }, [save]);
  const { state, error, saveNow } = useAutosave(autosave, [draft], 2000, canSave);
  const confirmUnsavedNavigation = useCallback(() => confirmAction({
    eyebrow: 'Unsaved changes',
    title: '离开并放弃未保存的修改？',
    message: state === 'error'
      ? '最近一次自动保存失败。离开后，这些修改可能丢失。'
      : '内容仍在等待保存或正在保存。确认要离开当前编辑页吗？',
    confirmLabel: '离开页面',
    tone: 'danger',
  }), [confirmAction, state]);
  useUnsavedChangesGuard(
    state === 'dirty' || state === 'saving' || state === 'error',
    confirmUnsavedNavigation,
    navigationBypassRef,
  );
  const update = <K extends keyof ClipSaveInput>(key: K, value: ClipSaveInput[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };


  const deleteClip = async () => {
    if (references.length) {
      setMessage('该 Clip 仍被文章引用，请先从这些文章中移除引用。');
      return;
    }
    const accepted = await confirmAction({
      eyebrow: 'Delete source',
      title: '永久删除剪切内容？',
      message: `“${draft.title || draft.slug}”当前未被文章引用，删除后无法撤销。`,
      confirmLabel: '确认删除',
      tone: 'danger',
    });
    if (!accepted) return;
    setBusy(true);
    try {
      await api.deleteClip(draft.slug);
      navigateWithoutPrompt('/clips', { replace: true });
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '删除 Clip 失败');
    } finally {
      setBusy(false);
    }
  };

  if (!loaded && !loadError) return <LoadingBlock label="正在读取代码剪藏…" />;
  if (loadError) return <ErrorBlock message={loadError} />;

  return (
    <div className="editor-page clip-editor-page">
      <header className="editor-topline">
        <div className="editor-breadcrumb">
          <Link to="/clips">Clips</Link><span>/</span>
          <strong>{isNew ? '新剪藏' : draft.title || draft.slug}</strong>
        </div>
        <div className="save-cluster" aria-live="polite">
          <span className={`save-state state-${state}`}><i />{{
            idle: '尚未修改',
            dirty: '等待自动保存',
            saving: '正在保存',
            saved: '已保存',
            error: error || '保存失败',
          }[state]}</span>
          {!isNew && <a className="secondary-button" href={api.clipDownloadUrl(draft.slug)}>下载原文件</a>}
          <button className="primary-button" type="button" onClick={() => void saveNow()} disabled={!canSave || busy}>
            保存 <kbd>Ctrl S</kbd>
          </button>
        </div>
      </header>

      {message && <div className="inline-notice" role="status">{message}<button type="button" aria-label="关闭提示" onClick={() => setMessage(undefined)}>×</button></div>}

      {conflict && (
        <section className="conflict-banner" role="alert">
          <div><span className="conflict-mark">!</span><strong>内容版本冲突</strong><p>这个 Clip 在其他会话中被修改。</p></div>
          <div>
            <button className="secondary-button" type="button" onClick={() => {
              if (conflict.current) {
                setDraft(clipToInput(conflict.current));
                setRevision(conflict.revision || conflict.current.revision);
              }
              setConflict(undefined);
            }}>载入服务器版本</button>
            <button className="danger-button" type="button" onClick={() => {
              if (!conflict.revision) return;
              setConflict(undefined);
              void api.saveClip({ ...draft, updatedAt: todayInShanghai() }, conflict.revision).then((saved) => {
                setDraft(clipToInput(saved));
                setRevision(saved.revision);
              });
            }}>以本地版本覆盖</button>
          </div>
        </section>
      )}

      <div className="clip-editor-grid">
        <aside className="frontmatter-panel compact-info-panel">
          <div className="panel-heading"><span>01</span><div><p>Metadata</p><h1>剪切内容</h1></div></div>
          <div className="frontmatter-form editor-info-form">
            <label className="field"><span>标题</span><input value={draft.title} onChange={(event) => update('title', event.target.value)} /></label>
            {!isNew && <div className="field"><span>引用文章</span>{references.length ? <div className="resource-index">{references.map((reference) => <Link key={reference.postSlug} to={`/posts/${encodeURIComponent(reference.postSlug)}`}>{reference.postSlug}</Link>)}</div> : <small>当前未被任何文章引用，可独立保存或删除。</small>}</div>}
            <label className="field field-wide"><span>描述</span><textarea rows={5} value={draft.description} onChange={(event) => update('description', event.target.value)} /></label>
            <div className="field-pair">
              <div className="field"><span>语言</span><BlogSelect ariaLabel="语言" value={draft.language} options={clipLanguageOptions(draft.language)} onChange={(language) => update('language', language)} /></div>
              <div className="field"><span>建立日期</span><BlogDateField ariaLabel="建立日期" value={draft.createdAt} onChange={(value) => update('createdAt', value)} /></div>
            </div>
            <label className="field"><span>源文件名</span><input value={draft.file} disabled={!isNew} onChange={(event) => update('file', event.target.value.replace(/[\\/]/g, ''))} placeholder="example.ts" /></label>

            {!isNew && <div className="editor-actions"><button className="danger-text" type="button" onClick={() => void deleteClip()} disabled={busy || references.length > 0}>删除未引用剪切内容</button></div>}
          </div>
        </aside>
        <section className="writing-panel code-writing-panel">
          <header className="writing-toolbar"><div><span>02 · Source</span><h2>源码</h2></div><span className="language-label">{draft.language || 'plain text'}</span></header>
          <MarkdownEditor ariaLabel="Clip 源码编辑器" language={draft.language} value={draft.code} onChange={(code) => update('code', code)} onSave={() => void saveNow()} />
          <footer className="editor-foot"><span>{draft.code.split('\n').length} 行</span><span>{draft.code.length} 字符</span><span>UTF-8</span></footer>
        </section>
      </div>
    </div>
  );
}
