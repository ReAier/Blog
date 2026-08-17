import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiConflictError } from '../api/client';
import { useConfirmDialog } from '../context/ConfirmDialogContext';
import { MarkdownEditor, type MarkdownEditorHandle } from '../components/MarkdownEditor';
import { BlogDateField } from '../components/BlogDateField';
import { Dialog } from '../components/Dialog';
import { CoverPickerDialog, TagPickerDialog } from '../components/PostMetadataPickers';
import { ErrorBlock, LoadingBlock, formatDate } from '../components/ui';
import { useAutosave } from '../hooks/useAutosave';
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard';
import { automaticPostSlug, todayInShanghai } from '../lib/content-defaults';
import { createImageMarkdown, imageAssetMatchesPath } from '../lib/editor-actions';
import { reconcileSavedDraft } from '../lib/save-reconciliation';
import type {
  ClipSummary,
  ImageAsset,
  PostDocument,
  PostFrontmatter,
  PostHistoryEntry,
  PostHistoryRevision,
  PostSaveInput,
} from '../types';

const emptyFrontmatter: PostFrontmatter = {
  title: '',
  description: '',
  publishedAt: todayInShanghai(),
  tags: [],
  draft: true,
  featured: false,
};

function postToInput(post: PostDocument): PostSaveInput {
  return {
    slug: post.slug,
    body: post.body,
    frontmatter: {
      title: post.title,
      description: post.description,
      publishedAt: post.publishedAt.slice(0, 10),
      updatedAt: post.updatedAt?.slice(0, 10),
      tags: post.tags,
      draft: post.draft,
      featured: post.featured,
      cover: post.cover,
    },
  };
}


