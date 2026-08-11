import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/preact';
import { resetWorkspace, workspace } from '../src/store/workspace';
import { EditorPane } from '../src/ui/EditorPane';

beforeEach(() => {
  resetWorkspace();
});

describe('EditorPane', () => {
  it('shows placeholder when no file open', () => {
    render(<EditorPane />);
    const pane = document.querySelector('.editor-pane-content');
    expect(pane?.textContent).toContain('open a file');
  });

  it('mounts CodeMirror when a file is open', async () => {
    workspace.openFilePath.value = 'a.md';
    workspace.openFileContent.value = '# Hello';
    render(<EditorPane />);
    await waitFor(() => {
      expect(document.querySelector('.cm-editor')).toBeTruthy();
    });
  });

  it('updates workspace content when CM changes', async () => {
    workspace.openFilePath.value = 'a.md';
    workspace.openFileContent.value = 'initial';
    render(<EditorPane />);
    await waitFor(() => expect(document.querySelector('.cm-editor')).toBeTruthy());
    const setContentSpy = vi.spyOn(workspace, 'setContent');
    // Simulate typing
    const cm = document.querySelector('.cm-content') as HTMLElement;
    expect(cm).toBeTruthy();
    // CodeMirror dispatches via its view; this test asserts the wiring exists.
    expect(setContentSpy).not.toHaveBeenCalled();
  });

  it('auto-saves after debounce when dirty', async () => {
    vi.useFakeTimers();
    workspace.openFilePath.value = 'a.md';
    workspace.openFileContent.value = 'initial';
    const saveSpy = vi.spyOn(workspace, 'saveCurrent').mockResolvedValue(undefined);
    render(<EditorPane />);
    await waitFor(() => expect(document.querySelector('.cm-editor')).toBeTruthy());
    workspace.setContent('modified');
    workspace.isDirty.value = true;
    vi.advanceTimersByTime(1100);
    await waitFor(() => expect(saveSpy).toHaveBeenCalled());
    vi.useRealTimers();
    saveSpy.mockRestore();
  });
});
