import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/preact';
import { resetWorkspace, workspace } from '../src/store/workspace';
import { PreviewPane } from '../src/ui/PreviewPane';

beforeEach(() => {
  resetWorkspace();
});

describe('PreviewPane', () => {
  it('shows placeholder when no file open', () => {
    render(<PreviewPane />);
    const pane = document.querySelector('.preview-pane-content');
    expect(pane?.textContent).toContain('no preview');
  });

  it('renders markdown as HTML', async () => {
    workspace.openFileContent.value = '# Hello world';
    render(<PreviewPane />);
    await waitFor(() => {
      expect(document.querySelector('.preview-pane-content h1')).toBeTruthy();
    });
  });

  it('updates when content changes (debounced)', async () => {
    vi.useFakeTimers();
    workspace.openFileContent.value = '# First';
    render(<PreviewPane />);
    vi.advanceTimersByTime(300);
    await waitFor(() => expect(document.querySelector('h1')?.textContent).toContain('First'));
    workspace.openFileContent.value = '# Second';
    vi.advanceTimersByTime(300);
    await waitFor(() => expect(document.querySelector('h1')?.textContent).toContain('Second'));
    vi.useRealTimers();
  });

  it('intercepts wikilink clicks and triggers openFile', async () => {
    workspace.openFileContent.value = '[[Note A]]';
    workspace.tree.value = [
      { path: 'Note A.md', name: 'Note A.md', kind: 'file' as const, size: 0, mtime: 0 },
    ];
    const openSpy = vi.spyOn(workspace, 'openFile').mockResolvedValue(undefined);
    render(<PreviewPane />);
    await waitFor(() => expect(document.querySelector('.preview-pane-content a')).toBeTruthy());
    const link = document.querySelector('.preview-pane-content a') as HTMLAnchorElement;
    link.click();
    expect(openSpy).toHaveBeenCalledWith('Note A.md');
    openSpy.mockRestore();
  });

  it('shows error message for > 1MB files', async () => {
    workspace.openFileContent.value = 'x'.repeat(1_100_000);
    render(<PreviewPane />);
    await waitFor(() => {
      expect(document.querySelector('.preview-pane-content')?.textContent).toContain('too large');
    });
  });
});