function equalDraft(left: PostSaveInput, right: PostSaveInput): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function PostEditorPage() {
  const confirmAction = useConfirmDialog();
  const { slug = 'new' } = useParams();
  const navigate = useNavigate();
  const isNew = slug === 'new';
  const [draft, setDraft] = useState<PostSaveInput>({
    slug: '',
    frontmatter: { ...emptyFrontmatter },
    body: '',
  });
  const [revision, setRevision] = useState('');
  const [loadBaselineKey, setLoadBaselineKey] = useState(isNew ? 'new' : '');
  const [loaded, setLoaded] = useState(isNew);
  const [loadError, setLoadError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [conflict, setConflict] = useState<{ revision?: string; current?: PostDocument }>();
  const [editor, setEditor] = useState<MarkdownEditorHandle | null>(null);
  const [showClipPicker, setShowClipPicker] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [clips, setClips] = useState<ClipSummary[]>([]);
  const [images, setImages] = useState<ImageAsset[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [historyEntries, setHistoryEntries] = useState<PostHistoryEntry[]>([]);
  const [historyRevision, setHistoryRevision] = useState<PostHistoryRevision>();
  const [historyBusy, setHistoryBusy] = useState(false);
  const [resourceBusy, setResourceBusy] = useState(false);
  const [clipInsertBusy, setClipInsertBusy] = useState(false);
  const [preview, setPreview] = useState('');
  const [clipQuery, setClipQuery] = useState('');
  const [imageQuery, setImageQuery] = useState('');
  const clipInsertOffsetRef = useRef<number | null>(null);
  const historyGroupRef = useRef<string | undefined>(undefined);
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
    api.getPost(slug)
      .then((post) => {
        setDraft(postToInput(post));
        revisionRef.current = post.revision;
        setRevision(post.revision);
        setLoadBaselineKey(post.revision);
        persistedSlugRef.current = post.slug;
        setLoaded(true);
        void api.listImages().then((result) => setImages(result.items)).catch(() => undefined);
      })
      .catch((reason) => setLoadError(reason instanceof Error ? reason.message : '文章加载失败'));
  }, [isNew, slug]);

  const draftFingerprint = useCallback((value: PostSaveInput = draftRef.current) => JSON.stringify({
    body: value.body,
    frontmatter: {
      title: value.frontmatter.title,
      description: value.frontmatter.description,
      publishedAt: value.frontmatter.publishedAt,
      tags: value.frontmatter.tags,
      draft: value.frontmatter.draft,
      featured: value.frontmatter.featured,
      cover: value.frontmatter.cover,
    },
  }), []);

  const persistDraft = useCallback(async (historyGroup?: string) => {
    const draftSnapshot = draftRef.current;
    const persistedSlug = persistedSlugRef.current;
    const payload: PostSaveInput = {
      ...draftSnapshot,
      slug: persistedSlug ?? automaticPostSlug(draftSnapshot.frontmatter.title),
      frontmatter: {
        ...draftSnapshot.frontmatter,
        updatedAt: todayInShanghai(),
      },
    };
    try {
      const saved = persistedSlug
        ? await api.savePost(payload, revisionRef.current, historyGroup)
        : await api.createPost(payload, historyGroup);
      const normalized = postToInput(saved);
      revisionRef.current = saved.revision;
      persistedSlugRef.current = saved.slug;
      setRevision(saved.revision);
      setDraft((current) => reconcileSavedDraft(
        current,
        draftSnapshot,
        normalized,
        equalDraft,
      ));
      setConflict(undefined);
      if (!persistedSlug) navigateWithoutPrompt(`/posts/${encodeURIComponent(saved.slug)}`, { replace: true });
      return saved;
    } catch (reason) {
      if (reason instanceof ApiConflictError) {
        setConflict({ revision: reason.revision, current: reason.current as PostDocument | undefined });
      }
      throw reason;
    }
  }, [draftFingerprint, navigateWithoutPrompt]);

  const save = useCallback(async () => {
    const historyGroup = historyGroupRef.current;
    historyGroupRef.current = undefined;
    const saved = await persistDraft(historyGroup);
    return draftFingerprint(postToInput(saved));
  }, [draftFingerprint, persistDraft]);

  const { state: saveState, error: saveError, saveNow } = useAutosave(
    save,
    [draft],
    800,
    loaded && Boolean(draft.frontmatter.title && draft.frontmatter.description),
    () => draftFingerprint(draft),
    loadBaselineKey,
  );
  const confirmUnsavedNavigation = useCallback(() => confirmAction({
    eyebrow: 'Unsaved changes',
    title: '离开并放弃未保存的修改？',
    message: saveState === 'error'
      ? '最近一次自动保存失败。离开后，这些修改可能丢失。'
      : '内容仍在等待保存或正在保存。确认要离开当前编辑页吗？',
    confirmLabel: '离开页面',
    tone: 'danger',
  }), [confirmAction, saveState]);
  useUnsavedChangesGuard(
    saveState === 'dirty' || saveState === 'saving' || saveState === 'error',
    confirmUnsavedNavigation,
    navigationBypassRef,
  );

  const manualSave = async () => {
    historyGroupRef.current = `manual-${crypto.randomUUID()}`;
    await saveNow();
  };

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void api.previewInstant(draft.body).then((result) => {
        if (active) setPreview(result.html);
      }).catch(() => {
        if (active) setPreview('<p>即时预览生成失败，请检查 Markdown。</p>');
      });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [draft.body]);

  const updateFrontmatter = <K extends keyof PostFrontmatter>(key: K, value: PostFrontmatter[K]) => {
    setDraft((current) => ({
      ...current,
      frontmatter: { ...current.frontmatter, [key]: value },
    }));
  };


  const openClipPicker = async () => {
    if (!editor) {
      setMessage('正文编辑器尚未就绪，请稍后重试。');
      return;
    }
    clipInsertOffsetRef.current = editor.getSelectionOffset();
    setMessage(undefined);
    try {
      if (!clips.length) setClips((await api.listClips()).items);
      setShowClipPicker(true);
    } catch (reason) {
      clipInsertOffsetRef.current = null;
      setMessage(reason instanceof Error ? reason.message : 'Clip 列表加载失败');
    }
  };

  const openImagePicker = async () => {
    if (!images.length) {
      setImages((await api.listImages()).items);
    }
    setShowImagePicker(true);
  };

  const openTagPicker = async () => {
    setResourceBusy(true);
    try {
      const result = await api.listPosts();
      setAvailableTags([...new Set(result.items.flatMap((post) => post.tags))]);
      setShowTagPicker(true);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '标签加载失败');
    } finally {
      setResourceBusy(false);
    }
  };

  const openCoverPicker = async () => {
    setResourceBusy(true);
    try {
      if (!images.length) setImages((await api.listImages()).items);
      setShowCoverPicker(true);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '图片加载失败');
    } finally {
      setResourceBusy(false);
    }
  };

  const insertExistingClip = async (clip: ClipSummary) => {
    const insertOffset = clipInsertOffsetRef.current;
    if (insertOffset === null) {
      setMessage('无法确定 Clip 插入位置，请关闭窗口后重试。');
      return;
    }

    setClipInsertBusy(true);
    setMessage(undefined);
    try {
      const savedPost = await persistDraft(`resource-${crypto.randomUUID()}`);
      const updated = await api.attachClipToPost(
        savedPost.slug,
        clip.slug,
        savedPost.revision,
        insertOffset,
      );
      setDraft(postToInput(updated));
      revisionRef.current = updated.revision;
      setRevision(updated.revision);
      setLoadBaselineKey(updated.revision);
      clipInsertOffsetRef.current = null;
      setShowClipPicker(false);
      setClipQuery('');
      setMessage(`已插入 Clip：${clip.file}`);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '插入 Clip 失败');
    } finally {
      setClipInsertBusy(false);
    }
  };

  const filteredClips = useMemo(() => {
    const search = clipQuery.trim().toLocaleLowerCase();
    return search ? clips.filter((clip) => clip.file.toLocaleLowerCase().includes(search)) : clips;
  }, [clipQuery, clips]);

  const filteredImages = useMemo(() => {
    const search = imageQuery.trim().toLocaleLowerCase();
    return search ? images.filter((image) => (image.originalName || image.name).toLocaleLowerCase().includes(search)) : images;
  }, [imageQuery, images]);

  const uploadImage = async (file?: File) => {
    if (!file) return;
    setResourceBusy(true);
    setMessage(undefined);
    try {
      const image = await api.uploadImage(file);
      setImages((current) => [image, ...current.filter((item) => item.id !== image.id)]);
      setMessage(`图片已优化并上传：${image.name}`);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '图片上传失败');
    } finally {
      setResourceBusy(false);
    }
  };

  const openHistoryDialog = async () => {
    if (isNew) return;
    setHistoryBusy(true);
    setShowHistory(true);
    setHistoryRevision(undefined);
    try {
      const entries = await api.listPostHistory(draft.slug);
      setHistoryEntries(entries.filter((entry) => !entry.groupId.startsWith('autosave-')));
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '历史记录加载失败');
    } finally {
      setHistoryBusy(false);
    }
  };

  const inspectHistory = async (entry: PostHistoryEntry) => {
    setHistoryBusy(true);
    try {
      setHistoryRevision(await api.getPostHistoryRevision(draft.slug, entry.revisionNumber));
    } finally {
      setHistoryBusy(false);
    }
  };

  const restoreHistory = async () => {
    if (!historyRevision) return;
    const accepted = await confirmAction({
      eyebrow: 'Restore revision',
      title: `恢复历史版本 #${historyRevision.revisionNumber}？`,
      message: '当前未手动保存的修改将被所选版本覆盖。',
      confirmLabel: '确认恢复',
    });
    if (!accepted) return;
    setHistoryBusy(true);
    try {
      const current = await persistDraft();
      const restored = await api.restorePostHistory(
        current.slug,
        historyRevision.revisionNumber,
        current.revision,
      );
      setDraft(postToInput(restored));
      revisionRef.current = restored.revision;
      setRevision(restored.revision);
      setLoadBaselineKey(restored.revision);
      setShowHistory(false);
      setMessage(`已恢复历史版本 #${historyRevision.revisionNumber}`);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '历史版本恢复失败');
    } finally {
      setHistoryBusy(false);
    }
  };


  const deletePost = async () => {
    const accepted = await confirmAction({
      eyebrow: 'Move to trash',
      title: '将文章移入回收站？',
      message: `“${draft.frontmatter.title || draft.slug}”将移入回收站，关联图片不会自动删除。`,
      confirmLabel: '确认移入回收站',
      tone: 'danger',
    });
    if (!accepted) return;
    setResourceBusy(true);
    try {
      const current = await persistDraft();
      await api.deletePost(current.slug, current.revision);
      navigateWithoutPrompt('/posts', { replace: true });
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : '文章删除失败');
    } finally {
      setResourceBusy(false);
    }
  };

  const acceptServerRevision = () => {
    if (conflict?.current) {
      setDraft(postToInput(conflict.current));
      setRevision(conflict.revision || conflict.current.revision);
    }
    setConflict(undefined);
  };

  const overwriteRevision = async () => {
    if (!conflict?.revision) return;
    setConflict(undefined);
    const saved = await api.savePost(draft, conflict.revision, `conflict-${crypto.randomUUID()}`);
    setDraft(postToInput(saved));
    setRevision(saved.revision);
  };

  if (!loaded && !loadError) return <LoadingBlock label="正在铺开稿纸…" />;
  if (loadError) return <ErrorBlock message={loadError} />;

  return (
    <div className="editor-page">
      <header className="editor-topline">
        <div className="editor-breadcrumb">
          <Link to="/posts">文章</Link><span>/</span>
          <strong>{isNew ? '新稿' : draft.frontmatter.title || draft.slug}</strong>
        </div>
        <div className="save-cluster" aria-live="polite">
          {saveState !== 'idle' && <span className={`save-state state-${saveState}`}><i />{{
            dirty: '未保存',
            saving: '正在保存',
            saved: '已保存',
            error: saveError || '保存失败',
          }[saveState]}</span>}
          {!isNew && <a className="secondary-button" href={api.postDownloadUrl(draft.slug)}>下载 .md</a>}
          {!isNew && <button className="secondary-button" type="button" onClick={() => void openHistoryDialog()}>历史</button>}
          <button className="secondary-button" type="button" onClick={() => void manualSave()} disabled={saveState === 'saving'}>保存</button>
        </div>
      </header>

      {message && <div className="inline-notice" role="status">{message}<button type="button" aria-label="关闭提示" onClick={() => setMessage(undefined)}>×</button></div>}

      {conflict && (
        <section className="conflict-banner" role="alert">
          <div><span className="conflict-mark">!</span><strong>内容版本冲突</strong><p>服务器上的稿件在你编辑期间发生了变化。请选择保留哪一个版本。</p></div>
          <div><button type="button" className="secondary-button" onClick={acceptServerRevision}>载入服务器版本</button><button type="button" className="danger-button" onClick={() => void overwriteRevision()}>以本地版本覆盖</button></div>
        </section>
      )}

      <div className="editor-grid">
        <aside className="frontmatter-panel">
          <div className="panel-heading"><span>01</span><div><p>Frontmatter</p><h1>文章信息</h1></div></div>
          <div className="frontmatter-form editor-info-form post-metadata-grid">
            <label className="field post-title-field"><span>标题</span><input value={draft.frontmatter.title} onChange={(event) => updateFrontmatter('title', event.target.value)} required /></label>
            <label className="field post-summary-field"><span>摘要</span><textarea rows={2} value={draft.frontmatter.description} onChange={(event) => updateFrontmatter('description', event.target.value)} required /><small>{draft.frontmatter.description.length} / 180</small></label>
            <div className="field post-date-field"><span>发布日期</span><BlogDateField ariaLabel="发布日期" value={draft.frontmatter.publishedAt} onChange={(value) => updateFrontmatter('publishedAt', value)} required /></div>
            <div className="field tag-control post-tags-field"><span>标签</span><div className="selected-tags">{draft.frontmatter.tags.length ? draft.frontmatter.tags.map((tag) => <button type="button" key={tag} title={`移除 ${tag}`} onClick={() => updateFrontmatter('tags', draft.frontmatter.tags.filter((item) => item !== tag))}>{tag} ×</button>) : <small>尚未选择标签</small>}</div><button className="secondary-button compact-action" type="button" disabled={resourceBusy} onClick={() => void openTagPicker()}>管理标签</button></div>
            <div className="field cover-control post-cover-field"><span>封面</span>{draft.frontmatter.cover ? <div className="cover-preview">{images.find((image) => imageAssetMatchesPath(image, draft.frontmatter.cover)) && <img src={images.find((image) => imageAssetMatchesPath(image, draft.frontmatter.cover))?.url} alt="" />}<code>{draft.frontmatter.cover}</code></div> : <small>尚未选择封面</small>}<div className="field-actions"><button className="secondary-button compact-action" type="button" disabled={resourceBusy} onClick={() => void openCoverPicker()}>{draft.frontmatter.cover ? '更换封面' : '选择封面'}</button>{draft.frontmatter.cover && <button className="danger-text" type="button" onClick={() => updateFrontmatter('cover', undefined)}>清除</button>}</div></div>
            <div className="switch-stack"><label className="switch-row"><span><strong>草稿</strong></span><input type="checkbox" checked={draft.frontmatter.draft} onChange={(event) => updateFrontmatter('draft', event.target.checked)} /></label><label className="switch-row"><span><strong>首页精选</strong></span><input type="checkbox" checked={draft.frontmatter.featured} onChange={(event) => updateFrontmatter('featured', event.target.checked)} /></label></div>
            {!isNew && <div className="editor-actions"><button className="danger-text" type="button" onClick={() => void deletePost()} disabled={resourceBusy}>移入回收站</button></div>}
          </div>
        </aside>

        <section className="writing-panel" aria-labelledby="writing-heading">
          <header className="writing-toolbar"><div><span>02 · Manuscript</span><h2 id="writing-heading">正文</h2></div><div className="insert-actions"><button type="button" onClick={() => void openClipPicker()}>＋ 插入 Clip</button><button type="button" onClick={() => void openImagePicker()}>＋ 图片素材</button></div></header>
          <MarkdownEditor value={draft.body} onChange={(body) => setDraft((current) => ({ ...current, body }))} onSave={() => void manualSave()} onReady={setEditor} />
          <footer className="editor-foot"><span>{draft.body.trim() ? draft.body.trim().split(/\s+/).length : 0} 词</span><span>{draft.body.length} 字符</span><span>Markdown</span></footer>
        </section>

        <section className="preview-panel" aria-labelledby="preview-heading">
          <header className="writing-toolbar"><div><span>03 · Proof</span><h2 id="preview-heading">即时预览</h2></div><span className="preview-note">安全沙箱 · 站点管线</span></header>
          <iframe title="文章即时预览" sandbox="" srcDoc={preview} />
        </section>
      </div>

      {showClipPicker && (
        <PickerDialog
          title="在光标位置插入 Clip"
          busy={clipInsertBusy}
          onClose={() => {
            if (clipInsertBusy) return;
            clipInsertOffsetRef.current = null;
            setShowClipPicker(false);
            setClipQuery('');
          }}
        >
          <label className="search-field picker-search-field">
            <span aria-hidden="true">⌕</span>
            <span className="sr-only">按文件名搜索 Clip</span>
            <input type="search" placeholder="按文件名搜索 Clip" value={clipQuery} onChange={(event) => setClipQuery(event.target.value)} />
          </label>
          {!filteredClips.length ? <p className="empty-inline">没有匹配的 Clip 文件。</p> : (
            <div className="resource-index clip-reuse-index">
              {filteredClips.map((clip) => <button type="button" key={clip.slug} disabled={clipInsertBusy} onClick={() => void insertExistingClip(clip)}><strong>{clip.title}</strong><small><code>{clip.file}</code> · {clip.language}</small></button>)}
            </div>
          )}
        </PickerDialog>
      )}

      {showImagePicker && (
        <PickerDialog title="图片素材" onClose={() => { setShowImagePicker(false); setImageQuery(''); }}>
          <label className="upload-strip"><input type="file" accept="image/jpeg,image/png,image/webp" disabled={resourceBusy} onChange={(event) => void uploadImage(event.target.files?.[0])} /><span>{resourceBusy ? '正在处理图片…' : '上传 JPEG / PNG / WebP（自动转 WebP）'}</span></label>
          <label className="search-field picker-search-field"><span aria-hidden="true">⌕</span><span className="sr-only">按文件名搜索图片</span><input type="search" placeholder="按文件名搜索图片" value={imageQuery} onChange={(event) => setImageQuery(event.target.value)} /></label>
          {!filteredImages.length ? <p className="empty-inline">没有匹配的图片。</p> : filteredImages.map((image) => <div className="picker-item image-picker-item" key={image.id}><img src={image.url} alt="" /><span><strong>{image.originalName || image.name}</strong><small>{image.width} × {image.height}</small></span><div className="picker-actions"><button type="button" onClick={() => { editor?.insertText(createImageMarkdown({ alt: image.originalName || image.name, path: image.markdownPath || image.url })); setShowImagePicker(false); setImageQuery(''); }}>插入正文</button><button type="button" onClick={() => { updateFrontmatter('cover', image.markdownPath || image.url); setShowImagePicker(false); setImageQuery(''); }}>设为封面</button></div></div>)}
        </PickerDialog>
      )}

      {showTagPicker && (
        <TagPickerDialog
          selected={draft.frontmatter.tags}
          available={availableTags}
          onChange={(tags) => updateFrontmatter('tags', tags)}
          onClose={() => setShowTagPicker(false)}
        />
      )}

      {showCoverPicker && (
        <CoverPickerDialog
          images={images}
          selected={draft.frontmatter.cover}
          onSelect={(cover) => {
            updateFrontmatter('cover', cover);
            setShowCoverPicker(false);
          }}
          onClose={() => setShowCoverPicker(false)}
        />
      )}
      {showHistory && (
        <PickerDialog title="文章历史与差异" onClose={() => setShowHistory(false)} wide>
          <div className="history-layout">
            <aside className="history-list">
              {historyBusy && !historyEntries.length ? <LoadingBlock label="正在读取历史…" /> : historyEntries.map((entry) => <button type="button" className={historyRevision?.revisionNumber === entry.revisionNumber ? 'is-active' : ''} key={entry.revisionNumber} onClick={() => void inspectHistory(entry)}><strong>#{entry.revisionNumber}</strong><span>{formatDate(new Date(entry.createdAt).toISOString())}</span><small>{entry.groupId}</small></button>)}
            </aside>
            <section className="history-compare">
              {historyRevision ? <><header><div><strong>历史原文件 #{historyRevision.revisionNumber}</strong><span>与当前编辑正文并排核对</span></div><button className="primary-button" type="button" disabled={historyBusy} onClick={() => void restoreHistory()}>恢复</button></header><div className="compare-columns"><article><h3>当前正文</h3><pre>{draft.body}</pre></article><article><h3>历史正文</h3><pre>{historyRevision.body}</pre></article></div></> : <p className="empty-inline">选择一个版本查看差异并恢复。</p>}
            </section>
          </div>
        </PickerDialog>
      )}
    </div>
  );
}

function PickerDialog({
  title,
  onClose,
  children,
  wide = false,
  busy = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  busy?: boolean;
}) {
  return (
    <Dialog
      className={wide ? 'is-wide history-dialog' : ''}
      ariaLabelledBy="picker-title"
      closeOnBackdrop={!busy}
      closeOnEscape={!busy}
      onClose={onClose}
    >
      <header>
        <h2 id="picker-title">{title}</h2>
        <button type="button" aria-label="关闭" disabled={busy} onClick={onClose}>×</button>
      </header>
      <div className="picker-list">{children}</div>
    </Dialog>
  );
}
