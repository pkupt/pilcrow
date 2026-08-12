import { describe, it, expect, vi } from 'vitest';
import { createMockFs } from './mocks/fs';
import { workspace, resetWorkspace, ConfirmResult } from '../src/store/workspace';
import { ConfirmResult as ConflictResult } from '../src/store/workspace';

vi.mock('../src/fs/directory', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../src/fs/directory')>();
  return {
    ...mod,
    persistHandle: vi.fn(async () => {}),
    loadHandle: vi.fn(async () => null),
    pickDirectory: vi.fn(async () => {
      throw new Error('pickDirectory not expected in tests');
    }),
  };
});

async function setup(initial: Record<string, string> = {}) {
  const fs = createMockFs(initial);
  resetWorkspace();
  await workspace.openWorkspace(fs.handle);
  return fs;
}

describe('store null-handle guards', () => {
  it('no-ops createFile when no handle', async () => {
    resetWorkspace();
    const fs = createMockFs({});
    await workspace.createFile('a.md');
    expect(fs.files.has('a.md')).toBe(false);
  });

  it('no-ops createDirectory when no handle', async () => {
    resetWorkspace();
    await workspace.createDirectory('notes');
    expect(workspace.tree.value).toEqual([]);
  });

  it('no-ops deleteFile when no handle', async () => {
    resetWorkspace();
    const delSpy = vi.spyOn(workspace, 'confirmDelete').mockResolvedValue(true);
    await workspace.deleteFile('a.md');
    expect(delSpy).not.toHaveBeenCalled();
    delSpy.mockRestore();
  });

  it('no-ops moveFile when no handle', async () => {
    resetWorkspace();
    await workspace.moveFile('a.md', 'b.md');
    expect(workspace.tree.value).toEqual([]);
  });

  it('no-ops saveCurrent when no handle', async () => {
    resetWorkspace();
    workspace.openFilePath.value = 'a.md';
    workspace.openFileContent.value = 'x';
    workspace.isDirty.value = true;
    await workspace.saveCurrent();
    expect(workspace.isDirty.value).toBe(true);
  });

  it('returns empty results from runSearch when no handle', async () => {
    resetWorkspace();
    const results = await workspace.runSearch({
      pattern: 'x',
      isRegex: false,
      caseSensitive: false,
      fileGlob: null,
    });
    expect(results).toEqual([]);
  });
});

describe('workspace.openWorkspace permission failures', () => {
  it('clears the handle and sets permissionError on NotAllowedError', async () => {
    resetWorkspace();
    const dirMod = await import('../src/fs/directory');
    const loadSpy = vi.spyOn(dirMod, 'loadHandle').mockResolvedValue({
      requestPermission: async (): Promise<PermissionState> => 'granted',
      values: () => {
        throw new DOMException('denied', 'NotAllowedError');
      },
    } as unknown as FileSystemDirectoryHandle);
    await workspace.openWorkspace();
    expect(workspace.directoryHandle.value).toBeNull();
    expect(workspace.permissionError.value).toBe(true);
    loadSpy.mockRestore();
  });
});

describe('workspace permission re-grant', () => {
  it('requests readwrite permission for a persisted handle on open', async () => {
    const fs = createMockFs({ 'a.md': 'a' });
    const permSpy = vi.spyOn(fs.handle, 'requestPermission');
    resetWorkspace();
    await workspace.openWorkspace(fs.handle);
    expect(permSpy).toHaveBeenCalledWith({ mode: 'readwrite' });
    permSpy.mockRestore();
  });

  it('falls back to the directory picker when permission is denied', async () => {
    const fs = createMockFs({ 'a.md': 'a' });
    const dirMod = await import('../src/fs/directory');
    const pickSpy = vi.spyOn(dirMod, 'pickDirectory').mockResolvedValue(fs.handle);
    const permSpy = vi.spyOn(fs.handle, 'requestPermission').mockResolvedValue('denied');
    resetWorkspace();
    await workspace.openWorkspace(fs.handle);
    expect(pickSpy).toHaveBeenCalled();
    expect(workspace.permissionError.value).toBe(false);
    expect(workspace.tree.value.map((n) => n.path)).toEqual(['a.md']);
    pickSpy.mockRestore();
    permSpy.mockRestore();
  });

  it('reGrantAccess re-requests permission and loads the workspace', async () => {
    const fs = createMockFs({ 'a.md': 'a' });
    const dirMod = await import('../src/fs/directory');
    const loadSpy = vi.spyOn(dirMod, 'loadHandle').mockResolvedValue(fs.handle);
    const permSpy = vi.spyOn(fs.handle, 'requestPermission').mockResolvedValue('granted');
    resetWorkspace();
    await workspace.reGrantAccess();
    expect(permSpy).toHaveBeenCalledWith({ mode: 'readwrite' });
    expect(workspace.permissionError.value).toBe(false);
    expect(workspace.tree.value.map((n) => n.path)).toEqual(['a.md']);
    loadSpy.mockRestore();
    permSpy.mockRestore();
  });
});

