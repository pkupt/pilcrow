import { describe, it, expect } from 'vitest';
import { sortChildren } from '../src/ui/sortTree';
import type { FileNode } from '../src/types';

function node(path: string, kind: 'file' | 'directory' = 'file', mtime = 0): FileNode {
  return { path, name: path.split('/').pop()!, kind, size: 0, mtime };
}

const nodeName = (n: FileNode) => n.name;

describe('sortChildren', () => {
  it('sorts by name with natural, case-insensitive ordering', () => {
    const children = [node('note10.md', 'file'), node('note2.md', 'file'), node('a.md', 'file')];
    expect(sortChildren(children, 'name').map(nodeName)).toEqual(['a.md', 'note2.md', 'note10.md']);
  });

  it('puts directories before files within the name sort', () => {
    const children = [node('z.md', 'file'), node('assets', 'directory'), node('a.md', 'file')];
    expect(sortChildren(children, 'name').map(nodeName)).toEqual(['assets', 'a.md', 'z.md']);
  });

  it('sorts by mtime newest first', () => {
    const children = [node('old.md', 'file', 10), node('new.md', 'file', 30), node('mid.md', 'file', 20)];
    expect(sortChildren(children, 'mtime').map(nodeName)).toEqual(['new.md', 'mid.md', 'old.md']);
  });

  it('puts directories before files in the mtime sort (groups stay separate)', () => {
    const children = [
      node('b.md', 'file', 50),
      node('d1', 'directory', 5),
      node('d2', 'directory', 10),
      node('a.md', 'file', 40),
    ];
    expect(sortChildren(children, 'mtime').map(nodeName)).toEqual(['d2', 'd1', 'b.md', 'a.md']);
  });

  it('keeps original order when kind is none', () => {
    const children = [node('z.md'), node('a.md'), node('m.md')];
    expect(sortChildren(children, 'none').map(nodeName)).toEqual(['z.md', 'a.md', 'm.md']);
  });

  it('returns a new array (does not alias) for none', () => {
    const children = [node('same.md', 'file', 5), node('same.md', 'file', 9)];
    const result = sortChildren(children, 'none');
    expect(result).toEqual(children);
    expect(result).not.toBe(children);
  });

  it('does not mutate the input array', () => {
    const children = [node('b.md'), node('a.md')];
    const copy = children.slice();
    sortChildren(children, 'name');
    expect(children).toEqual(copy);
  });
});