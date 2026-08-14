# File Sort Modes

Date: 2026-08-14
Status: Draft

## Problem

The file tree has no sorting at all. The render order equals the iteration
order of the File System Access API's `values()` (which is undefined) for the
flat `tree` array, and nesting in `FileTree.tsx` preserves that arbitrary
order. Users cannot control how files are ordered (by name, by last-modified,
or left unsorted).

## Goals

- Let the user pick a sort mode from the command bar: **by name**, **by
  last-modified time**, or **unsorted**.
- Directories always sort before files within each level ("folders first").
- Natural (numeric-aware, case-insensitive) comparison for name sorting.
- Last-modified sorting is newest-first (fixed direction, no asc/desc toggle).
- The chosen mode persists across sessions (localStorage, same mechanism as
  `theme`).

## Non-Goals

- No ascending/descending toggle for any mode.
- No per-directory overrides; one global mode for the whole tree.
- No re-sorting of search results (search is independent of tree order).
- No drag-and-drop reordering.
- No persistence of expand/collapse state changes (out of scope, pre-existing
  behavior unchanged).

## Design

### Sort mode type

```ts
type FileSortKind = 'name' | 'mtime' | 'none';
```

### Store state (`src/store/settings.ts`, `src/store/workspace.ts`)

- Add `fileSort: FileSortKind` to the `Settings` interface.
- `DEFAULT_SETTINGS.fileSort = 'name'` (matches typical file managers).
- `loadSettings()` whitelist-validates `fileSort`: only `'name' | 'mtime' |
  'none'` accepted, otherwise falls back to `'name'`. Follows the existing
  `theme` validation pattern.
- Add `workspace.fileSort: signal<FileSortKind>` and
  `workspace.setFileSort(kind)`, which sets the signal and calls
  `persistSettings()` (identical pattern to `setTheme`).
- `resetWorkspace()` restores `fileSort` to the default.

### Sort function (`src/ui/sortTree.ts`, new file)

Pure function applied to a level's children (list of `FileNode`):

```ts
function compareBy(kind: FileSortKind, a: FileNode, b: FileNode): number
function sortChildren(children: FileNode[], kind: FileSortKind): FileNode[]
```

- `compareBy` first separates by `kind`: a `directory` always precedes a
  `file`. Then, within the same kind, compares by the selected mode:
  - `'name'`: `a.name.localeCompare(b.name, undefined, { numeric: true,
    sensitivity: 'base' })` — natural sort, case-insensitive
    (`note2.md` before `note10.md`).
  - `'mtime'`: descending (newest first): `b.mtime - a.mtime`.
  - `'none'`: keeps original order (returns `0`, so stable sort preserves the
    incoming order).
- `sortChildren` returns a new array sorted by `compareBy`. The array is
  copied before sorting (never mutates the input `children`).
- Sorting is applied **per level**, recursively: every node's `children` are
  sorted independently, so folders-first holds within each expanded directory
  and at the root.

### File tree integration (`src/ui/FileTree.tsx`)

- `buildTree` already produces nested `TreeNode` structures. After building,
  recursively sort every node's `children` using `sortChildren` with the
  current `workspace.fileSort.value`.
- Pass `workspace.fileSort.value` into the `buildTree`/sort step so the sort
  reacts to signal changes; `flatten` then renders the sorted order.
- Directories that are **collapsed** still get their `children` sorted (the
  order is ready the moment a directory is expanded).

### Command bar (`src/ui/CommandBar.tsx`)

Follow the existing `HistoryMenu` pattern:

- New `SortMenu` dropdown component (mirrors `HistoryMenu`): receives
  `onClose`, shows three options — `By name`, `By modified time`,
  `Unsorted`.
- The currently active mode is marked with `✓`.
- Clicking an option calls `workspace.setFileSort(mode)` and closes the menu.
- The command bar button toggles the dropdown with `useState`, has
  `aria-expanded`, and reads `workspace.fileSort.value` for the active
  indicator.
- Placement: after the History button (order:
  `Save Open Search Theme History [Sort] [Preview/Edit]`).

### Data flow

- Choosing a mode in `SortMenu` → `workspace.setFileSort(kind)` → signal
  updates → `persistSettings()` saves to localStorage → `FileTree` re-renders
  with the new order. No refresh/re-enumeration of the tree is needed.

### Error handling

- None new. `loadSettings()` already guards corrupt/unknown values with
  try/catch and whitelist fallback. `sortChildren` is a pure function that
  always returns an array.

## Testing

- `tests/ui.sortTree.test.ts` (new): `name` natural ordering (case-insensitive,
  numeric aware), `mtime` newest-first, `none` preserves incoming order,
  directories always before files, stable for equal keys, recursion sorts
  nested levels, and input array is not mutated.
- `tests/store.settings.test.ts`: `fileSort` round-trip through
  `loadSettings`/`saveSettings`, unknown value falls back to `'name'`,
  `setFileSort` persists, `initWorkspace`/`resetWorkspace` apply/restore the
  default.
- `tests/ui.FileTree.test.tsx`: given a mock fs with out-of-order entries and
  a set `fileSort`, the rendered list reflects the expected sorted order
  (name and mtime cases; unsorted keeps insertion order).
- `tests/ui.CommandBar.test.tsx`: the Sort button opens/closes the dropdown,
  the active mode shows `✓`, clicking an option updates
  `workspace.fileSort.value` and closes the menu.
- Full suite + typecheck + build green.

## Files touched

- `src/types.ts` — add `FileSortKind` (or export from `sortTree`; pick one
  location and reference it).
- `src/store/settings.ts` — add `fileSort` field + validation + default.
- `src/store/workspace.ts` — add `fileSort` signal, `setFileSort`,
  `resetWorkspace` restore, load/persist integration.
- `src/ui/sortTree.ts` (new) — `sortChildren` / `compareBy`.
- `src/ui/FileTree.tsx` — sort each node's children during `buildTree`.
- `src/ui/CommandBar.tsx` — `SortMenu` dropdown + button.
- `tests/ui.sortTree.test.ts` (new).
- `tests/store.settings.test.ts`, `tests/ui.FileTree.test.tsx`,
  `tests/ui.CommandBar.test.tsx`.
