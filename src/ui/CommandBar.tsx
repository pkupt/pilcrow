import { workspace } from '../store/workspace';
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
  return (
    <header class="command-bar">
      <span class="app-name">md_rw</span>
      <span class="save-status">{workspace.isDirty.value ? '● unsaved' : 'saved'}</span>
      <button onClick={save} aria-label="Save">Save</button>
      <button onClick={toggleSearch} aria-label="Toggle search">Search</button>
      <button onClick={toggleTheme} aria-label="Toggle theme">Theme</button>
      {workspace.searchOpen.value && <SearchPanel />}
    </header>
  );
}
