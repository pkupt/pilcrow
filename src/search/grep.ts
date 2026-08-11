import type { FileNode, SearchHit } from '../types';

export interface SearchQuery {
  pattern: string;
  isRegex: boolean;
  caseSensitive: boolean;
  fileGlob: string | null;
}

type ReadFn = (path: string) => Promise<string | null> | (string | null);

function globToRegex(glob: string): RegExp {
  const re = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${re}$`);
}

export async function search(
  query: SearchQuery,
  tree: FileNode[],
  readFn: ReadFn,
): Promise<SearchHit[]> {
  const flags = query.caseSensitive ? 'g' : 'gi';
  const pattern = query.isRegex ? query.pattern : query.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(pattern, flags);
  const globRe = query.fileGlob ? globToRegex(query.fileGlob) : null;
  const hits: SearchHit[] = [];
  for (const node of tree) {
    if (node.kind !== 'file') continue;
    if (globRe && !globRe.test(node.path)) continue;
    const content = await readFn(node.path);
    if (content === null) continue;
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(line)) !== null) {
        hits.push({
          path: node.path,
          line: i + 1,
          lineText: line,
          matchStart: m.index,
          matchEnd: m.index + m[0].length,
        });
        if (m[0] === '') re.lastIndex++; // avoid zero-width loop
      }
    }
  }
  return hits;
}
