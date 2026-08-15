import { useEffect, useRef, useState } from 'react';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { cpp } from '@codemirror/lang-cpp';
import { javascript } from '@codemirror/lang-javascript';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { normalizeCodeLanguage } from '../lib/editor-actions';

const defaultExtensions: Extension[] = [];
const markdownLanguage = markdown();
const adminHighlightStyle = HighlightStyle.define([
  { tag: tags.comment, color: 'var(--editor-comment)', fontStyle: 'italic' },
  { tag: [tags.keyword, tags.modifier, tags.operatorKeyword], color: 'var(--editor-keyword)' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--editor-string)' },
  { tag: [tags.number, tags.bool, tags.null], color: 'var(--editor-number)' },
  { tag: [tags.function(tags.variableName), tags.labelName], color: 'var(--editor-symbol)' },
  { tag: [tags.typeName, tags.className, tags.namespace], color: 'var(--editor-type)' },
  { tag: [tags.variableName, tags.propertyName], color: 'var(--editor-text)' },
  { tag: [tags.operator, tags.punctuation], color: 'var(--editor-punctuation)' },
  { tag: [tags.heading, tags.strong], color: 'var(--editor-heading)', fontWeight: '700' },
  { tag: tags.link, color: 'var(--editor-number)', textDecoration: 'underline' },
]);

export function codeLanguageExtension(language?: string): Extension {
  switch (normalizeCodeLanguage(language)) {
    case undefined: return markdownLanguage;
    case 'cpp': return cpp();
    case 'javascript': return javascript();
    case 'jsx': return javascript({ jsx: true });
    case 'typescript': return javascript({ typescript: true });
    case 'tsx': return javascript({ typescript: true, jsx: true });
    case 'python': return python();
    default: return [];
  }
}

export interface MarkdownEditorHandle {
  focus: () => void;
  insertText: (text: string) => void;
  getSelectionOffset: () => number;
}

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  onReady?: (handle: MarkdownEditorHandle | null) => void;
  ariaLabel?: string;
  language?: string;
  extensions?: Extension[];
}

export function MarkdownEditor({
  value,
  onChange,
  onSave,
  onReady,
  ariaLabel = 'Markdown 正文编辑器',
  language,
  extensions = defaultExtensions,
}: MarkdownEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  const onReadyRef = useRef(onReady);
  const [focused, setFocused] = useState(false);
  valueRef.current = value;
  onChangeRef.current = onChange;
  onSaveRef.current = onSave;
  onReadyRef.current = onReady;

  useEffect(() => {
    if (!host.current) return;
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: valueRef.current,
        extensions: [
          lineNumbers(),
          history(),
          codeLanguageExtension(language),
          syntaxHighlighting(adminHighlightStyle),
          keymap.of([
            {
              key: 'Mod-s',
              preventDefault: true,
              run: () => {
                onSaveRef.current?.();
                return true;
              },
            },
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          ...(language ? [] : [EditorView.lineWrapping]),
          EditorView.contentAttributes.of({
            'aria-label': ariaLabel,
            spellcheck: language ? 'false' : 'true',
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString());
            if (update.focusChanged) setFocused(update.view.hasFocus);
          }),
          EditorView.theme({
            '&': {
              height: '100%',
              color: 'var(--editor-text)',
              backgroundColor: 'transparent',
            },
            '.cm-scroller': {
              fontFamily: "'Cascadia Code', 'SFMono-Regular', Consolas, monospace",
              lineHeight: '1.72',
            },
            '.cm-content': {
              minHeight: '100%',
              padding: '22px 12px 40px',
              caretColor: 'var(--editor-caret)',
            },
            '.cm-line': { padding: '0 10px' },
            '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--editor-caret)' },
            '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
              backgroundColor: 'var(--editor-selection)',
            },
            '.cm-gutters': {
              color: 'var(--editor-muted)',
              backgroundColor: 'var(--editor-gutter)',
              border: 'none',
              borderRight: '1px solid var(--line)',
            },
            '.cm-activeLine, .cm-activeLineGutter': {
              backgroundColor: 'var(--editor-active-line)',
            },
            '.cm-matchingBracket': {
              color: 'var(--editor-heading)',
              backgroundColor: 'var(--editor-selection)',
              outline: '1px solid var(--editor-caret)',
            },
            '&.cm-focused': { outline: 'none' },
          }),
          ...extensions,
        ],
      }),
    });
    view.current = editor;
    onReadyRef.current?.({
      focus: () => editor.focus(),
      getSelectionOffset: () => editor.state.selection.main.from,
      insertText: (text: string) => {
        const range = editor.state.selection.main;
        const prefix = range.from > 0 && editor.state.doc.sliceString(range.from - 1, range.from) !== '\n' ? '\n\n' : '';
        const suffix = range.to < editor.state.doc.length && editor.state.doc.sliceString(range.to, range.to + 1) !== '\n' ? '\n\n' : '';
        const insertion = `${prefix}${text}${suffix}`;
        editor.dispatch({
          changes: { from: range.from, to: range.to, insert: insertion },
          selection: { anchor: range.from + insertion.length },
          scrollIntoView: true,
        });
        editor.focus();
      },
    });
    return () => {
      onReadyRef.current?.(null);
      editor.destroy();
      view.current = null;
    };
  }, [ariaLabel, extensions, language]);

  useEffect(() => {
    const editor = view.current;
    if (!editor) return;
    const current = editor.state.doc.toString();
    if (value !== current) {
      editor.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
  }, [value]);

  return <div className={`markdown-editor${focused ? ' is-focused' : ''}`} ref={host} />;
}
