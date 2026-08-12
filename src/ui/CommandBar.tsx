import { useState } from 'preact/hooks';
import { workspace, ConfirmResult } from '../store/workspace';
import { SearchPanel } from './SearchPanel';

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
  return (
    <header class="command-bar">
      <span class="app-name">md_rw</span>
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
      {historyOpen && <HistoryMenu onClose={closeHistory} />}
      {workspace.searchOpen.value && <SearchPanel />}
    </header>
  );
}
