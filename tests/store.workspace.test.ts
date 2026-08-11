import { describe, it, expect, vi } from 'vitest';
import { createMockFs } from './mocks/fs';
import { workspace, resetWorkspace, ConfirmResult } from '../src/store/workspace';

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
