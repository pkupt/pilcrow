import { useEffect } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import { workspace } from '../store/workspace';
import { FileTree } from './FileTree';
import { EditorPane } from './EditorPane';
import { PreviewPane } from './PreviewPane';
import { CommandBar } from './CommandBar';
import { ErrorBoundary } from './ErrorBoundary';
import { DialogHost } from './Dialogs';
import './styles.css';

const TREE_MIN = 120;
const TREE_MAX = 480;
const EDITOR_MIN = 0.15;
const EDITOR_MAX = 0.85;

export function App() {
  const treeWidth = useSignal(240);
  const editorWidth = useSignal(0.5);

  const startTreeDrag = (e: PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = treeWidth.value;
    const onMove = (ev: PointerEvent) => {
      treeWidth.value = Math.min(TREE_MAX, Math.max(TREE_MIN, startWidth + (ev.clientX - startX)));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const startEditorDrag = (e: PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startRatio = editorWidth.value;
    const onMove = (ev: PointerEvent) => {
      const total = document.querySelector('.app-body')?.clientWidth || window.innerWidth;
      const next = startRatio + (ev.clientX - startX) / total;
      editorWidth.value = Math.min(EDITOR_MAX, Math.max(EDITOR_MIN, next));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  useEffect(() => {
    void workspace.openWorkspace().catch(() => {});
  }, []);

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
          <div class="resizer" data-resize="tree" onPointerDown={startTreeDrag} />
          {workspace.editorVisible.value && (
            <>
              <section
                class="pane editor-pane"
                data-pane="editor"
                style={{ flex: `${editorWidth.value} 1 0` }}
              >
                <EditorPane />
              </section>
              <div class="resizer" data-resize="editor" onPointerDown={startEditorDrag} />
            </>
          )}
          <section
            class="pane preview-pane"
            data-pane="preview"
            style={workspace.editorVisible.value
              ? { flex: `${1 - editorWidth.value} 1 0` }
              : { flex: '1 1 0' }}
          >
            <PreviewPane />
          </section>
        </div>
        {workspace.permissionError.value && (
          <div class="regrant-overlay">
            <div class="regrant-card">
              <h1>Folder access required</h1>
              <p>Pilcrow could not access your folder. Re-grant permission to continue.</p>
              <button onClick={() => void workspace.reGrantAccess()}>Re-grant access</button>
            </div>
          </div>
        )}
        <DialogHost />
      </div>
    </ErrorBoundary>
  );
}
