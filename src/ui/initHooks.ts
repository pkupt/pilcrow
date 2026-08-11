import { workspace, ConfirmResult } from '../store/workspace';
import { askDialog } from './Dialogs';

export function initHooks(): void {
  workspace.confirmDirty = async (): Promise<ConfirmResult> => {
    const choice = await askDialog({
      title: 'Unsaved changes',
      message: 'You have unsaved changes in the current file. What would you like to do?',
      buttons: [
        { label: 'Save', value: ConfirmResult.SAVE, primary: true },
        { label: 'Discard', value: ConfirmResult.DISCARD },
        { label: 'Cancel', value: ConfirmResult.CANCEL },
      ],
    });
    return choice as ConfirmResult;
  };

  workspace.confirmConflict = async (): Promise<ConfirmResult> => {
    const choice = await askDialog({
      title: 'File changed on disk',
      message: 'This file was modified outside the editor. How do you want to resolve the conflict?',
      buttons: [
        { label: 'Keep local', value: ConfirmResult.KEEP_LOCAL, primary: true },
        { label: 'Overwrite', value: ConfirmResult.OVERWRITE },
        { label: 'Manual merge', value: ConfirmResult.MANUAL_MERGE },
      ],
    });
    return choice as ConfirmResult;
  };

  workspace.confirmDelete = async (path: string): Promise<boolean> => {
    const choice = await askDialog({
      title: 'Confirm delete',
      message: `Delete "${path}"?`,
      buttons: [
        { label: 'Delete', value: 'yes', primary: true },
        { label: 'Cancel', value: 'no' },
      ],
    });
    return choice === 'yes';
  };

  workspace.confirmReferences = async (
    edits: { path: string; count: number }[],
  ): Promise<boolean> => {
    const list = edits.map((e) => `- ${e.path} (${e.count})`).join('\n');
    const choice = await askDialog({
      title: 'Update references',
      message: `Renaming updates references in:\n${list}\n\nProceed?`,
      buttons: [
        { label: 'Update', value: 'yes', primary: true },
        { label: 'Cancel', value: 'no' },
      ],
    });
    return choice === 'yes';
  };
}
