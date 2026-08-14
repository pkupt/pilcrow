import type { FileNode, FileSortKind } from '../types';

export function compareBy(kind: FileSortKind, a: FileNode, b: FileNode): number {
  if (a.kind !== b.kind) {
    return a.kind === 'directory' ? -1 : 1;
  }
  switch (kind) {
    case 'name':
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    case 'mtime':
      return b.mtime - a.mtime;
    case 'none':
      return 0;
  }
}

export function sortChildren(children: FileNode[], kind: FileSortKind): FileNode[] {
  return children.slice().sort((a, b) => compareBy(kind, a, b));
}
