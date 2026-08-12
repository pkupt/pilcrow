import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import { workspace, resetWorkspace, ConfirmResult } from '../src/store/workspace';
import { DialogHost, askDialog, closeDialog } from '../src/ui/Dialogs';
import { initHooks } from '../src/ui/initHooks';

beforeEach(() => {
  resetWorkspace();
  initHooks();
  closeDialog('');
});

describe('DialogHost', () => {
  it('renders a dialog and resolves on button click', async () => {
    render(<DialogHost />);
    const p = askDialog({
      title: 'Unsaved changes',
      message: 'You have unsaved changes.',
      buttons: [
        { label: 'Save', value: 'save' },
        { label: 'Cancel', value: 'cancel' },
      ],
    });
    await waitFor(() => expect(screen.getByText('Unsaved changes')).toBeTruthy());
    fireEvent.click(screen.getByText('Cancel'));
    await expect(p).resolves.toBe('cancel');
    await waitFor(() => expect(screen.queryByText('Unsaved changes')).toBeNull());
  });

  it('confirmDirty offers Save / Discard / Cancel', async () => {
    render(<DialogHost />);
    const p = workspace.confirmDirty();
    await waitFor(() => expect(screen.getByText('Discard')).toBeTruthy());
    fireEvent.click(screen.getByText('Discard'));
    await expect(p).resolves.toBe(ConfirmResult.DISCARD);
  });

  it('confirmConflict offers Keep local / Overwrite / Manual merge', async () => {
    render(<DialogHost />);
    const p = workspace.confirmConflict();
    await waitFor(() => expect(screen.getByText('Manual merge')).toBeTruthy());
    fireEvent.click(screen.getByText('Overwrite'));
    await expect(p).resolves.toBe(ConfirmResult.OVERWRITE);
  });

  it('confirmDelete shows the path and returns true only on Delete', async () => {
    render(<DialogHost />);
    const p = workspace.confirmDelete('notes/a.md');
    await waitFor(() => expect(screen.getByText(/notes\/a\.md/)).toBeTruthy());
    fireEvent.click(screen.getByText('Delete'));
    await expect(p).resolves.toBe(true);
  });

  it('confirmReferences lists affected files with counts', async () => {
    render(<DialogHost />);
    const p = workspace.confirmReferences([{ path: 'b.md', count: 3 }]);
    await waitFor(() => expect(screen.getByText(/b\.md \(3\)/)).toBeTruthy());
    fireEvent.click(screen.getByText('Cancel'));
    await expect(p).resolves.toBe(false);
  });

  it('serializes overlapping dialogs so each resolves in order', async () => {
    render(<DialogHost />);
    const p1 = workspace.confirmDirty();
    const p2 = workspace.confirmConflict();
    await waitFor(() => expect(screen.getByText('Unsaved changes')).toBeTruthy());
    expect(screen.queryByText('File changed on disk')).toBeNull();
    fireEvent.click(screen.getByText('Discard'));
    await expect(p1).resolves.toBe(ConfirmResult.DISCARD);
    await waitFor(() => expect(screen.getByText('File changed on disk')).toBeTruthy());
    fireEvent.click(screen.getByText('Overwrite'));
    await expect(p2).resolves.toBe(ConfirmResult.OVERWRITE);
  });
});
