import { useState } from 'preact/hooks';
import { workspace, ConfirmResult } from '../store/workspace';
import { SearchPanel } from './SearchPanel';
import type { FileSortKind } from '../types';

const SORT_MODES: Array<{ kind: FileSortKind; label: string }> = [
  { kind: 'name', label: 'By name' },
  { kind: 'mtime', label: 'By modified time' },
  { kind: 'none', label: 'Unsorted' },
];

function HistoryMenu({ onClose }: { onClose: () => void }) {
  const openFile = (path: string) => {
    onClose();
    void workspace.openFile(path);
  };
  return (
    <div class="history-menu" data-testid="history-menu">
      {workspace.recentFiles.value.length === 0 ? (
        <div class="history-empty">No history yet.</div>
      ) : (
        <ul class="history-list">
          {workspace.recentFiles.value.map((path) => (
            <li key={path}>
              <button data-path={path} onClick={() => openFile(path)}>
                {path}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SortMenu({ onClose }: { onClose: () => void }) {
  const choose = (kind: FileSortKind) => {
    workspace.setFileSort(kind);
    onClose();
  };
  return (
    <div class="sort-menu" data-testid="sort-menu">
      <ul class="sort-list">
        {SORT_MODES.map((m) => {
          const active = workspace.fileSort.value === m.kind;
          return (
            <li key={m.kind}>
              <button aria-pressed={active} onClick={() => choose(m.kind)}>
                {active ? '✓ ' : ''}{m.label}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function CommandBar() {
  const toggleTheme = () => {
    workspace.setTheme(workspace.theme.value === 'light' ? 'dark' : 'light');
  };
  const toggleSearch = () => {
    workspace.toggleSearch(!workspace.searchOpen.value);
  };
  const save = () => {
    void workspace.saveCurrent();
  };
  const switchFolder = () => {
    void (async () => {
      if (workspace.isDirty.value) {
        const result = await workspace.confirmDirty();
        if (result === ConfirmResult.CANCEL) return;
        if (result === ConfirmResult.SAVE) await workspace.saveCurrent();
      }
      await workspace.openWorkspace(undefined, true);
    })();
  };
  const [historyOpen, setHistoryOpen] = useState(false);
  const closeHistory = () => setHistoryOpen(false);
  const [sortOpen, setSortOpen] = useState(false);
  const closeSort = () => setSortOpen(false);
  const toggleEditor = () => {
    workspace.editorVisible.value = !workspace.editorVisible.value;
  };
  return (
    <header class="command-bar">
      <span class="app-name">Pilcrow</span>
      <span class="save-status">{workspace.isDirty.value ? '● unsaved' : 'saved'}</span>
      <button
        class="nav-btn"
        onClick={() => void workspace.goBack()}
        disabled={!workspace.canGoBack()}
        aria-label="Back"
        title="Back"
      >
        ←
      </button>
      <button
        class="nav-btn"
        onClick={() => void workspace.goForward()}
        disabled={!workspace.canGoForward()}
        aria-label="Forward"
        title="Forward"
      >
        →
      </button>
      <button onClick={save} aria-label="Save">Save</button>
      <button onClick={switchFolder} aria-label="Open folder">Open</button>
      <button onClick={toggleSearch} aria-label="Toggle search">Search</button>
      <button onClick={toggleTheme} aria-label="Toggle theme">Theme</button>
      <button
        onClick={() => setHistoryOpen(!historyOpen)}
        aria-label="History"
        aria-expanded={historyOpen}
      >
        History
      </button>
      <button
        onClick={() => setSortOpen(!sortOpen)}
        aria-label="Sort"
        aria-expanded={sortOpen}
      >
        Sort
      </button>
      <button
        onClick={toggleEditor}
        aria-label={workspace.editorVisible.value ? 'Preview' : 'Edit'}
        aria-pressed={workspace.editorVisible.value}
      >
        {workspace.editorVisible.value ? 'Preview' : 'Edit'}
      </button>
      {historyOpen && <HistoryMenu onClose={closeHistory} />}
      {sortOpen && <SortMenu onClose={closeSort} />}
      {workspace.searchOpen.value && <SearchPanel />}
    </header>
  );
}
