import { signal } from '@preact/signals';
import type { FileNode, SearchHit, Theme } from '../types';
import {
  listTree,
  loadHandle,
  pickDirectory,
  persistHandle,
} from '../fs/directory';
import {
  readFile,
  writeFile,
  createFile as fsCreateFile,
  createDirectory as fsCreateDirectory,
  deleteFile as fsDeleteFile,
  deleteDirectory as fsDeleteDirectory,
  moveEntry as fsMoveEntry,
  moveDirectory as fsMoveDirectory,
  getFileMtime,
} from '../fs/files';
import { updateReferences } from '../markdown/wikilinks';
import { search as grepSearch, type SearchQuery } from '../search/grep';
import { loadSettings, saveSettings } from './settings';

export enum ConfirmResult {
  SAVE = 'save',
  DISCARD = 'discard',
  CANCEL = 'cancel',
  KEEP_LOCAL = 'keep_local',     // for conflict
  OVERWRITE = 'overwrite',       // for conflict
  MANUAL_MERGE = 'manual_merge', // for conflict
}

// Any unrecognized value (e.g. '' from a backdrop dismiss) is treated as CANCEL so
// no flow proceeds to a switch/overwrite with an unknown result.
function toConfirmResult(value: unknown): ConfirmResult {
  const v = value as string;
  switch (v) {
    case ConfirmResult.SAVE:
    case ConfirmResult.DISCARD:
    case ConfirmResult.CANCEL:
    case ConfirmResult.KEEP_LOCAL:
    case ConfirmResult.OVERWRITE:
    case ConfirmResult.MANUAL_MERGE:
      return v;
    default:
      return ConfirmResult.CANCEL;
  }
}

