import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { resetWorkspace, workspace } from '../src/store/workspace';
import { FileTree } from '../src/ui/FileTree';

function node(path: string, kind: 'file' | 'directory' = 'file') {
  return { path, name: path.split('/').pop()!, kind, size: 0, mtime: 0 };
}

beforeEach(() => {
  resetWorkspace();
  workspace.tree.value = [
    node('a.md'),
    node('notes', 'directory'),
    node('notes/b.md'),
  ];
});

describe('FileTree', () => {
  it('renders file nodes', () => {
    render(<FileTree />);
    expect(screen.getByText('a.md')).toBeTruthy();
    expect(screen.getByText('notes')).toBeTruthy();
  });

  it('clicks a file to open it', async () => {
    const openSpy = vi.spyOn(workspace, 'openFile').mockResolvedValue(undefined);
    render(<FileTree />);
    fireEvent.click(screen.getByText('a.md'));
    expect(openSpy).toHaveBeenCalledWith('a.md');
    openSpy.mockRestore();
  });

  it('shows context menu on right-click', () => {
    render(<FileTree />);
    fireEvent.contextMenu(screen.getByText('a.md'));
    expect(screen.getByText(/new file/i)).toBeTruthy();
    expect(screen.getByText(/rename/i)).toBeTruthy();
    expect(screen.getByText(/delete/i)).toBeTruthy();
  });

  it('triggers createFile from context menu', async () => {
    const createSpy = vi.spyOn(workspace, 'createFile').mockResolvedValue(undefined);
    render(<FileTree />);
    fireEvent.contextMenu(screen.getByText('a.md'));
    fireEvent.click(screen.getByText(/new file/i));
    expect(createSpy).toHaveBeenCalled();
    createSpy.mockRestore();
  });

  it('triggers delete from context menu', async () => {
    const delSpy = vi.spyOn(workspace, 'deleteFile').mockResolvedValue(undefined);
    workspace.confirmDelete = vi.fn().mockResolvedValue(true);
    render(<FileTree />);
    fireEvent.contextMenu(screen.getByText('a.md'));
    fireEvent.click(screen.getByText(/delete/i));
    expect(delSpy).toHaveBeenCalledWith('a.md');
    delSpy.mockRestore();
  });
});

describe('FileTree sorting', () => {
  it('renders by name with folders first when fileSort is name', () => {
    workspace.fileSort.value = 'name';
    workspace.tree.value = [
      node('z.md'),
      node('assets', 'directory'),
      node('a.md'),
      node('m.md'),
    ];
    render(<FileTree />);
    const names = [...document.querySelectorAll('.file-tree-item .node-name')].map((e) => e.textContent);
    expect(names).toEqual(['assets', 'a.md', 'm.md', 'z.md']);
  });

  it('renders by mtime newest first when fileSort is mtime', () => {
    workspace.fileSort.value = 'mtime';
    workspace.tree.value = [
      node('old.md', 'file'),
      node('new.md', 'file'),
      node('mid.md', 'file'),
    ];
    // Set distinct mtimes after building the list:
    workspace.tree.value = workspace.tree.value.map((n, i) => ({ ...n, mtime: [100, 300, 200][i] }));
    render(<FileTree />);
    const names = [...document.querySelectorAll('.file-tree-item .node-name')].map((e) => e.textContent);
    expect(names).toEqual(['new.md', 'mid.md', 'old.md']);
  });

  it('renders unsorted in original order when fileSort is none', () => {
    workspace.fileSort.value = 'none';
    workspace.tree.value = [node('z.md'), node('a.md'), node('m.md')];
    render(<FileTree />);
    const names = [...document.querySelectorAll('.file-tree-item .node-name')].map((e) => e.textContent);
    expect(names).toEqual(['z.md', 'a.md', 'm.md']);
  });

  it('sorts nested levels recursively with folders first when expanded', () => {
    workspace.fileSort.value = 'name';
    workspace.tree.value = [
      node('z.md'),
      node('notes', 'directory'),
      node('b.md'),
      node('notes/x.md'),
      node('notes/sub', 'directory'),
      node('notes/a.md'),
      node('notes/sub/deep.md'),
    ];
    render(<FileTree />);
    fireEvent.click(screen.getByText('notes'));
    const names = [...document.querySelectorAll('.file-tree-item .node-name')].map((e) => e.textContent);
    expect(names).toEqual(['notes', 'sub', 'a.md', 'x.md', 'b.md', 'z.md']);
  });
});
