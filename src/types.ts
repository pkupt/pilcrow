export type Theme = 'light' | 'dark';

export type FileSortKind = 'name' | 'mtime' | 'none';

export interface FileNode {
  path: string;
  name: string;
  kind: 'file' | 'directory';
  size: number;
  mtime: number;
}

export interface SearchHit {
  path: string;
  line: number;
  lineText: string;
  matchStart: number;
  matchEnd: number;
}

export interface Edit {
  path: string;
  replacements: Array<{ match: string; replace: string }>;
}

export interface Match {
  path: string;
  line: number;
  lineText: string;
}

export interface EditorOpts {
  initialText: string;
  theme: Theme;
  onDirty: () => void;
  onSave: () => void;
}
