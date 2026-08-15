import { useRef } from 'react';
import { BlogDateField } from './BlogDateField';
import { BlogSelect } from './BlogSelect';
import { Dialog } from './Dialog';
import { clipLanguageOptions } from '../lib/languages';

export interface ClipImportFields {
  title: string;
  description: string;
  language: string;
  createdAt: string;
}

interface ClipImportDialogProps {
  file: File;
  fields: ClipImportFields;
  busy: boolean;
  onChange: (fields: ClipImportFields) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function ClipImportDialog({
  file,
  fields,
  busy,
  onChange,
  onSubmit,
  onClose,
}: ClipImportDialogProps) {
  const titleInput = useRef<HTMLInputElement>(null);

  return (
    <Dialog
      className="clip-import-dialog"
      ariaLabelledBy="clip-import-title"
      initialFocusRef={titleInput}
      closeOnBackdrop={!busy}
      closeOnEscape={!busy}
      onClose={onClose}
    >
      <header>
        <div>
          <span className="eyebrow">Source intake</span>
          <h2 id="clip-import-title">导入剪切内容</h2>
        </div>
        <button type="button" aria-label="关闭导入窗口" disabled={busy} onClick={onClose}>×</button>
      </header>
      <form
        className="picker-list compact-resource-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <p className="selected-source-file"><span>已选择</span><code>{file.name}</code></p>
        <label className="field">
          <span>标题</span>
          <input
            ref={titleInput}
            required
            value={fields.title}
            onChange={(event) => onChange({ ...fields, title: event.target.value })}
          />
        </label>
        <div className="field-pair">
          <div className="field">
            <span>语言</span>
            <BlogSelect
              ariaLabel="语言"
              value={fields.language}
              options={clipLanguageOptions(fields.language)}
              disabled={busy}
              onChange={(language) => onChange({ ...fields, language })}
            />
          </div>
          <div className="field">
            <span>创建日期</span>
            <BlogDateField
              ariaLabel="创建日期"
              required
              value={fields.createdAt}
              onChange={(createdAt) => onChange({ ...fields, createdAt })}
            />
          </div>
        </div>
        <label className="field">
          <span>描述</span>
          <textarea
            rows={3}
            value={fields.description}
            onChange={(event) => onChange({ ...fields, description: event.target.value })}
          />
        </label>
        <footer className="dialog-actions">
          <button className="secondary-button" type="button" disabled={busy} onClick={onClose}>取消</button>
          <button className="primary-button" type="submit" disabled={busy || !fields.title.trim()}>
            {busy ? '导入中…' : '确认导入'}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
