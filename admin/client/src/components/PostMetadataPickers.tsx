import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Dialog } from './Dialog';
import type { ImageAsset } from '../types';

interface DialogFrameProps {
  title: string;
  titleId: string;
  onClose: () => void;
  children: ReactNode;
}

function DialogFrame({ title, titleId, onClose, children }: DialogFrameProps) {
  return (
    <Dialog
      className="metadata-picker"
      ariaLabelledBy={titleId}
      onClose={onClose}
    >
      <header>
        <h2 id={titleId}>{title}</h2>
        <button type="button" aria-label="关闭" onClick={onClose}>×</button>
      </header>
      <div className="picker-list">{children}</div>
    </Dialog>
  );
}

interface TagPickerProps {
  selected: string[];
  available: string[];
  onChange: (tags: string[]) => void;
  onClose: () => void;
}

export function TagPickerDialog({ selected, available, onChange, onClose }: TagPickerProps) {
  const [view, setView] = useState<'list' | 'create'>('list');
  const [query, setQuery] = useState('');
  const [newTag, setNewTag] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const tags = useMemo(
    () => [...new Set([...available, ...selected])].sort((left, right) => left.localeCompare(right)),
    [available, selected],
  );
  const filteredTags = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return search ? tags.filter((tag) => tag.toLocaleLowerCase().includes(search)) : tags;
  }, [query, tags]);

  useEffect(() => input.current?.focus(), [view]);

  const add = () => {
    const tag = newTag.trim();
    if (tag && !selected.includes(tag)) onChange([...selected, tag]);
    setNewTag('');
    setQuery('');
    setView('list');
  };

  const toggle = (tag: string) => {
    onChange(selected.includes(tag)
      ? selected.filter((item) => item !== tag)
      : [...selected, tag]);
  };

  return (
    <DialogFrame title={view === 'list' ? '管理标签' : '新建标签'} titleId="tag-picker-title" onClose={onClose}>
      {view === 'list' ? (
        <>
          <div className="tag-picker-toolbar">
            <label className="field tag-search-field">
              <span>搜索标签</span>
              <input
                ref={input}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="输入标签名称"
              />
            </label>
            <button className="secondary-button" type="button" onClick={() => setView('create')}>＋ 新建标签</button>
          </div>
          <div className="tag-option-grid" aria-label="已有标签">
            {filteredTags.length ? filteredTags.map((tag) => (
              <button
                className="tag-option"
                type="button"
                key={tag}
                aria-pressed={selected.includes(tag)}
                onClick={() => toggle(tag)}
              >
                {tag}
              </button>
            )) : <p className="empty-inline">没有匹配的标签。</p>}
          </div>
          <footer className="dialog-actions">
            <span className="muted-copy">已选择 {selected.length} 个标签</span>
            <button className="primary-button" type="button" onClick={onClose}>完成</button>
          </footer>
        </>
      ) : (
        <form
          className="tag-create-panel"
          onSubmit={(event) => {
            event.preventDefault();
            add();
          }}
        >
          <label className="field">
            <span>标签名称</span>
            <input ref={input} value={newTag} onChange={(event) => setNewTag(event.target.value)} />
          </label>
          <footer className="dialog-actions">
            <button className="secondary-button" type="button" onClick={() => setView('list')}>返回</button>
            <button className="primary-button" type="submit" disabled={!newTag.trim()}>创建并选择</button>
          </footer>
        </form>
      )}
    </DialogFrame>
  );
}

interface CoverPickerProps {
  images: ImageAsset[];
  selected?: string;
  onSelect: (path?: string) => void;
  onClose: () => void;
}

export function CoverPickerDialog({ images, selected, onSelect, onClose }: CoverPickerProps) {
  return (
    <DialogFrame title="选择封面" titleId="cover-picker-title" onClose={onClose}>
      <div className="dialog-actions cover-picker-actions">
        <span className="muted-copy">从图片库已有资源中选择</span>
        {selected && <button className="danger-text" type="button" onClick={() => onSelect(undefined)}>清除封面</button>}
      </div>
      <div className="cover-picker-grid">
        {!images.length ? <p className="empty-inline">图片库还是空的。</p> : images.map((image) => (
          <button
            className="cover-picker-card"
            type="button"
            key={image.id}
            aria-pressed={selected === image.markdownPath}
            onClick={() => onSelect(image.markdownPath)}
          >
            <img src={image.url} alt="" />
            <span>
              <strong>{image.originalName || image.name}</strong>
              <small>{image.width} × {image.height}</small>
            </span>
            {selected === image.markdownPath && <b>已选择</b>}
          </button>
        ))}
      </div>
    </DialogFrame>
  );
}
