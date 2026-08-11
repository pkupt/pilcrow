import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import { resetWorkspace, workspace } from '../src/store/workspace';
import { SearchPanel } from '../src/ui/SearchPanel';

beforeEach(() => {
  resetWorkspace();
});

describe('SearchPanel', () => {
  it('renders search input', () => {
    render(<SearchPanel />);
    expect(screen.getByPlaceholderText(/search/i)).toBeTruthy();
  });

  it('runs search on submit and lists results', async () => {
    workspace.tree.value = [
      { path: 'a.md', name: 'a.md', kind: 'file' as const, size: 0, mtime: 0 },
    ];
    const hits = [
      { path: 'a.md', line: 1, lineText: 'hello world', matchStart: 0, matchEnd: 5 },
    ];
    const searchSpy = vi.spyOn(workspace, 'runSearch').mockImplementation(async () => {
      workspace.searchResults.value = hits;
      return hits;
    });
    render(<SearchPanel />);
    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.input(input, { target: { value: 'hello' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByText(/hello world/)).toBeTruthy();
    });
    expect(searchSpy).toHaveBeenCalled();
    searchSpy.mockRestore();
  });

  it('clicking a result opens the file', async () => {
    workspace.searchResults.value = [
      { path: 'a.md', line: 3, lineText: 'match', matchStart: 0, matchEnd: 5 },
    ];
    const openSpy = vi.spyOn(workspace, 'openFile').mockResolvedValue(undefined);
    render(<SearchPanel />);
    fireEvent.click(screen.getByText(/a\.md/));
    expect(openSpy).toHaveBeenCalledWith('a.md');
    openSpy.mockRestore();
  });
});
