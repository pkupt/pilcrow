import { workspace } from '../store/workspace';

export function CommandBar() {
  const toggleTheme = () => {
    workspace.setTheme(workspace.theme.value === 'light' ? 'dark' : 'light');
  };
  return (
    <header class="command-bar">
      <span class="app-name">md_rw</span>
      <button onClick={toggleTheme} aria-label="Toggle theme">Theme</button>
    </header>
  );
}
