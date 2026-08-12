# View History: Back/Forward Navigation + Recent Files

Date: 2026-08-12
Status: Draft

## Problem

Users need to recover files they viewed before. Two related gaps:

1. There is no way to navigate back/forward through the files opened in the
   current session (like editor navigation history).
2. `recentFiles` (last 20 opened files) is tracked and persisted but never
   surfaced anywhere in the UI.

## Goals

- Provide back (`←`) and forward (`→`) buttons in the command bar that move
  through a deduplicated, session-only navigation history of opened files.
- Provide a "History" dropdown in the command bar listing recently opened
  files (cross-session, up to 20) that can be clicked to reopen a file.
- Both surfaces stay consistent with the file currently open.

## Non-Goals

- No cross-session persistence for the back/forward stack (session only).
- No scroll-position memory per file.
- No grouping/filtering/sorting options for the recent list beyond recency.

## Design

### Navigation history (session only)

Add signals to the workspace store:

- `navHistory: signal<string[]>` — ordered, deduplicated list of file paths
  visited in this session. Dedup rule: opening a file already in the list moves
  it conceptually to the "current" position (no duplicate entries).
- `navIndex: signal<number>` — pointer into `navHistory` for the current file.
  `navHistory[navIndex]` is the currently open file path.

Behavior on `openFile(path)`:

- Let `current = navHistory[navIndex]` (undefined when history is empty).
- If `path === current`, nothing changes (avoid pushing repeats when the same
  file is reopened).
- Otherwise, truncate any forward entries:
  `navHistory = navHistory[0..navIndex]` (when navIndex is -1/empty, start with
  `[]`).
- If `path` already exists earlier in the (truncated) list, remove that old
  occurrence, then append `path`. This keeps the list deduplicated: the moved
  entry is a *jump* to an already-visited file, recorded once at its new
  position.
- Set `navIndex = navHistory.length - 1`.

Examples:

- A→B→A (all via `openFile`): `[A]` → `[A, B]` → `[A, B]` (opening A again
  while A is current does nothing).
- From `[A, B]` with navIndex 1, back to A (navIndex 0), then open D:
  truncate to `[A]`, D not present, append → `[A, D]`, navIndex 1.
- From `[A, B, C]` with navIndex 1 (on B), open C: C not current, truncate to
  `[A, B]`, C already present → remove old occurrence → `[A, B]`, append C →
  `[A, B, C]`, navIndex 2.
- First open with empty history: seed `[path]`, navIndex 0.

Back (`goBack()`):

- If `navIndex > 0`, decrement `navIndex` and reopen
  `navHistory[navIndex]` via the same path as `openFile`, **without** mutating
  history again (a dedicated internal open that skips history updates).
- Clamp: cannot go before index 0.

Forward (`goForward()`):

- If `navIndex < navHistory.length - 1`, increment and reopen the entry,
  again without mutating history.
- Clamp: cannot go past the last entry.

The back button is disabled when `navIndex <= 0`; forward disabled when
`navIndex >= navHistory.length - 1`.

`resetWorkspace()` clears `navHistory` and `navIndex`. Switching folders via
`openWorkspace` also resets them (new workspace, new history).

### Recent files dropdown (cross-session)

Reuse the existing `recentFiles` signal (already persisted to settings, max 20,
updated in `openFile` at src/store/workspace.ts:127). Add a `History` button in
the command bar that toggles a dropdown listing `recentFiles`. Clicking an item
calls `openFile(path)`; if the file no longer exists (`readFile` returns null),
`openFile` already no-ops safely.

### UI placement (CommandBar)

Layout (left to right):

`←` `→` | md_rw  <save-status>  Save  Search  History  Open  Theme

- `←` / `→`: small buttons, disabled state when clamped. `aria-label="Back"` /
  `aria-label="Forward"`, `aria-disabled` when unavailable.
- `History`: button toggling the dropdown. Dropdown rendered inside the command
  bar (reuse `.context-menu`-style or a dedicated `.history-menu` style). Empty
  state text "No history yet." when `recentFiles` is empty.
- Dropdown closes on outside click / selecting an item.

### Data flow

- `openFile` is the single chokepoint for updating both `recentFiles` and
  `navHistory`, so back/forward and the recent list stay in sync.
- Back/forward reopen files through an internal no-history-mutation open to
  avoid double-recording.

## Error handling

- Reopening a deleted file is a no-op (`openFile` returns when `readFile`
  returns null). The stale entry is left in `recentFiles`; clicking it just
  does nothing.
- If `navHistory` is empty, both buttons are disabled and nothing happens on
  click.

## Testing

- Unit tests for the history store logic:
  - dedup: A→B→A seeds `[A, B]`; opening C yields `[A, B, C]` with navIndex 2.
  - back clamps at 0, forward clamps at last.
  - going back then opening a new file truncates the forward stack.
  - switching folders resets history.
- Component test for CommandBar: buttons render, disabled state reflects
  navIndex, History dropdown toggles and lists recentFiles, clicking an item
  calls openFile.
- Existing 158 tests continue to pass; full suite + typecheck + build green.

## Files touched

- `src/store/workspace.ts` — add `navHistory`/`navIndex` signals, `goBack`,
  `goForward`, history-aware `openFile`, reset on workspace switch/reset.
- `src/ui/CommandBar.tsx` — back/forward buttons + History dropdown.
- `src/ui/styles.css` — styles for nav buttons and the history dropdown.
- `tests/` — new `workspace.history.test.ts` (or extend store tests) +
  `ui.App.test.tsx`/new CommandBar tests.
