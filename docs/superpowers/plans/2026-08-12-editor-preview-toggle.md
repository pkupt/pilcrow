# Editor/Preview Mode Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a command-bar button that toggles between split view (tree + editor + preview) and preview-only view (tree + preview full width), preserving editor state.

**Architecture:** Add `editorVisible` signal to the workspace store. The CommandBar renders a Preview/Edit toggle button bound to it. App conditionally renders the editor pane and its resizer when visible, and gives the preview pane `flex: 1` when the editor is hidden. Editor state (current file, unsaved content, width ratio) lives in existing signals so it is preserved; only the CodeMirror cursor is lost on remount (accepted).

**Tech Stack:** preact, @preact/signals, vitest (existing), @testing-library/preact.

## Global Constraints

- `editorVisible` defaults to `true` and `resetWorkspace()` restores it to `true`.
- Toggle button: label `Preview` when editor visible (click hides editor); label `Edit` when hidden (click shows editor). `aria-pressed` reflects state.
- Button placement: after the `History` button, end of the action row (current order `Save Open Search Theme History [Preview/Edit]`).
- When editor hidden: the `[data-pane="editor"]` section and `[data-resize="editor"]` resizer are not rendered; `[data-pane="preview"]` has `flex: 1 1 0`.
- When editor visible: preview keeps `flex: ${1 - editorWidth.value} 1 0`.
- No dirty-confirm prompt on toggle; no persistence of the flag; no keyboard shortcut.
- All new tests follow existing patterns in `tests/ui.App.test.tsx` and `tests/store.workspace.test.ts`.

---

### Task 1: editorVisible signal + toggle button

**Files:**
- Modify: `src/store/workspace.ts` (signals block ~line 60, `resetWorkspace` ~line 358)
- Modify: `src/ui/CommandBar.tsx` (toggle button)
- Test: `tests/store.workspace.test.ts`, `tests/ui.App.test.tsx`

**Interfaces:**
- Consumes: existing `workspace` store object, `resetWorkspace()`.
- Produces: `workspace.editorVisible: Signal<boolean>` (default `true`), reset to `true` in `resetWorkspace()`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/store.workspace.test.ts`:

```ts
describe('workspace.editorVisible', () => {
  it('defaults to true', () => {
    resetWorkspace();
    expect(workspace.editorVisible.value).toBe(true);
  });

  it('resetWorkspace restores editorVisible to true', () => {
    resetWorkspace();
    workspace.editorVisible.value = false;
    resetWorkspace();
    expect(workspace.editorVisible.value).toBe(true);
  });
});
```

Append to `tests/ui.App.test.tsx`:

```tsx
it('Preview toggle hides the editor pane and shows full-width preview', async () => {
  resetWorkspace();
  const { container } = render(<App />);
  expect(container.querySelector('[data-pane="editor"]')).toBeTruthy();
  screen.getByRole('button', { name: /preview/i }).click();
  await new Promise((r) => setTimeout(r, 0));
  expect(container.querySelector('[data-pane="editor"]')).toBeFalsy();
  expect(container.querySelector('[data-resize="editor"]')).toBeFalsy();
  const preview = container.querySelector('[data-pane="preview"]') as HTMLElement;
  expect(preview.style.flex).toMatch(/^1 1 0/);
});

it('Edit toggle brings the editor pane back and restores the split ratio', async () => {
  resetWorkspace();
  const { container } = render(<App />);
  screen.getByRole('button', { name: /preview/i }).click();
  await new Promise((r) => setTimeout(r, 0));
  screen.getByRole('button', { name: /edit/i }).click();
  await new Promise((r) => setTimeout(r, 0));
  expect(container.querySelector('[data-pane="editor"]')).toBeTruthy();
  expect(container.querySelector('[data-resize="editor"]')).toBeTruthy();
  const preview = container.querySelector('[data-pane="preview"]') as HTMLElement;
  expect(preview.style.flex).toMatch(/^0\.5 1 0/);
});