export const workspace = {
  directoryHandle: signal<FileSystemDirectoryHandle | null>(null),
  permissionError: signal<boolean>(false),
  tree: signal<FileNode[]>([]),
  openFilePath: signal<string | null>(null),
  openFileContent: signal<string | null>(null),
  openFileMtime: signal<number>(0),
  isDirty: signal<boolean>(false),
  recentFiles: signal<string[]>([]),
  navHistory: signal<string[]>([]),
  navIndex: signal<number>(-1),
  searchOpen: signal<boolean>(false),
  searchResults: signal<SearchHit[]>([]),
  theme: signal<Theme>('light'),
  editorVisible: signal<boolean>(true),

  // Overridable hooks for UI confirmation dialogs.
  confirmDirty: async (): Promise<ConfirmResult> => ConfirmResult.DISCARD,
  confirmReferences: async (_edits: { path: string; count: number }[]): Promise<boolean> => true,
  confirmDelete: async (_path: string): Promise<boolean> => true,
  confirmConflict: async (): Promise<ConfirmResult> => ConfirmResult.KEEP_LOCAL,

  async openWorkspace(
    handle?: FileSystemDirectoryHandle,
    forcePicker = false,
  ): Promise<void> {
    try {
      let root = handle ?? await loadHandle();
      if (forcePicker || !root) {
        root = await pickDirectory();
      } else {
        const permission = await root.requestPermission({ mode: 'readwrite' });
        if (permission === 'denied') {
          // A persisted handle with revoked permission cannot be used; fall back to the picker.
          root = await pickDirectory();
        }
      }
      workspace.permissionError.value = false;
      await persistHandle(root);
      workspace.directoryHandle.value = root;
      await refreshTree();
      workspace.openFilePath.value = null;
      workspace.openFileContent.value = null;
      workspace.isDirty.value = false;
      workspace.navHistory.value = [];
      workspace.navIndex.value = -1;
    } catch (e) {
      const name = (e as DOMException | undefined)?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        workspace.directoryHandle.value = null;
        workspace.permissionError.value = true;
        workspace.tree.value = [];
        workspace.openFilePath.value = null;
        workspace.openFileContent.value = null;
        workspace.isDirty.value = false;
        workspace.navHistory.value = [];
        workspace.navIndex.value = -1;
        return;
      }
      if (name === 'AbortError') return; // user cancelled the directory picker
      throw e;
    }
  },

  // Re-ask for permission on the current/persisted handle and reopen the workspace.
  // If the persisted handle is still denied, openWorkspace falls back to the picker.
  async reGrantAccess(): Promise<void> {
    await workspace.openWorkspace(workspace.directoryHandle.value ?? undefined);
  },

  canGoBack(): boolean {
    return workspace.navIndex.value > 0;
  },

  canGoForward(): boolean {
    return workspace.navIndex.value < workspace.navHistory.value.length - 1;
  },

  async openFile(path: string): Promise<void> {
    await workspace.openFileInternal(path, true);
  },

  async openFileInternal(path: string, recordHistory: boolean): Promise<boolean> {
    if (workspace.directoryHandle.value === null) return false;
    if (workspace.isDirty.value && workspace.openFilePath.value !== null) {
      const result = toConfirmResult(await workspace.confirmDirty());
      if (result === ConfirmResult.CANCEL) return false;
      if (result === ConfirmResult.SAVE) await workspace.saveCurrent();
    }
    const content = await readFile(workspace.directoryHandle.value!, path);
    if (recordHistory) {
      const hist = workspace.navHistory.value;
      const idx = workspace.navIndex.value;
      if (hist.length === 0) {
        workspace.navHistory.value = [path];
        workspace.navIndex.value = 0;
      } else if (hist[idx] !== path) {
        const existing = hist.indexOf(path);
        if (existing !== -1) {
          workspace.navIndex.value = existing;
        } else {
          const truncated = hist.slice(0, idx + 1);
          truncated.push(path);
          workspace.navHistory.value = truncated;
          workspace.navIndex.value = truncated.length - 1;
        }
      }
    }
    if (content === null) return false;
    const mtime = await getFileMtime(workspace.directoryHandle.value!, path);
    workspace.openFilePath.value = path;
    workspace.openFileContent.value = content;
    workspace.openFileMtime.value = mtime ?? 0;
    workspace.isDirty.value = false;
    workspace.recentFiles.value = [path, ...workspace.recentFiles.value.filter((p) => p !== path)].slice(0, 20);
    persistSettings();
    return true;
  },

  async goBack(): Promise<void> {
    const idx = workspace.navIndex.value;
    if (idx <= 0) return;
    const target = workspace.navHistory.value[idx - 1];
    if (await workspace.openFileInternal(target, false)) {
      workspace.navIndex.value = idx - 1;
    }
  },

  async goForward(): Promise<void> {
    const idx = workspace.navIndex.value;
    const hist = workspace.navHistory.value;
    if (idx < 0 || idx >= hist.length - 1) return;
    const target = hist[idx + 1];
    if (await workspace.openFileInternal(target, false)) {
      workspace.navIndex.value = idx + 1;
    }
  },

  setContent(content: string): void {
    workspace.openFileContent.value = content;
    if (!workspace.isDirty.value) {
      workspace.isDirty.value = true;
    }
  },

  async saveCurrent(): Promise<void> {
    const path = workspace.openFilePath.value;
    const content = workspace.openFileContent.value;
    if (path === null || content === null) return;
    if (workspace.directoryHandle.value === null) return;
    const diskMtime = await getFileMtime(workspace.directoryHandle.value!, path);
    if (diskMtime !== null && workspace.openFileMtime.value !== 0 && diskMtime !== workspace.openFileMtime.value) {
      const choice = toConfirmResult(await workspace.confirmConflict());
      if (choice === ConfirmResult.CANCEL) return;
      if (choice === ConfirmResult.OVERWRITE) {
        const diskContent = await readFile(workspace.directoryHandle.value!, path);
        if (diskContent !== null) {
          workspace.openFileContent.value = diskContent;
          workspace.openFileMtime.value = diskMtime;
          workspace.isDirty.value = false;
        }
        return;
      }
      // KEEP_LOCAL or MANUAL_MERGE -> proceed to write local content
    }
    await writeFile(workspace.directoryHandle.value!, path, content);
    workspace.isDirty.value = false;
    const newMtime = await getFileMtime(workspace.directoryHandle.value!, path);
    if (newMtime !== null) workspace.openFileMtime.value = newMtime;
    await refreshTree();
  },

  async createFile(path: string): Promise<void> {
    if (workspace.directoryHandle.value === null) return;
    await fsCreateFile(workspace.directoryHandle.value!, path);
    await refreshTree();
    await workspace.openFile(path);
  },

  async createDirectory(path: string): Promise<void> {
    if (workspace.directoryHandle.value === null) return;
    await fsCreateDirectory(workspace.directoryHandle.value!, path);
    await refreshTree();
  },

  async deleteFile(path: string): Promise<void> {
    if (workspace.directoryHandle.value === null) return;
    const confirmed = await workspace.confirmDelete(path);
    if (!confirmed) return;
    await fsDeleteFile(workspace.directoryHandle.value!, path);
    if (workspace.openFilePath.value === path) {
      workspace.openFilePath.value = null;
      workspace.openFileContent.value = null;
      workspace.isDirty.value = false;
    }
    await refreshTree();
  },

  async deleteDirectory(path: string): Promise<void> {
    if (workspace.directoryHandle.value === null) return;
    const confirmed = await workspace.confirmDelete(path);
    if (!confirmed) return;
    await fsDeleteDirectory(workspace.directoryHandle.value!, path);
    await refreshTree();
  },

  async moveFile(srcPath: string, destPath: string): Promise<void> {
    if (workspace.directoryHandle.value === null) return;
    const tree = workspace.tree.value;
    const edits = await updateReferences(
      tree,
      srcPath,
      destPath,
      (p) => readFile(workspace.directoryHandle.value!, p),
    );
    if (edits.length > 0) {
      const summary = edits.map((e) => ({ path: e.path, count: e.replacements.length }));
      const confirmed = await workspace.confirmReferences(summary);
      if (!confirmed) return;
      for (const edit of edits) {
        const content = await readFile(workspace.directoryHandle.value!, edit.path);
        if (content === null) continue;
        let updated = content;
        for (const r of edit.replacements) {
          updated = updated.split(r.match).join(r.replace);
        }
        await writeFile(workspace.directoryHandle.value!, edit.path, updated);
      }
    }
    await fsMoveEntry(workspace.directoryHandle.value!, srcPath, destPath);
    if (workspace.openFilePath.value === srcPath) {
      workspace.openFilePath.value = destPath;
    }
    await refreshTree();
  },

  async moveDirectory(srcPath: string, destPath: string): Promise<void> {
    if (workspace.directoryHandle.value === null) return;
    const tree = workspace.tree.value;
    const edits = await updateReferences(
      tree,
      srcPath,
      destPath,
      (p) => readFile(workspace.directoryHandle.value!, p),
    );
    if (edits.length > 0) {
      const summary = edits.map((e) => ({ path: e.path, count: e.replacements.length }));
      const confirmed = await workspace.confirmReferences(summary);
      if (!confirmed) return;
      for (const edit of edits) {
        const content = await readFile(workspace.directoryHandle.value!, edit.path);
        if (content === null) continue;
        let updated = content;
        for (const r of edit.replacements) {
          updated = updated.split(r.match).join(r.replace);
        }
        await writeFile(workspace.directoryHandle.value!, edit.path, updated);
      }
    }
    await fsMoveDirectory(workspace.directoryHandle.value!, srcPath, destPath);
    const open = workspace.openFilePath.value;
    if (open !== null && (open === srcPath || open.startsWith(srcPath + '/'))) {
      workspace.openFilePath.value = destPath + open.slice(srcPath.length);
    }
    await refreshTree();
  },

  async runSearch(query: SearchQuery): Promise<SearchHit[]> {
    if (workspace.directoryHandle.value === null) {
      workspace.searchResults.value = [];
      return [];
    }
    const results = await grepSearch(query, workspace.tree.value, (p) =>
      readFile(workspace.directoryHandle.value!, p),
    );
    workspace.searchResults.value = results;
    return results;
  },

  toggleSearch(open: boolean): void {
    workspace.searchOpen.value = open;
  },

  setTheme(theme: Theme): void {
    workspace.theme.value = theme;
    persistSettings();
  },
};

function persistSettings(): void {
  saveSettings({ recentFiles: workspace.recentFiles.value, theme: workspace.theme.value });
}

export function initWorkspace(): void {
  const settings = loadSettings();
  workspace.recentFiles.value = settings.recentFiles;
  workspace.theme.value = settings.theme;
}

async function refreshTree(): Promise<void> {
  const handle = workspace.directoryHandle.value;
  if (handle === null) {
    workspace.tree.value = [];
    return;
  }
  const tree = await listTree(handle);
  workspace.tree.value = tree;
}

export function resetWorkspace(): void {
  workspace.directoryHandle.value = null;
  workspace.permissionError.value = false;
  workspace.tree.value = [];
  workspace.openFilePath.value = null;
  workspace.openFileContent.value = null;
  workspace.openFileMtime.value = 0;
  workspace.isDirty.value = false;
  workspace.recentFiles.value = [];
  workspace.navHistory.value = [];
  workspace.navIndex.value = -1;
  workspace.searchOpen.value = false;
  workspace.searchResults.value = [];
  workspace.theme.value = 'light';
  workspace.editorVisible.value = true;
}