describe('workspace.openWorkspace', () => {
  it('loads the tree', async () => {
    await setup({ 'a.md': 'a', 'b.md': 'b' });
    const paths = workspace.tree.value.map((n) => n.path).sort();
    expect(paths).toEqual(['a.md', 'b.md']);
  });

  it('clears open file', async () => {
    await setup({ 'a.md': 'a' });
    expect(workspace.openFilePath.value).toBeNull();
    expect(workspace.openFileContent.value).toBeNull();
  });
});

describe('workspace.openFile', () => {
  it('loads file content', async () => {
    await setup({ 'a.md': '# Hello' });
    await workspace.openFile('a.md');
    expect(workspace.openFilePath.value).toBe('a.md');
    expect(workspace.openFileContent.value).toBe('# Hello');
    expect(workspace.isDirty.value).toBe(false);
  });

  it('adds to recent files', async () => {
    await setup({ 'a.md': 'a', 'b.md': 'b' });
    await workspace.openFile('a.md');
    await workspace.openFile('b.md');
    expect(workspace.recentFiles.value[0]).toBe('b.md');
    expect(workspace.recentFiles.value[1]).toBe('a.md');
  });

  it('prompts when current file is dirty', async () => {
    await setup({ 'a.md': 'a', 'b.md': 'b' });
    await workspace.openFile('a.md');
    workspace.openFileContent.value = 'modified';
    workspace.isDirty.value = true;
    const confirmSpy = vi.spyOn(workspace, 'confirmDirty').mockResolvedValue(ConfirmResult.CANCEL);
    await workspace.openFile('b.md');
    expect(workspace.openFilePath.value).toBe('a.md');
    confirmSpy.mockRestore();
  });

  it('treats an unrecognized confirmDirty result (backdrop dismiss) as cancel', async () => {
    await setup({ 'a.md': 'a', 'b.md': 'b' });
    await workspace.openFile('a.md');
    workspace.openFileContent.value = 'modified';
    workspace.isDirty.value = true;
    const confirmSpy = vi
      .spyOn(workspace, 'confirmDirty')
      .mockResolvedValue('' as ConfirmResult);
    await workspace.openFile('b.md');
    expect(workspace.openFilePath.value).toBe('a.md');
    expect(workspace.openFileContent.value).toBe('modified');
    confirmSpy.mockRestore();
  });
});

describe('workspace.saveCurrent', () => {
  it('writes content to disk and clears dirty', async () => {
    const fs = await setup({ 'a.md': 'old' });
    await workspace.openFile('a.md');
    workspace.openFileContent.value = 'new content';
    workspace.isDirty.value = true;
    await workspace.saveCurrent();
    expect(fs.files.get('a.md')).toBe('new content');
    expect(workspace.isDirty.value).toBe(false);
  });

  it('does nothing when no file open', async () => {
    await setup({ 'a.md': 'a' });
    await workspace.saveCurrent();
    expect(workspace.isDirty.value).toBe(false);
  });
});

describe('workspace.createFile', () => {
  it('creates a new empty file and refreshes tree', async () => {
    const fs = await setup({ 'a.md': 'a' });
    await workspace.createFile('new.md');
    expect(fs.files.has('new.md')).toBe(true);
    expect(workspace.tree.value.map((n) => n.path)).toContain('new.md');
  });
});

describe('workspace.deleteFile', () => {
  it('removes file from disk and tree', async () => {
    const fs = await setup({ 'a.md': 'a', 'b.md': 'b' });
    await workspace.deleteFile('a.md');
    expect(fs.files.has('a.md')).toBe(false);
    expect(workspace.tree.value.map((n) => n.path)).not.toContain('a.md');
  });

  it('clears open file if it was deleted', async () => {
    await setup({ 'a.md': 'a' });
    await workspace.openFile('a.md');
    await workspace.deleteFile('a.md');
    expect(workspace.openFilePath.value).toBeNull();
  });
});

describe('workspace.moveFile', () => {
  it('moves file and updates references (with confirmation)', async () => {
    const fs = await setup({
      'a.md': 'A',
      'b.md': 'see [[a]]',
    });
    vi.spyOn(workspace, 'confirmReferences').mockResolvedValue(true);
    await workspace.moveFile('a.md', 'a-renamed.md');
    expect(fs.files.has('a.md')).toBe(false);
    expect(fs.files.get('a-renamed.md')).toBe('A');
    expect(fs.files.get('b.md')).toContain('[[a-renamed]]');
  });
});

