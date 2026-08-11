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
} from '../fs/files';
import { updateReferences } from '../markdown/wikilinks';
import { search as grepSearch, type SearchQuery } from '../search/grep';

export enum ConfirmResult {
  SAVE = 'save',
  DISCARD = 'discard',
  CANCEL = 'cancel',
}

export const workspace = {
  directoryHandle: signal<FileSystemDirectoryHandle | null>(null),
  tree: signal<FileNode[]>([]),
  openFilePath: signal<string | null>(null),
  openFileContent: signal<string | null>(null),
  isDirty: signal<boolean>(false),
  recentFiles: signal<string[]>([]),
  searchOpen: signal<boolean>(false),
  searchResults: signal<SearchHit[]>([]),
  theme: signal<Theme>('light'),

  // Overridable hooks for UI confirmation dialogs.
  confirmDirty: async (): Promise<ConfirmResult> => ConfirmResult.DISCARD,
  confirmReferences: async (_edits: { path: string; count: number }[]): Promise<boolean> => true,
  confirmDelete: async (_path: string): Promise<boolean> => true,

  async openWorkspace(handle?: FileSystemDirectoryHandle): Promise<void> {
    let root = handle ?? (await loadHandle());
    if (!root) {
      root = await pickDirectory();
      await persistHandle(root);
    } else {
      await persistHandle(root);
    }
    workspace.directoryHandle.value = root;
    await refreshTree();
    workspace.openFilePath.value = null;
    workspace.openFileContent.value = null;
    workspace.isDirty.value = false;
  },

  async openFile(path: string): Promise<void> {
    if (workspace.isDirty.value && workspace.openFilePath.value !== null) {
      const result = await workspace.confirmDirty();
      if (result === ConfirmResult.CANCEL) return;
      if (result === ConfirmResult.SAVE) await workspace.saveCurrent();
    }
    const content = await readFile(workspace.directoryHandle.value!, path);
    if (content === null) return;
    workspace.openFilePath.value = path;
    workspace.openFileContent.value = content;
    workspace.isDirty.value = false;
    workspace.recentFiles.value = [path, ...workspace.recentFiles.value.filter((p) => p !== path)].slice(0, 20);
  },

  setContent(content: string): void {
    workspace.openFileContent.value = content;
    if (!workspace.isDirty.value) {
      workspace.isDirty.value = true;
    }
  },

  async saveCurrent(): Promise<void> {
    const path = workspace.openFilePath.value;
    const savedContent = workspace.openFileContent.value;
    if (path === null || savedContent === null) return;
    await writeFile(workspace.directoryHandle.value!, path, savedContent);
    if (workspace.openFileContent.value === savedContent) {
      workspace.isDirty.value = false;
    }
    await refreshTree();
  },

  async createFile(path: string): Promise<void> {
    await fsCreateFile(workspace.directoryHandle.value!, path);
    await refreshTree();
    await workspace.openFile(path);
  },

  async createDirectory(path: string): Promise<void> {
    await fsCreateDirectory(workspace.directoryHandle.value!, path);
    await refreshTree();
  },

  async deleteFile(path: string): Promise<void> {
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
    const confirmed = await workspace.confirmDelete(path);
    if (!confirmed) return;
    await fsDeleteDirectory(workspace.directoryHandle.value!, path);
    await refreshTree();
  },

  async moveFile(srcPath: string, destPath: string): Promise<void> {
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

  async runSearch(query: SearchQuery): Promise<SearchHit[]> {
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
  },
};

async function refreshTree(): Promise<void> {
  const tree = await listTree(workspace.directoryHandle.value!);
  workspace.tree.value = tree;
}

export function resetWorkspace(): void {
  workspace.directoryHandle.value = null;
  workspace.tree.value = [];
  workspace.openFilePath.value = null;
  workspace.openFileContent.value = null;
  workspace.isDirty.value = false;
  workspace.recentFiles.value = [];
  workspace.searchOpen.value = false;
  workspace.searchResults.value = [];
  workspace.theme.value = 'light';
}
