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
