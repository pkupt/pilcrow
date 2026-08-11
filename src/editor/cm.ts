import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language';
import type { EditorOpts } from '../types';

export interface EditorHandle {
  update: (text: string) => void;
  getValue: () => string;
  destroy: () => void;
  focus: () => void;
  view: EditorView;
}

export function createEditor(parent: HTMLElement, opts: EditorOpts): EditorHandle {
  const themeComp = new Compartment();
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: opts.initialText,
      extensions: [
        EditorView.lineWrapping,
        history(),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        highlightSelectionMatches(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...completionKeymap,
          { key: 'Mod-s', run: () => { opts.onSave(); return true; } },
        ]),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) opts.onDirty();
        }),
        themeComp.of(opts.theme === 'dark' ? darkTheme : lightTheme),
      ],
    }),
  });

  let isExternalUpdate = false;

  return {
    view,
    update(text: string) {
      if (view.state.doc.toString() === text) return;
      isExternalUpdate = true;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
      });
      isExternalUpdate = false;
      void isExternalUpdate;
    },
    getValue() {
      return view.state.doc.toString();
    },
    destroy() {
      view.destroy();
    },
    focus() {
      view.focus();
    },
  };
}

const lightTheme = EditorView.theme({}, { dark: false });
const darkTheme = EditorView.theme(
  {
    '&': { backgroundColor: '#1e1e1e', color: '#d4d4d4' },
    '.cm-content': { caretColor: '#fff' },
    '.cm-gutters': { backgroundColor: '#252526', color: '#858585', border: 'none' },
    '.cm-activeLine': { backgroundColor: '#2a2d2e' },
    '.cm-activeLineGutter': { backgroundColor: '#2a2d2e' },
    '&.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: '#264f78' },
  },
  { dark: true },
);
