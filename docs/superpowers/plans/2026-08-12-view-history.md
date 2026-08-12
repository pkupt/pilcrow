# View History: Back/Forward Navigation + Recent Files Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add back/forward navigation through a session-only, deduplicated file-open history, and surface the persisted recent-files list in a command-bar dropdown.

**Architecture:** Extend the `workspace` store with `navHistory` + `navIndex` signals and `goBack`/`goForward` methods; `openFile` becomes a thin wrapper over an internal `openFileInternal(path, recordHistory)` that handles dirty-confirmation + load, while a private `recordNav` mutates the history. CommandBar renders two nav buttons and a History dropdown bound to the store signals.

**Tech Stack:** preact, @preact/signals, vitest (existing), @testing-library/preact.

## Global Constraints

- `openFile` remains the public API used everywhere (tests, FileTree, PreviewPane, CommandBar).
- Dedup history: opening a file already present earlier in the truncated list removes that old occurrence then appends it.
- Back/forward navigate via a history-preserving internal open: they must NOT re-record navigation.
- `navHistory`/`navIndex` are session-only; `recentFiles` stays cross-session (unchanged, already persisted, max 20).
- `resetWorkspace()` clears `navHistory`/`navIndex`. `openWorkspace` also resets them.
- All new tests must follow the existing mock-fs pattern in `tests/store.workspace.test.ts` (`createMockFs`, `vi.mock('../src/fs/directory')`).
- Language: UI copy in English, matching existing buttons (`Save`, `Search`, `Open`, `Theme`).

---

### Task 1: History signals + recordNav + goBack/goForward in the store

**Files:**
- Modify: `src/store/workspace.ts` (signals block ~line 58, `openFile` ~line 113, `openWorkspace` ~line 84-100, `resetWorkspace` ~line 302)
- Test: `tests/store.workspace.test.ts`

**Interfaces:**
- Consumes: existing `workspace.openFile(path: string): Promise<void>`, `resetWorkspace()`, `createMockFs` from `./mocks/fs`.
- Produces:
  - `workspace.navHistory: Signal<string[]>`
  - `workspace.navIndex: Signal<number>`
  - `workspace.goBack(): Promise<void>` — history-preserving reopen of previous entry
  - `workspace.goForward(): Promise<void>` — history-preserving reopen of next entry
  - `workspace.canGoBack(): boolean` (true iff `navIndex > 0`)
  - `workspace.canGoForward(): boolean` (true iff `navIndex < navHistory.length - 1`)

- [ ] **Step 1: Write the failing tests**

Append to `tests/store.workspace.test.ts`:

