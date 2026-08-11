# md_rw Manual Verification Checklist

Run through this list before each release. Open Chrome with the unpacked extension loaded.

## Setup
- [ ] Load `dist/` as unpacked extension in `chrome://extensions`
- [ ] Click the md_rw icon -> a new tab opens with the app
- [ ] No errors in the service worker console

## Folder access
- [ ] Click "Select folder" -> native directory picker appears
- [ ] Pick a folder with .md files -> file tree populates
- [ ] Reload the tab -> folder is remembered, only a permission re-grant prompt appears
- [ ] Deny the permission prompt -> "Re-grant access" screen shows
- [ ] Re-grant -> app returns to the workspace

## File operations
- [ ] Click a .md file -> content loads in editor + preview
- [ ] Right-click a file -> context menu shows New / Rename / Delete
- [ ] Create a new file -> appears in tree, opens in editor
- [ ] Rename a file that has wikilinks pointing to it -> confirmation dialog lists affected files -> confirm -> links updated
- [ ] Drag a file onto a directory -> file moves
- [ ] Delete a file -> removed from tree; if it was open, editor clears

## Editing
- [ ] Type in the editor -> "unsaved" indicator appears
- [ ] Stop typing for 1 second -> auto-save fires, indicator clears
- [ ] Press Ctrl+S -> immediate save
- [ ] Open a file, modify, switch to another file -> confirmation prompt (Save / Discard / Cancel)

## Preview
- [ ] Markdown renders correctly: headings, tables, task lists, code blocks (highlighted)
- [ ] KaTeX math renders ($...$ and $$...$$)
- [ ] Mermaid diagram renders as SVG
- [ ] Callout (:::note ... :::) renders with styling
- [ ] YAML frontmatter is stripped from preview
- [ ] Click a [[wikilink]] -> target file opens
- [ ] Click a [relative](./other.md) link -> target file opens
- [ ] Click an external http link -> opens in new tab

## Search
- [ ] Ctrl+Shift+F or click Search -> search panel opens
- [ ] Search for a term -> results list shows matches with file:line
- [ ] Toggle Regex -> regex search works
- [ ] Toggle Case -> case sensitivity works
- [ ] Click a result -> file opens

## Conflict handling
- [ ] Open a file, edit it, then externally modify the same file on disk
- [ ] Wait for auto-save -> conflict dialog appears (Keep local / Overwrite / Manual merge)
- [ ] Choose "Keep local" -> local version saved

## Themes
- [ ] Click Theme -> switches between light and dark
- [ ] Editor (CodeMirror) theme matches
- [ ] Preview styling matches

## Error boundary
- [ ] Force a render error (e.g. broken KaTeX) -> error shown inline, rest of doc renders
- [ ] Open a > 1MB file -> preview disabled with message, editor still works

## Cross-session
- [ ] Close the tab, reopen via icon -> same folder + recent files restored
