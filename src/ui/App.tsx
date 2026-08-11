import { useSignal } from '@preact/signals';
import { workspace } from '../store/workspace';
import { FileTree } from './FileTree';
import { EditorPane } from './EditorPane';
import { PreviewPane } from './PreviewPane';
import { CommandBar } from './CommandBar';
import { ErrorBoundary } from './ErrorBoundary';
import './styles.css';

export function App() {
  const treeWidth = useSignal(240);
  const editorWidth = useSignal(0.5);

  return (
    <ErrorBoundary>
      <div class="app-shell" data-theme={workspace.theme.value}>
        <CommandBar />
        <div class="app-body">
          <aside
            class="pane tree-pane"
            data-pane="tree"
            style={{ width: `${treeWidth.value}px` }}
          >
            <FileTree />
          </aside>
          <div class="resizer" data-resize="tree" />
          <section
            class="pane editor-pane"
            data-pane="editor"
            style={{ flex: `${editorWidth.value} 1 0` }}
          >
            <EditorPane />
          </section>
          <div class="resizer" data-resize="editor" />
          <section
            class="pane preview-pane"
            data-pane="preview"
            style={{ flex: `${1 - editorWidth.value} 1 0` }}
          >
            <PreviewPane />
          </section>
        </div>
      </div>
    </ErrorBoundary>
  );
}
