import { describe, it, expect } from 'vitest';
import type { FileNode, SearchHit, Edit, Match, EditorOpts, Theme } from '../src/types';

describe('shared types', () => {
  it('FileNode shapes a file', () => {
    const node: FileNode = {
      path: 'notes/a.md',
      name: 'a.md',
      kind: 'file',
      size: 100,
      mtime: 1700000000,
    };
    expect(node.kind).toBe('file');
  });

  it('FileNode shapes a directory', () => {
    const node: FileNode = {
      path: 'notes',
      name: 'notes',
      kind: 'directory',
      size: 0,
      mtime: 0,
    };
    expect(node.kind).toBe('directory');
  });

  it('SearchHit carries line info', () => {
    const hit: SearchHit = {
      path: 'a.md',
      line: 3,
      lineText: 'hello world',
      matchStart: 0,
      matchEnd: 5,
    };
    expect(hit.line).toBe(3);
  });

  it('Edit groups replacements per file', () => {
    const edit: Edit = {
      path: 'a.md',
      replacements: [{ match: '[[old]]', replace: '[[new]]' }],
    };
    expect(edit.replacements).toHaveLength(1);
  });

  it('Match locates a backlink', () => {
    const m: Match = { path: 'b.md', line: 5, lineText: 'see [[old]]' };
    expect(m.path).toBe('b.md');
  });

  it('EditorOpts carries callbacks', () => {
    const opts: EditorOpts = {
      initialText: '',
      theme: 'light',
      onDirty: () => {},
      onSave: () => {},
    };
    expect(opts.theme).toBe('light');
  });

  it('Theme is light or dark', () => {
    const t: Theme = 'dark';
    expect(['light', 'dark']).toContain(t);
  });
});
