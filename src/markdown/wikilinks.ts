import type { FileNode, Edit, Match } from '../types';

type ReadFn = (path: string) => Promise<string | null> | (string | null);

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
const REL_LINK_RE = /\[([^\]]*)\]\(([^)]+\.md)(?:#[^)]*)?\)/g;

export function resolveWikilink(name: string, tree: FileNode[]): string | null {
  // 1. Exact basename match - first hit wins.
  for (const node of tree) {
    if (node.kind !== 'file') continue;
    const base = node.name.replace(/\.[^.]+$/, '');
    if (base === name) return node.path;
  }
  // 2. Path substring match - first hit wins.
  for (const node of tree) {
    if (node.kind !== 'file') continue;
    const base = node.path.replace(/\.[^.]+$/, '');
    if (base.endsWith('/' + name) || base === name) return node.path;
  }
  for (const node of tree) {
    if (node.kind !== 'file') continue;
    const base = node.path.replace(/\.[^.]+$/, '');
    if (base.includes(name)) return node.path;
  }
  return null;
}

export async function findBacklinks(
  targetPath: string,
  tree: FileNode[],
  readFn: ReadFn,
): Promise<Match[]> {
  const targetBase = targetPath.replace(/\.[^.]+$/, '');
  const results: Match[] = [];
  for (const node of tree) {
    if (node.kind !== 'file' || node.path === targetPath) continue;
    const content = await readFn(node.path);
    if (!content) continue;
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let matched = false;
      let m: RegExpExecArray | null;
      WIKILINK_RE.lastIndex = 0;
      while ((m = WIKILINK_RE.exec(line)) !== null) {
        const linkName = m[1];
        const resolved = resolveWikilink(linkName, tree);
        if (resolved === targetPath) {
          matched = true;
          break;
        }
      }
      if (!matched) {
        REL_LINK_RE.lastIndex = 0;
        while ((m = REL_LINK_RE.exec(line)) !== null) {
          const linkPath = m[2];
          if (linkPath === targetPath || linkPath === targetBase + '.md') {
            matched = true;
            break;
          }
        }
      }
      if (matched) {
        results.push({ path: node.path, line: i + 1, lineText: line });
      }
    }
  }
  return results;
}

export async function updateReferences(
  tree: FileNode[],
  oldPath: string,
  newPath: string,
  readFn: ReadFn,
): Promise<Edit[]> {
  const oldBase = oldPath.replace(/\.[^.]+$/, '');
  const oldName = oldPath.split('/').pop()!.replace(/\.[^.]+$/, '');
  const newName = newPath.split('/').pop()!.replace(/\.[^.]+$/, '');
  const edits: Edit[] = [];
  for (const node of tree) {
    if (node.kind !== 'file' || node.path === oldPath) continue;
    const content = await readFn(node.path);
    if (!content) continue;
    const lines = content.split('\n');
    const replacements: Array<{ match: string; replace: string }> = [];
    for (const line of lines) {
      WIKILINK_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = WIKILINK_RE.exec(line)) !== null) {
        const fullMatch = m[0];
        const linkName = m[1];
        const alias = m[2];
        const resolved = resolveWikilink(linkName, tree);
        if (resolved === oldPath) {
          if (alias !== undefined) {
            replacements.push({ match: fullMatch, replace: `[[${newName}|${alias}]]` });
          } else {
            replacements.push({ match: fullMatch, replace: `[[${newName}]]` });
          }
        } else if (linkName === oldName && resolved === oldPath) {
          replacements.push({ match: fullMatch, replace: fullMatch.replace(oldName, newName) });
        }
      }
      REL_LINK_RE.lastIndex = 0;
      let rm: RegExpExecArray | null;
      while ((rm = REL_LINK_RE.exec(line)) !== null) {
        const fullMatch = rm[0];
        const linkPath = rm[2];
        if (linkPath === oldPath || linkPath === oldBase + '.md') {
          const replaced = fullMatch.replace(linkPath, newPath);
          if (replaced !== fullMatch) {
            replacements.push({ match: fullMatch, replace: replaced });
          }
        }
      }
    }
    if (replacements.length > 0) {
      edits.push({ path: node.path, replacements });
    }
  }
  return edits;
}