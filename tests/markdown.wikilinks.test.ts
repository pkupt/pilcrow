import { describe, it, expect } from 'vitest';
import type { FileNode } from '../src/types';
import { resolveWikilink, findBacklinks, updateReferences } from '../src/markdown/wikilinks';

function file(path: string): FileNode {
  const name = path.split('/').pop()!;
  return { path, name, kind: 'file', size: 0, mtime: 0 };
}

const TREE: FileNode[] = [
  file('notes/a.md'),
  file('notes/sub/a.md'),
  file('notes/b.md'),
  file('other.md'),
];

const FAKE_READ = (path: string): string | null => {
  const map: Record<string, string> = {
    'notes/b.md': 'see [[a]] and [link](notes/a.md) and [[a|alias]]',
    'other.md': 'ref [[notes/sub/a]]',
  };
  return map[path] ?? null;
};

describe('resolveWikilink', () => {
  it('matches basename exactly', () => {
    expect(resolveWikilink('b', TREE)).toBe('notes/b.md');
  });

  it('matches full path when basename is ambiguous', () => {
    // "a" is ambiguous (notes/a.md and notes/sub/a.md) -> returns first hit
    const result = resolveWikilink('a', TREE);
    expect(result).toBe('notes/a.md');
  });

  it('matches by path substring', () => {
    expect(resolveWikilink('sub/a', TREE)).toBe('notes/sub/a.md');
  });

  it('returns null when no match', () => {
    expect(resolveWikilink('nonexistent', TREE)).toBeNull();
  });
});

describe('findBacklinks', () => {
  it('finds [[target]] references', async () => {
    const links = await findBacklinks('notes/a.md', TREE, FAKE_READ);
    expect(links).toHaveLength(1);
    expect(links[0].path).toBe('notes/b.md');
  });

  it('finds relative link references', async () => {
    const links = await findBacklinks('notes/a.md', TREE, FAKE_READ);
    const allLines = links.map((l) => l.lineText).join('\n');
    expect(allLines).toContain('](notes/a.md)');
  });
});

describe('updateReferences', () => {
  it('produces edits for [[old]] -> [[new]]', async () => {
    const edits = await updateReferences(TREE, 'notes/a.md', 'notes/a-renamed.md', FAKE_READ);
    const bEdit = edits.find((e) => e.path === 'notes/b.md');
    expect(bEdit).toBeDefined();
    expect(bEdit!.replacements.some((r) => r.match.includes('[[a]]'))).toBe(true);
  });

  it('produces edits for relative links', async () => {
    const edits = await updateReferences(TREE, 'notes/a.md', 'notes/a-renamed.md', FAKE_READ);
    const bEdit = edits.find((e) => e.path === 'notes/b.md');
    expect(bEdit!.replacements.some((r) => r.match.includes('](notes/a.md)'))).toBe(true);
  });

  it('returns empty array when no references', async () => {
    const edits = await updateReferences(TREE, 'notes/b.md', 'notes/b-renamed.md', FAKE_READ);
    expect(edits).toHaveLength(0);
  });
});