```ts
describe('workspace navigation history', () => {
  it('seeds history on first open', async () => {
    await setup({ 'a.md': 'a' });
    await workspace.openFile('a.md');
    expect(workspace.navHistory.value).toEqual(['a.md']);
    expect(workspace.navIndex.value).toBe(0);
  });

  it('appends distinct opens and dedups', async () => {
    await setup({ 'a.md': 'a', 'b.md': 'b' });
    await workspace.openFile('a.md');
    await workspace.openFile('b.md');
    await workspace.openFile('a.md');
    expect(workspace.navHistory.value).toEqual(['a.md', 'b.md']);
    expect(workspace.navIndex.value).toBe(0); // a.md is current again
  });

  it('goBack moves backward and goForward moves forward', async () => {
    await setup({ 'a.md': 'a', 'b.md': 'b', 'c.md': 'c' });
    await workspace.openFile('a.md');
    await workspace.openFile('b.md');
    await workspace.openFile('c.md');
    await workspace.goBack();
    expect(workspace.openFilePath.value).toBe('b.md');
    await workspace.goBack();
    expect(workspace.openFilePath.value).toBe('a.md');
    await workspace.goForward();
    expect(workspace.openFilePath.value).toBe('b.md');
  });

  it('goBack clamps at the first entry', async () => {
    await setup({ 'a.md': 'a', 'b.md': 'b' });
    await workspace.openFile('a.md');
    await workspace.openFile('b.md');
    await workspace.goBack();
    await workspace.goBack();
    expect(workspace.openFilePath.value).toBe('a.md');
    expect(workspace.canGoBack()).toBe(false);
  });

  it('goForward clamps at the last entry', async () => {
    await setup({ 'a.md': 'a', 'b.md': 'b' });
    await workspace.openFile('a.md');
    await workspace.openFile('b.md');
    await workspace.goForward();
    expect(workspace.openFilePath.value).toBe('b.md');
    expect(workspace.canGoForward()).toBe(false);
  });

  it('back then opening a new file truncates the forward stack', async () => {
    await setup({ 'a.md': 'a', 'b.md': 'b', 'c.md': 'c' });
    await workspace.openFile('a.md');
    await workspace.openFile('b.md');
    await workspace.openFile('c.md');
    await workspace.goBack();
    await workspace.openFile('new.md');
    expect(workspace.navHistory.value).toEqual(['a.md', 'b.md', 'new.md']);
    expect(workspace.navIndex.value).toBe(2);
    expect(workspace.canGoForward()).toBe(false);
  });

  it('jumping to an earlier file truncates then re-appends it', async () => {
    await setup({ 'a.md': 'a', 'b.md': 'b', 'c.md': 'c' });
    await workspace.openFile('a.md');
    await workspace.openFile('b.md');
    await workspace.openFile('c.md');
    await workspace.goBack(); // now on b.md, navIndex 1
    await workspace.openFile('b.md'); // re-open current -> no-op
    expect(workspace.navHistory.value).toEqual(['a.md', 'b.md', 'c.md']);
    expect(workspace.navIndex.value).toBe(1);
  });

  it('does not record history when reopening the current file', async () => {
    await setup({ 'a.md': 'a', 'b.md': 'b' });
    await workspace.openFile('a.md');
    await workspace.openFile('a.md');
    expect(workspace.navHistory.value).toEqual(['a.md']);
    expect(workspace.navIndex.value).toBe(0);
  });

  it('resetWorkspace clears navigation history', async () => {
    await setup({ 'a.md': 'a', 'b.md': 'b' });
    await workspace.openFile('a.md');
    await workspace.openFile('b.md');
    resetWorkspace();
    expect(workspace.navHistory.value).toEqual([]);
    expect(workspace.navIndex.value).toBe(-1);
    expect(workspace.canGoBack()).toBe(false);
    expect(workspace.canGoForward()).toBe(false);
  });

  it('goBack/goForward prompt for dirty edits like openFile', async () => {
    await setup({ 'a.md': 'a', 'b.md': 'b' });
    await workspace.openFile('a.md');
    await workspace.openFile('b.md');
    workspace.openFileContent.value = 'dirty';
    workspace.isDirty.value = true;
    const confirmSpy = vi.spyOn(workspace, 'confirmDirty').mockResolvedValue(ConfirmResult.CANCEL);
    await workspace.goBack();
    expect(workspace.openFilePath.value).toBe('b.md'); // unchanged, cancelled
    expect(workspace.navIndex.value).toBe(1); // navIndex untouched
    confirmSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/store.workspace.test.ts -t "navigation history"`
Expected: FAIL — `workspace.navHistory` is undefined / methods don't exist.

- [ ] **Step 3: Add the signals**

In `src/store/workspace.ts`, after the `recentFiles` signal (line 58), add:

```ts
  navHistory: signal<string[]>([]),
  navIndex: signal<number>(-1),
```

Add helper methods after `reGrantAccess` (before `openFile`):

```ts
  canGoBack(): boolean {
    return workspace.navIndex.value > 0;
  },

  canGoForward(): boolean {
    return workspace.navIndex.value < workspace.navHistory.value.length - 1;
  },
```

- [ ] **Step 4: Refactor `openFile` and add history logic**

Replace the `openFile` body (lines 113-129) with an internal open + history recording:

