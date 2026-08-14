import type { FileNode, FileSortKind } from '../types';

export function compareBy(kind: FileSortKind, a: FileNode, b: FileNode): number {
  if (kind !== 'none' && a.kind !== b.kind) {
    return a.kind === 'directory' ? -1 : 1;
  }
  switch (kind) {
    case 'name':
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    case 'mtime':
      return b.mtime - a.mtime;
    case 'none':
      return 0;
    default:
      throw new Error('unknown sort kind: ' + kind);
  }
}

export function sortChildren<T extends FileNode>(children: T[], kind: FileSortKind): T[] {
  return children.slice().sort((a, b) => compareBy(kind, a, b));
}
