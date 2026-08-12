# Editor/Preview Mode Toggle

Date: 2026-08-12
Status: Draft

## Problem

Users sometimes want a clean reading view without the editor, but the current
layout always shows both the editor and preview panes side by side.

## Goals

- Toggle between split view (tree + editor + preview) and preview-only view
  (tree + preview full width) via a button in the command bar.
- Preserve all editor state across the toggle: current file, unsaved content,
  editor width ratio. Only the CodeMirror cursor position is not preserved
  (the editor component is unmounted in preview-only mode).

## Non-Goals

- No keyboard shortcut for the toggle (button only).
- No persistence of the toggle across sessions.
- No separate "preview page" route or URL change.
- No dirty-edit confirmation prompt on toggle (unsaved content is kept in
  memory and still shown in the preview).

## Design

### Store state

Add to the workspace store:

- `editorVisible: signal<boolean>(true)` — whether the editor pane is shown.

No other store changes; `openFilePath`, `openFileContent`, `editorWidth` (in
App, not the store) already carry the state to preserve.

### Command bar

Add a `Preview` / `Edit` toggle button to `CommandBar`:

- When `editorVisible.value === true`, button label is `Preview`; clicking it
  hides the editor.
- When `editorVisible.value === false`, button label is `Edit`; clicking it
  shows the editor.
- `aria-pressed` reflects the current state (`aria-pressed={editorVisible.value}`)
  for accessibility.
- Placement: right after the `History` button, at the end of the action row
  (current order: `Save Open Search Theme History [Preview/Edit]`).

### Layout (App.tsx)

`editorVisible` controls whether the editor `<section>` and its resizer render:

```tsx
{workspace.editorVisible.value && (
  <>
    <section class="pane editor-pane" data-pane="editor"
      style={{ flex: `${editorWidth.value} 1 0` }}>
      <EditorPane />
    </section>
    <div class="resizer" data-resize="editor" onPointerDown={startEditorDrag} />
  </>
)}
```

When the editor is hidden, the preview pane renders with `flex: 1`:

```tsx
<section class="pane preview-pane" data-pane="preview"
  style={workspace.editorVisible.value
    ? { flex: `${1 - editorWidth.value} 1 0` }
    : { flex: '1 1 0' }}>
  <PreviewPane />
</section>
```

The tree pane and its resizer are unchanged.

### Data flow

- Clicking the toggle flips `workspace.editorVisible.value`.
- `EditorPane` mounts/unmounts with the flag. On remount it re-reads
  `workspace.openFileContent.value` (already how it initializes), so unsaved
  content reappears. Cursor position is lost (accepted).
- The editor width ratio lives in App's `editorWidth` `useSignal`, which
  persists across renders, so the ratio is preserved on toggle back.

### Error handling

- None new. The preview already renders whatever `openFileContent` holds,
  including unsaved content.

## Testing

- Store: `editorVisible` defaults to `true`; toggling flips it;
  `resetWorkspace()` restores `true`.
- Component (App):
  - Preview/Edit button toggles the editor pane: initially the editor pane
    is rendered; click the toggle → editor `<section data-pane="editor">`
    and `[data-resize="editor"]` are gone, preview has `flex: 1 1 0`;
    click again → editor and resizer return, preview flex returns to
    `${1 - editorWidth.value} 1 0`.
  - Toggle does not clear `openFilePath` / `openFileContent` (state preserved).
- Full suite + typecheck + build green.

## Files touched

- `src/store/workspace.ts` — add `editorVisible` signal + reset in
  `resetWorkspace`.
- `src/ui/CommandBar.tsx` — Preview/Edit toggle button.
- `src/ui/App.tsx` — conditionally render editor pane + resizer; preview
  flex becomes `1` when editor hidden.
- `tests/store.workspace.test.ts` — `editorVisible` default + reset test.
- `tests/ui.App.test.tsx` — toggle component tests.