describe('workspace.moveDirectory', () => {
  it('moves a directory recursively and refreshes the tree', async () => {
    const fs = await setup({ 'src/a.md': 'A', 'src/sub/b.md': 'B' });
    await workspace.moveDirectory('src', 'notes/dst');
    expect(fs.files.has('src/a.md')).toBe(false);
    expect(fs.files.get('notes/dst/a.md')).toBe('A');
    expect(fs.files.get('notes/dst/sub/b.md')).toBe('B');
    expect(workspace.tree.value.map((n) => n.path)).toContain('notes/dst/a.md');
  });

  it('no-ops when no handle', async () => {
    resetWorkspace();
    await workspace.moveDirectory('src', 'notes/dst');
    expect(workspace.tree.value).toEqual([]);
  });

  it('rewrites openFilePath when the open file is inside the moved directory', async () => {
    await setup({ 'src/a.md': 'A' });
    await workspace.openFile('src/a.md');
    await workspace.moveDirectory('src', 'notes/dst');
    expect(workspace.openFilePath.value).toBe('notes/dst/a.md');
  });

  it('updates relative links to files inside the moved directory', async () => {
    const fs = await setup({ 'src/a.md': 'A', 'dst.md': '[see](./src/a.md)' });
    vi.spyOn(workspace, 'confirmReferences').mockResolvedValue(true);
    await workspace.moveDirectory('src', 'notes/dst');
    expect(fs.files.get('dst.md')).toContain('./notes/dst/a.md');
  });
});

describe('workspace.runSearch', () => {
  it('stores search results', async () => {
    await setup({ 'a.md': 'hello world', 'b.md': 'nope' });
    const results = await workspace.runSearch({
      pattern: 'world',
      isRegex: false,
      caseSensitive: false,
      fileGlob: null,
    });
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe('a.md');
  });
});

describe('workspace.saveCurrent conflict detection', () => {
  it('saves when mtime matches', async () => {
    const fs = await setup({ 'a.md': 'old' });
    await workspace.openFile('a.md');
    workspace.openFileContent.value = 'new';
    workspace.isDirty.value = true;
    await workspace.saveCurrent();
    expect(fs.files.get('a.md')).toBe('new');
    expect(workspace.isDirty.value).toBe(false);
  });

  it('prompts when disk mtime differs from open mtime', async () => {
    const fs = await setup({ 'a.md': 'old' });
    await workspace.openFile('a.md');
    // Simulate external modification: bump disk mtime (and optionally content)
    fs.files.set('a.md', 'external change');
    fs.mtimes.set('a.md', 999);
    workspace.openFileContent.value = 'local change';
    workspace.isDirty.value = true;
    const conflictSpy = vi.spyOn(workspace, 'confirmConflict').mockResolvedValue(ConflictResult.KEEP_LOCAL);
    await workspace.saveCurrent();
    expect(conflictSpy).toHaveBeenCalled();
    expect(fs.files.get('a.md')).toBe('local change');
    conflictSpy.mockRestore();
  });

  it('overwrites with disk version when user chooses OVERWRITE', async () => {
    const fs = await setup({ 'a.md': 'old' });
    await workspace.openFile('a.md');
    fs.files.set('a.md', 'external change');
    fs.mtimes.set('a.md', 999);
    workspace.openFileContent.value = 'local change';
    workspace.isDirty.value = true;
    const conflictSpy = vi.spyOn(workspace, 'confirmConflict').mockResolvedValue(ConflictResult.OVERWRITE);
    await workspace.saveCurrent();
    expect(workspace.openFileContent.value).toContain('external change');
    conflictSpy.mockRestore();
  });

  it('treats an unrecognized confirmConflict result (backdrop dismiss) as cancel', async () => {
    const fs = await setup({ 'a.md': 'old' });
    await workspace.openFile('a.md');
    fs.files.set('a.md', 'external change');
    fs.mtimes.set('a.md', 999);
    workspace.openFileContent.value = 'local change';
    workspace.isDirty.value = true;
    const conflictSpy = vi
      .spyOn(workspace, 'confirmConflict')
      .mockResolvedValue('' as ConflictResult);
    await workspace.saveCurrent();
    expect(fs.files.get('a.md')).toBe('external change');
    expect(workspace.openFileContent.value).toBe('local change');
    expect(workspace.isDirty.value).toBe(true);
    conflictSpy.mockRestore();
  });
});

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
