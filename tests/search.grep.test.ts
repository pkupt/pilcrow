import { describe, it, expect } from 'vitest';
import type { FileNode } from '../src/types';
import { search } from '../src/search/grep';

function file(path: string): FileNode {
  return { path, name: path.split('/').pop()!, kind: 'file', size: 0, mtime: 0 };
}

const TREE: FileNode[] = [
  file('a.md'),
  file('b.md'),
  file('notes/c.md'),
];

const FAKE_READ = (path: string): string | null => {
  const map: Record<string, string> = {
    'a.md': 'hello world\nsecond line\n',
    'b.md': 'no match here\n',
    'notes/c.md': 'world peace\n',
  };
  return map[path] ?? null;
};

describe('search', () => {
  it('finds matches across files', async () => {
    const hits = await search(
      { pattern: 'world', isRegex: false, caseSensitive: false, fileGlob: null },
      TREE,
      FAKE_READ,
    );
    const paths = hits.map((h) => h.path).sort();
    expect(paths).toEqual(['a.md', 'notes/c.md']);
  });

  it('reports line number and text', async () => {
    const hits = await search(
      { pattern: 'second', isRegex: false, caseSensitive: false, fileGlob: null },
      TREE,
      FAKE_READ,
    );
    expect(hits).toHaveLength(1);
    expect(hits[0].line).toBe(2);
    expect(hits[0].lineText).toBe('second line');
    expect(hits[0].matchStart).toBe(0);
    expect(hits[0].matchEnd).toBe(6);
  });

  it('respects case sensitivity', async () => {
    const hits = await search(
      { pattern: 'World', isRegex: false, caseSensitive: true, fileGlob: null },
      TREE,
      FAKE_READ,
    );
    expect(hits).toHaveLength(0);
  });

  it('supports regex patterns', async () => {
    const hits = await search(
      { pattern: 'wor.d', isRegex: true, caseSensitive: false, fileGlob: null },
      TREE,
      FAKE_READ,
    );
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });

  it('filters by file glob', async () => {
    const hits = await search(
      { pattern: 'world', isRegex: false, caseSensitive: false, fileGlob: 'notes/*' },
      TREE,
      FAKE_READ,
    );
    expect(hits.every((h) => h.path.startsWith('notes/'))).toBe(true);
  });

  it('handles files that fail to read', async () => {
    const failingRead = (path: string): string | null => (path === 'b.md' ? null : FAKE_READ(path));
    const hits = await search(
      { pattern: 'world', isRegex: false, caseSensitive: false, fileGlob: null },
      TREE,
      failingRead,
    );
    expect(hits.map((h) => h.path).sort()).toEqual(['a.md', 'notes/c.md']);
  });
});