```ts
  async openFile(path: string): Promise<void> {
    await workspace.openFileInternal(path, true);
  },

  async openFileInternal(path: string, recordHistory: boolean): Promise<void> {
    if (workspace.directoryHandle.value === null) return;
    if (workspace.isDirty.value && workspace.openFilePath.value !== null) {
      const result = toConfirmResult(await workspace.confirmDirty());
      if (result === ConfirmResult.CANCEL) return;
      if (result === ConfirmResult.SAVE) await workspace.saveCurrent();
    }
    const content = await readFile(workspace.directoryHandle.value!, path);
    if (content === null) return;
    const mtime = await getFileMtime(workspace.directoryHandle.value!, path);
    workspace.openFilePath.value = path;
    workspace.openFileContent.value = content;
    workspace.openFileMtime.value = mtime ?? 0;
    workspace.isDirty.value = false;
    workspace.recentFiles.value = [path, ...workspace.recentFiles.value.filter((p) => p !== path)].slice(0, 20);
    persistSettings();
    if (recordHistory) {
      const hist = workspace.navHistory.value;
      const idx = workspace.navIndex.value;
      if (hist.length === 0) {
        workspace.navHistory.value = [path];
        workspace.navIndex.value = 0;
      } else if (hist[idx] !== path) {
        const truncated = hist.slice(0, idx + 1).filter((p) => p !== path);
        truncated.push(path);
        workspace.navHistory.value = truncated;
        workspace.navIndex.value = truncated.length - 1;
      }
    }
  },

  async goBack(): Promise<void> {
    const idx = workspace.navIndex.value;
    if (idx <= 0) return;
    const target = workspace.navHistory.value[idx - 1];
    workspace.navIndex.value = idx - 1;
    await workspace.openFileInternal(target, false);
  },

  async goForward(): Promise<void> {
    const idx = workspace.navIndex.value;
    const hist = workspace.navHistory.value;
    if (idx < 0 || idx >= hist.length - 1) return;
    const target = hist[idx + 1];
    workspace.navIndex.value = idx + 1;
    await workspace.openFileInternal(target, false);
  },
```

- [ ] **Step 5: Reset history in openWorkspace and resetWorkspace**

In `openWorkspace`, after `workspace.isDirty.value = false;` (the success path, ~line 90) add:

```ts
      workspace.navHistory.value = [];
      workspace.navIndex.value = -1;
```

And in the NotAllowedError/SecurityError branch (line 99, after `isDirty.value = false;`) add the same two lines.

In `resetWorkspace` (after `recentFiles.value = [];` line 310) add:

```ts
  workspace.navHistory.value = [];
  workspace.navIndex.value = -1;
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/store.workspace.test.ts`
Expected: PASS (all existing + new tests).

- [ ] **Step 7: Run full suite + typecheck**

Run: `npm test` then `npm run typecheck`
Expected: all tests pass, typecheck clean.

- [ ] **Step 8: Commit**

```bash
git add src/store/workspace.ts tests/store.workspace.test.ts
git commit -m "feat: session navigation history with back/forward in store"
```

---

### Task 2: Back/forward buttons + History dropdown in CommandBar

**Files:**
- Modify: `src/ui/CommandBar.tsx`
- Modify: `src/ui/styles.css` (add nav button + history-menu styles)
- Test: `tests/ui.App.test.tsx`

**Interfaces:**
- Consumes: `workspace.navHistory`, `workspace.navIndex`, `workspace.canGoBack()`, `workspace.canGoForward()`, `workspace.goBack()`, `workspace.goForward()`, `workspace.openFile(path)`, `workspace.recentFiles`.
- Produces: nav buttons with `aria-label="Back"` / `aria-label="Forward"`, and a `History` button + dropdown with `aria-label="History"`. Dropdown items have `data-path={path}`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/ui.App.test.tsx`:

```tsx
it('renders back/forward buttons disabled when no history', () => {
  resetWorkspace();
  render(<App />);
  const back = screen.getByRole('button', { name: /back/i });
  const fwd = screen.getByRole('button', { name: /forward/i });
  expect((back as HTMLButtonElement).disabled).toBe(true);
  expect((fwd as HTMLButtonElement).disabled).toBe(true);
});

it('enables back after opening two files and navigates', async () => {
  resetWorkspace();
  workspace.directoryHandle.value = {} as FileSystemDirectoryHandle;
  workspace.navHistory.value = ['a.md', 'b.md'];
  workspace.navIndex.value = 1;
  const goBackSpy = vi.spyOn(workspace, 'goBack').mockResolvedValue(undefined);
  render(<App />);
  const back = screen.getByRole('button', { name: /back/i }) as HTMLButtonElement;
  expect(back.disabled).toBe(false);
  back.click();
  expect(goBackSpy).toHaveBeenCalled();
  goBackSpy.mockRestore();
});

