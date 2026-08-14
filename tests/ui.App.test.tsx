import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/preact';

afterEach(cleanup);
import { resetWorkspace, workspace, ConfirmResult } from '../src/store/workspace';
import { App } from '../src/ui/App';

describe('App', () => {
  it('renders the top bar with workspace name', () => {
    resetWorkspace();
    render(<App />);
    expect(screen.getByText(/pilcrow/i)).toBeTruthy();
  });

  it('renders three pane slots', () => {
    resetWorkspace();
    const { container } = render(<App />);
    expect(container.querySelector('[data-pane="tree"]')).toBeTruthy();
    expect(container.querySelector('[data-pane="editor"]')).toBeTruthy();
    expect(container.querySelector('[data-pane="preview"]')).toBeTruthy();
  });

  it('shows theme toggle button', () => {
    resetWorkspace();
    render(<App />);
    expect(screen.getByRole('button', { name: /theme/i })).toBeTruthy();
  });

  it('toggles theme on click', async () => {
    resetWorkspace();
    render(<App />);
    const btn = screen.getByRole('button', { name: /theme/i });
    btn.click();
    expect(workspace.theme.value).toBe('dark');
  });

  it('shows a select-folder button when no handle is set', () => {
    resetWorkspace();
    render(<App />);
    expect(screen.getByRole('button', { name: /select folder/i })).toBeTruthy();
  });

  it('shows a re-grant screen when permission was denied', () => {
    resetWorkspace();
    workspace.permissionError.value = true;
    render(<App />);
    expect(screen.getByRole('button', { name: /re-grant access/i })).toBeTruthy();
  });

  it('re-grant button calls workspace.reGrantAccess', () => {
    resetWorkspace();
    const grantSpy = vi.spyOn(workspace, 'reGrantAccess').mockResolvedValue(undefined);
    workspace.permissionError.value = true;
    render(<App />);
    const btn = screen.getByRole('button', { name: /re-grant access/i });
    btn.click();
    expect(grantSpy).toHaveBeenCalled();
    grantSpy.mockRestore();
  });

  it('select-folder button opens the workspace picker', () => {
    resetWorkspace();
    const openSpy = vi.spyOn(workspace, 'openWorkspace').mockResolvedValue(undefined);
    render(<App />);
    const btn = screen.getByRole('button', { name: /select folder/i });
    btn.click();
    expect(openSpy).toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it('Open button in the command bar switches the workspace folder', () => {
    resetWorkspace();
    const openSpy = vi.spyOn(workspace, 'openWorkspace').mockResolvedValue(undefined);
    render(<App />);
    const btn = screen.getByRole('button', { name: /open folder/i });
    btn.click();
    expect(openSpy).toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it('Open button forces the picker even when a handle is persisted', async () => {
    resetWorkspace();
    const pickerSpy = vi.spyOn(workspace, 'openWorkspace').mockResolvedValue(undefined);
    render(<App />);
    const btn = screen.getByRole('button', { name: /open folder/i });
    btn.click();
    expect(pickerSpy).toHaveBeenCalledWith(undefined, true);
    pickerSpy.mockRestore();
  });

  it('Open button does not switch when dirty edits are cancelled', async () => {
    resetWorkspace();
    workspace.openFilePath.value = 'a.md';
    workspace.openFileContent.value = 'edit';
    workspace.isDirty.value = true;
    const openSpy = vi.spyOn(workspace, 'openWorkspace').mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(workspace, 'confirmDirty').mockResolvedValue(ConfirmResult.CANCEL);
    render(<App />);
    const btn = screen.getByRole('button', { name: /open folder/i });
    btn.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(confirmSpy).toHaveBeenCalled();
    expect(openSpy).toHaveBeenCalledTimes(1);
    openSpy.mockRestore();
    confirmSpy.mockRestore();
  });

  it('tree resizer drag changes the tree pane width', async () => {
    resetWorkspace();
    const { container } = render(<App />);
    const resizer = container.querySelector('[data-resize="tree"]') as HTMLDivElement;
    const treePane = container.querySelector('[data-pane="tree"]') as HTMLElement;
    expect(treePane.style.width).toBe('240px');
    firePointerDrag(resizer, 40);
    await new Promise((r) => setTimeout(r, 0));
    expect(treePane.style.width).toBe('280px');
  });

  it('editor resizer drag changes editor/preview split', async () => {
    resetWorkspace();
    const { container } = render(<App />);
    const body = container.querySelector('.app-body') as HTMLElement;
    Object.defineProperty(body, 'clientWidth', { configurable: true, get: () => 800 });
    const resizer = container.querySelector('[data-resize="editor"]') as HTMLDivElement;
    const editorPane = container.querySelector('[data-pane="editor"]') as HTMLElement;
    const previewPane = container.querySelector('[data-pane="preview"]') as HTMLElement;
    expect(editorPane.style.flex).toBe('0.5 1 0px');
    firePointerDragEditor(resizer, 200);
    await new Promise((r) => setTimeout(r, 0));
    const ratio = parseFloat(editorPane.style.flex.split(' ')[0]);
    expect(ratio).toBeCloseTo(0.75, 5);
    const previewRatio = parseFloat(previewPane.style.flex.split(' ')[0]);
    expect(previewRatio).toBeCloseTo(0.25, 5);
  });

  it('resizer clamps widths to sane bounds', async () => {
    resetWorkspace();
    const { container } = render(<App />);
    const resizer = container.querySelector('[data-resize="tree"]') as HTMLDivElement;
    const treePane = container.querySelector('[data-pane="tree"]') as HTMLElement;
    firePointerDrag(resizer, -5000);
    await new Promise((r) => setTimeout(r, 0));
    expect(treePane.style.width).toBe('120px');
  });

  it('renders back/forward buttons disabled when no history', () => {
    resetWorkspace();
    render(<App />);
    const back = screen.getByRole('button', { name: /back/i });
    const fwd = screen.getByRole('button', { name: /forward/i });
    expect((back as HTMLButtonElement).disabled).toBe(true);
    expect((fwd as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables back after opening two files and navigates', async () => {
    resetWorkspace();
    workspace.directoryHandle.value = {} as FileSystemDirectoryHandle;
    workspace.navHistory.value = ['a.md', 'b.md'];
    workspace.navIndex.value = 1;
    const goBackSpy = vi.spyOn(workspace, 'goBack').mockResolvedValue(undefined);
    render(<App />);
    const back = screen.getByRole('button', { name: /back/i }) as HTMLButtonElement;
    expect(back.disabled).toBe(false);
    back.click();
    expect(goBackSpy).toHaveBeenCalled();
    goBackSpy.mockRestore();
  });

  it('History dropdown lists recentFiles and opens on click', async () => {
    resetWorkspace();
    workspace.directoryHandle.value = {} as FileSystemDirectoryHandle;
    workspace.recentFiles.value = ['a.md', 'b.md'];
    const openSpy = vi.spyOn(workspace, 'openFile').mockResolvedValue(undefined);
    render(<App />);
    screen.getByRole('button', { name: /history/i }).click();
    const item = await screen.findByText('a.md');
    item.click();
    expect(openSpy).toHaveBeenCalledWith('a.md');
    openSpy.mockRestore();
  });

  it('History dropdown shows empty state when no history', async () => {
    resetWorkspace();
    render(<App />);
    screen.getByRole('button', { name: /history/i }).click();
    expect(await screen.findByText(/no history/i)).toBeTruthy();
  });

  it('Preview toggle hides the editor pane and shows full-width preview', async () => {
    resetWorkspace();
    const { container } = render(<App />);
    expect(container.querySelector('[data-pane="editor"]')).toBeTruthy();
    screen.getByRole('button', { name: /preview/i }).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(container.querySelector('[data-pane="editor"]')).toBeFalsy();
    expect(container.querySelector('[data-resize="editor"]')).toBeFalsy();
    const preview = container.querySelector('[data-pane="preview"]') as HTMLElement;
    expect(preview.style.flex).toMatch(/^1 1 0/);
  });

  it('Edit toggle brings the editor pane back and restores the split ratio', async () => {
    resetWorkspace();
    const { container } = render(<App />);
    screen.getByRole('button', { name: /preview/i }).click();
    await new Promise((r) => setTimeout(r, 0));
    screen.getByRole('button', { name: /edit/i }).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(container.querySelector('[data-pane="editor"]')).toBeTruthy();
    expect(container.querySelector('[data-resize="editor"]')).toBeTruthy();
    const preview = container.querySelector('[data-pane="preview"]') as HTMLElement;
    expect(preview.style.flex).toMatch(/^0\.5 1 0/);
  });

  it('toggling to preview keeps the open file and content', async () => {
    resetWorkspace();
    workspace.openFilePath.value = 'a.md';
    workspace.openFileContent.value = '# hello';
    render(<App />);
    screen.getByRole('button', { name: /preview/i }).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(workspace.openFilePath.value).toBe('a.md');
    expect(workspace.openFileContent.value).toBe('# hello');
  });

  it('preview pane takes full remaining width when editor hidden', async () => {
    resetWorkspace();
    workspace.editorVisible.value = false;
    const { container } = render(<App />);
    const preview = container.querySelector('[data-pane="preview"]') as HTMLElement;
    expect(preview.style.flex).toMatch(/^1 1 0/);
    expect(container.querySelector('[data-pane="editor"]')).toBeFalsy();
    expect(container.querySelector('[data-resize="editor"]')).toBeFalsy();
  });

  it('editor pane renders when editorVisible is true', () => {
    resetWorkspace();
    const { container } = render(<App />);
    expect(container.querySelector('[data-pane="editor"]')).toBeTruthy();
    expect(container.querySelector('[data-resize="editor"]')).toBeTruthy();
  });

  it('Sort menu opens, marks the active mode, and applies a selection', async () => {
    resetWorkspace();
    workspace.fileSort.value = 'name';
    render(<App />);
    screen.getByRole('button', { name: /sort/i }).click();
    const menu = await screen.findByTestId('sort-menu');
    expect(menu.textContent).toContain('By name');
    expect(menu.textContent).toContain('By modified time');
    expect(menu.textContent).toContain('Unsorted');
    const nameItem = screen.getByRole('button', { name: /by name/i });
    expect(nameItem.getAttribute('aria-pressed')).toBe('true');
    screen.getByRole('button', { name: /by modified time/i }).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(workspace.fileSort.value).toBe('mtime');
    expect(screen.queryByTestId('sort-menu')).toBeFalsy();
  });

  it('By name is active by default when nothing set', async () => {
    resetWorkspace();
    render(<App />);
    screen.getByRole('button', { name: /sort/i }).click();
    await screen.findByTestId('sort-menu');
    expect(screen.getByRole('button', { name: /by name/i }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /unsorted/i }).getAttribute('aria-pressed')).toBe('false');
  });

  it('re-sorts the rendered tree reactively when the sort mode changes', async () => {
    resetWorkspace();
    workspace.tree.value = [
      { path: 'z.md', name: 'z.md', kind: 'file', size: 0, mtime: 300 },
      { path: 'a.md', name: 'a.md', kind: 'file', size: 0, mtime: 200 },
      { path: 'm.md', name: 'm.md', kind: 'file', size: 0, mtime: 100 },
    ];
    render(<App />);
    const names = () =>
      [...document.querySelectorAll('.file-tree-item .node-name')].map((e) => e.textContent);
    expect(names()).toEqual(['a.md', 'm.md', 'z.md']);
    screen.getByRole('button', { name: /sort/i }).click();
    await screen.findByTestId('sort-menu');
    screen.getByRole('button', { name: /by modified time/i }).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(workspace.fileSort.value).toBe('mtime');
    expect(names()).toEqual(['z.md', 'a.md', 'm.md']);
  });
});

function firePointerDrag(el: HTMLElement, dx: number): void {
  const w = 4;
  el.getBoundingClientRect = () =>
    ({ left: 244, top: 0, right: 248, bottom: 800, width: w, height: 800, x: 244, y: 0, toJSON: () => ({}) }) as DOMRect;
  const startX = 246;
  el.dispatchEvent(new PointerEvent('pointerdown', { clientX: startX, bubbles: true, cancelable: true }));
  window.dispatchEvent(new PointerEvent('pointermove', { clientX: startX + dx, bubbles: true }));
  window.dispatchEvent(new PointerEvent('pointerup', { clientX: startX + dx, bubbles: true }));
}

function firePointerDragEditor(el: HTMLElement, dx: number): void {
  const w = 4;
  el.getBoundingClientRect = () =>
    ({ left: 640, top: 0, right: 644, bottom: 800, width: w, height: 800, x: 640, y: 0, toJSON: () => ({}) }) as DOMRect;
  el.dispatchEvent(new PointerEvent('pointerdown', { clientX: 642, bubbles: true, cancelable: true }));
  window.dispatchEvent(new PointerEvent('pointermove', { clientX: 642 + dx, bubbles: true }));
  window.dispatchEvent(new PointerEvent('pointerup', { clientX: 642 + dx, bubbles: true }));
}