it('toggling to preview keeps the open file and content', async () => {
  resetWorkspace();
  workspace.openFilePath.value = 'a.md';
  workspace.openFileContent.value = '# hello';
  render(<App />);
  screen.getByRole('button', { name: /preview/i }).click();
  await new Promise((r) => setTimeout(r, 0));
  expect(workspace.openFilePath.value).toBe('a.md');
  expect(workspace.openFileContent.value).toBe('# hello');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/store.workspace.test.ts -t "editorVisible"` then `npx vitest run tests/ui.App.test.tsx -t "toggle"`
Expected: FAIL — `workspace.editorVisible` undefined / button not rendered.

- [ ] **Step 3: Add the signal**

In `src/store/workspace.ts`, after the `theme` signal (line 61) add:

```ts
  editorVisible: signal<boolean>(true),
```

- [ ] **Step 4: Reset in resetWorkspace**

In `resetWorkspace` (after `workspace.theme.value = 'light';` line 371) add:

```ts
  workspace.editorVisible.value = true;
```

- [ ] **Step 5: Add the toggle button**

In `src/ui/CommandBar.tsx`, add a handler inside the component (after `closeHistory`, line 50):

```tsx
  const toggleEditor = () => {
    workspace.editorVisible.value = !workspace.editorVisible.value;
  };
```

Add the button after the History button (line 83):

```tsx
      <button
        onClick={toggleEditor}
        aria-label={workspace.editorVisible.value ? 'Preview' : 'Edit'}
        aria-pressed={workspace.editorVisible.value}
      >
        {workspace.editorVisible.value ? 'Preview' : 'Edit'}
      </button>
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/store.workspace.test.ts tests/ui.App.test.tsx`
Expected: PASS.

- [ ] **Step 7: Run full suite + typecheck**

Run: `npm test` then `npm run typecheck`
Expected: all pass, typecheck clean.

- [ ] **Step 8: Commit**

```bash
git add src/store/workspace.ts src/ui/CommandBar.tsx tests/store.workspace.test.ts tests/ui.App.test.tsx
git commit -m "feat: editorVisible signal and Preview/Edit toggle button"
```

---

### Task 2: Conditional editor pane rendering in App

**Files:**
- Modify: `src/ui/App.tsx` (layout block ~lines 70-80)
- Test: `tests/ui.App.test.tsx`

**Interfaces:**
- Consumes: `workspace.editorVisible` (from Task 1), `editorWidth` (App's existing `useSignal`).
- Produces: rendered layout that hides the editor pane + editor resizer and gives preview `flex: 1` when `editorVisible.value === false`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/ui.App.test.tsx`:

```tsx
it('preview pane takes full remaining width when editor hidden', async () => {
  resetWorkspace();
  workspace.editorVisible.value = false;
  const { container } = render(<App />);
  const preview = container.querySelector('[data-pane="preview"]') as HTMLElement;
  expect(preview.style.flex).toMatch(/^1 1 0/);
  expect(container.querySelector('[data-pane="editor"]')).toBeFalsy();
  expect(container.querySelector('[data-resize="editor"]')).toBeFalsy();
});

it('editor pane renders when editorVisible is true', () => {
  resetWorkspace();
  const { container } = render(<App />);
  expect(container.querySelector('[data-pane="editor"]')).toBeTruthy();
  expect(container.querySelector('[data-resize="editor"]')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui.App.test.tsx -t "full remaining width"`
Expected: FAIL — preview still has the split ratio.

- [ ] **Step 3: Implement conditional rendering**

In `src/ui/App.tsx`, replace the editor section + resizer (lines 70-79) with:

```tsx
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
```

And update the preview section's `style` so it becomes full width when the editor is hidden (lines 80-84):

```tsx
          <section
            class="pane preview-pane"
            data-pane="preview"
            style={workspace.editorVisible.value
              ? { flex: `${1 - editorWidth.value} 1 0` }
              : { flex: '1 1 0' }}
          >
            <PreviewPane />
          </section>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/ui.App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run full suite + typecheck**

Run: `npm test` then `npm run typecheck`
Expected: all pass, typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/ui/App.tsx tests/ui.App.test.tsx
git commit -m "feat: hide editor pane and expand preview in preview-only mode"
```

---

### Task 3: Verify in real browser + final green

**Files:**
- Test: run existing suite; optional real-browser harness (not committed).

**Interfaces:**
- Consumes: built `dist/` from `npm run build`.

- [ ] **Step 1: Full verification**

Run: `npm test` and `npm run typecheck` and `npm run build`
Expected: all tests pass, typecheck clean, build succeeds.

- [ ] **Step 2: Manual sanity in built dist (optional)**

If a Chrome harness is available, load `dist/` and verify: clicking Preview hides the editor pane and the preview expands; clicking Edit restores split view and the open file/content are unchanged.

- [ ] **Step 3: Commit any stragglers**

```bash
git status
```

Commit only if there are leftover changes. Expected: nothing to commit (clean).

---

## Self-Review Notes

- Spec coverage: toggle button (Task 1), conditional editor render + full-width preview (Task 2), state preservation (existing signals, verified by `toggling to preview keeps the open file and content`), no-dirty-prompt / no-persistence / no-shortcut (non-goals, nothing added). All covered.
- Type consistency: `workspace.editorVisible` defined in Task 1, consumed in Tasks 2; button label logic uses the same signal in CommandBar.
- The toggle button appears in CommandBar, which is rendered above the app body — clicking it re-renders App's layout because `editorVisible` is a workspace signal read in App's render.
- Placeholder check: every step has concrete code and exact commands.