it('History dropdown lists recentFiles and opens on click', async () => {
  resetWorkspace();
  workspace.directoryHandle.value = {} as FileSystemDirectoryHandle;
  workspace.recentFiles.value = ['a.md', 'b.md'];
  const openSpy = vi.spyOn(workspace, 'openFile').mockResolvedValue(undefined);
  render(<App />);
  screen.getByRole('button', { name: /history/i }).click();
  const item = await screen.findByText('a.md');
  item.click();
  expect(openSpy).toHaveBeenCalledWith('a.md');
  openSpy.mockRestore();
});

it('History dropdown shows empty state when no history', () => {
  resetWorkspace();
  render(<App />);
  screen.getByRole('button', { name: /history/i }).click();
  expect(screen.getByText(/no history/i)).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui.App.test.tsx -t "History"`
Expected: FAIL — buttons/dropdown not rendered.

- [ ] **Step 3: Add the History dropdown component**

In `src/ui/CommandBar.tsx`, add a `HistoryMenu` function component above `CommandBar`:

```tsx
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
```

Note: `workspace.recentFiles.value` is read directly in render and auto-tracked by
`@preact/signals` — no `useSignal`/`useSignalEffect` import is needed here.

- [ ] **Step 4: Add nav buttons and History toggle to CommandBar**

Rewrite the `CommandBar` return block (lines 24-34) to:

```tsx
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
```

Add import at top: `import { useState } from 'preact/hooks';`

- [ ] **Step 5: Add CSS**

Append to `src/ui/styles.css`:

```css
.command-bar .nav-btn {
  padding: 4px 8px;
}

.history-menu {
  position: absolute;
  top: 42px;
  right: 12px;
  z-index: 60;
  min-width: 220px;
  max-height: 60vh;
  overflow: auto;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  padding: 4px;
}

.history-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.history-list li button {
  display: block;
  width: 100%;
  text-align: left;
  padding: 6px 10px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 6px;
  font-size: 13px;
  color: var(--fg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-list li button:hover {
  background: var(--hover);
}

.history-empty {
  padding: 8px 10px;
  color: var(--muted);
  font-size: 13px;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/ui.App.test.tsx`
Expected: PASS (all existing + new).

Note: the dropdown is `position: absolute` inside the command bar. The command bar already has `position: relative` (line 322 of styles.css). The `right: 12px` positions it under the History button on the right side. Tests use role queries so absolute positioning doesn't matter for tests.

- [ ] **Step 7: Run full suite + typecheck**

Run: `npm test` then `npm run typecheck`
Expected: all pass, typecheck clean.

- [ ] **Step 8: Commit**

```bash
git add src/ui/CommandBar.tsx src/ui/styles.css tests/ui.App.test.tsx
git commit -m "feat: back/forward buttons and history dropdown in command bar"
```

---

### Task 3: Verify in real browser + final green

**Files:**
- Test: run existing suite; use debug-ui.mjs harness if desired (not committed).

**Interfaces:**
- Consumes: built `dist/` from `npm run build`.

- [ ] **Step 1: Full verification**

Run: `npm test` and `npm run typecheck` and `npm run build`
Expected: all tests pass, typecheck clean, build succeeds.

- [ ] **Step 2: Manual sanity in built dist (optional)**

If a Chrome harness is available, load `dist/` and verify: back/forward buttons toggle enabled state as files are opened; History dropdown lists recent files and clicking reopens them.

- [ ] **Step 3: Commit any stragglers**

```bash
git status
```

Commit only if there are leftover changes (e.g. debug scripts were already excluded). Expected: nothing to commit (clean).

---

## Self-Review Notes

- Spec coverage: back/forward (Task 1 store logic + Task 2 UI), dedup rules (Task 1 tests), session-only (reset in `openWorkspace`/`resetWorkspace`), recent-files dropdown (Task 2), disabled states (Task 1 `canGoBack`/`canGoForward` + Task 2 UI), no-op on deleted file (existing `openFile` behavior preserved via `openFileInternal`). All spec requirements covered.
- `navIndex` starts at `-1` (empty history sentinel), matching the spec's "empty → seed with navIndex 0". `canGoForward` guard `idx < 0` handles the empty case.
- `openFileInternal(path, recordHistory)` keeps `openFile` a stable public API; back/forward pass `false`.
- Placeholder check: all steps contain concrete code and exact commands.
