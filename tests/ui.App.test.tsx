import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/preact';

afterEach(cleanup);
import { resetWorkspace, workspace } from '../src/store/workspace';
import { App } from '../src/ui/App';

describe('App', () => {
  it('renders the top bar with workspace name', () => {
    resetWorkspace();
    render(<App />);
    expect(screen.getByText(/md_rw/i)).toBeTruthy();
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
});
