import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from '../src/store/settings';
import { workspace, resetWorkspace, initWorkspace } from '../src/store/workspace';
import { createMockFs } from './mocks/fs';

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

beforeEach(() => {
  localStorage.clear();
  resetWorkspace();
});

describe('settings persistence', () => {
  it('loadSettings returns defaults when nothing stored', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips recentFiles and theme', () => {
    saveSettings({ recentFiles: ['a.md', 'b.md'], theme: 'dark', fileSort: 'name' });
    const loaded = loadSettings();
    expect(loaded.recentFiles).toEqual(['a.md', 'b.md']);
    expect(loaded.theme).toBe('dark');
  });

  it('returns defaults for corrupt storage', () => {
    localStorage.setItem('pilcrow_settings', '{not json');
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('setTheme persists the theme', () => {
    workspace.setTheme('dark');
    expect(loadSettings().theme).toBe('dark');
  });

  it('openFile updates recentFiles and persists', async () => {
    const fs = createMockFs({ 'a.md': 'A' });
    await workspace.openWorkspace(fs.handle);
    await workspace.openFile('a.md');
    expect(loadSettings().recentFiles).toEqual(['a.md']);
  });

  it('initWorkspace applies persisted settings', () => {
    saveSettings({ recentFiles: ['x.md'], theme: 'dark', fileSort: 'name' });
    initWorkspace();
    expect(workspace.theme.value).toBe('dark');
    expect(workspace.recentFiles.value).toEqual(['x.md']);
  });

  it('loadSettings falls back to name for an unknown fileSort value', () => {
    saveSettings({ recentFiles: [], theme: 'light', fileSort: 'bogus' as never });
    expect(loadSettings().fileSort).toBe('name');
  });

  it('round-trips fileSort through save/load', () => {
    saveSettings({ recentFiles: [], theme: 'light', fileSort: 'mtime' });
    expect(loadSettings().fileSort).toBe('mtime');
  });

  it('setFileSort persists the mode', () => {
    workspace.setFileSort('none');
    expect(loadSettings().fileSort).toBe('none');
  });

  it('initWorkspace applies the persisted fileSort', () => {
    saveSettings({ recentFiles: [], theme: 'light', fileSort: 'mtime' });
    initWorkspace();
    expect(workspace.fileSort.value).toBe('mtime');
  });
});
