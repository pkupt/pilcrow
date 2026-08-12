import { workspace, ConfirmResult } from '../store/workspace';
import { SearchPanel } from './SearchPanel';

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
  return (
    <header class="command-bar">
      <span class="app-name">md_rw</span>
      <span class="save-status">{workspace.isDirty.value ? '● unsaved' : 'saved'}</span>
      <button onClick={save} aria-label="Save">Save</button>
      <button onClick={switchFolder} aria-label="Open folder">Open</button>
      <button onClick={toggleSearch} aria-label="Toggle search">Search</button>
      <button onClick={toggleTheme} aria-label="Toggle theme">Theme</button>
      {workspace.searchOpen.value && <SearchPanel />}
    </header>
  );
}
