import { describe, it, expect, vi } from 'vitest';
import { createEditor } from '../src/editor/cm';

describe('createEditor', () => {
  it('mounts into a parent element', () => {
    const parent = document.createElement('div');
    const ed = createEditor(parent, {
      initialText: 'hello',
      theme: 'light',
      onDirty: () => {},
      onSave: () => {},
    });
    expect(parent.querySelector('.cm-editor')).toBeTruthy();
    ed.destroy();
  });

  it('returns initial text via getValue', () => {
    const parent = document.createElement('div');
    const ed = createEditor(parent, {
      initialText: 'hello world',
      theme: 'light',
      onDirty: () => {},
      onSave: () => {},
    });
    expect(ed.getValue()).toBe('hello world');
    ed.destroy();
  });

  it('update() replaces content', () => {
    const parent = document.createElement('div');
    const ed = createEditor(parent, {
      initialText: 'a',
      theme: 'light',
      onDirty: () => {},
      onSave: () => {},
    });
    ed.update('new content');
    expect(ed.getValue()).toBe('new content');
    ed.destroy();
  });

  it('calls onDirty when content changes', () => {
    const parent = document.createElement('div');
    const onDirty = vi.fn();
    const ed = createEditor(parent, {
      initialText: '',
      theme: 'light',
      onDirty,
      onSave: () => {},
    });
    // Simulate typing via CM dispatch
    const view = (ed as unknown as { view: { dispatch: (t: unknown) => void } }).view;
    view.dispatch({ changes: { from: 0, insert: 'x' } });
    expect(onDirty).toHaveBeenCalled();
    ed.destroy();
  });

  it('destroy() removes the editor from DOM', () => {
    const parent = document.createElement('div');
    const ed = createEditor(parent, {
      initialText: '',
      theme: 'light',
      onDirty: () => {},
      onSave: () => {},
    });
    ed.destroy();
    expect(parent.querySelector('.cm-editor')).toBeNull();
  });
});
