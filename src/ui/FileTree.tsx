import { useSignal } from '@preact/signals';
import type { FileNode } from '../types';
import { workspace } from '../store/workspace';

interface TreeNode extends FileNode {
  depth: number;
  expanded?: boolean;
  children?: TreeNode[];
}

function buildTree(nodes: FileNode[]): TreeNode[] {
  const byPath = new Map<string, TreeNode>();
  for (const node of nodes) {
    byPath.set(node.path, { ...node, depth: 0, children: [] });
  }
  const roots: TreeNode[] = [];
  for (const node of nodes) {
    const item = byPath.get(node.path)!;
    const idx = node.path.lastIndexOf('/');
    if (idx === -1) {
      roots.push(item);
    } else {
      const parent = byPath.get(node.path.substring(0, idx));
      if (parent) parent.children!.push(item);
      else roots.push(item);
    }
  }
  return roots;
}

function flatten(nodes: TreeNode[], expanded: Set<string>, depth = 0): TreeNode[] {
  const out: TreeNode[] = [];
  for (const node of nodes) {
    out.push({ ...node, depth });
    if (
      node.kind === 'directory' &&
      expanded.has(node.path) &&
      node.children &&
      node.children.length > 0
    ) {
      out.push(...flatten(node.children, expanded, depth + 1));
    }
  }
  return out;
}

export function FileTree() {
  const expanded = useSignal<Set<string>>(new Set());
  const contextMenu = useSignal<{ path: string; x: number; y: number } | null>(null);

  const tree = workspace.tree.value;
  const flat = flatten(buildTree(tree), expanded.value);
  const noHandle = workspace.directoryHandle.value === null;

  const handleSelectFolder = () => {
    void workspace.openWorkspace();
  };

  const handleOpen = (node: FileNode) => {
    if (node.kind === 'file') {
      void workspace.openFile(node.path);
    } else {
      const next = new Set(expanded.value);
      if (next.has(node.path)) next.delete(node.path);
      else next.add(node.path);
      expanded.value = next;
    }
  };

  const handleContextMenu = (e: MouseEvent, node: FileNode) => {
    e.preventDefault();
    contextMenu.value = { path: node.path, x: e.clientX, y: e.clientY };
  };

  const closeMenu = () => (contextMenu.value = null);

  const handleNewFile = async () => {
    const name = prompt('New file name (e.g. note.md):') || 'untitled.md';
    closeMenu();
    await workspace.createFile(name);
  };

  const handleRename = async (path: string) => {
    const newName = prompt('Rename to:', path.split('/').pop());
    if (!newName) return closeMenu();
    const dir = path.includes('/') ? path.substring(0, path.lastIndexOf('/') + 1) : '';
    await workspace.moveFile(path, dir + newName);
    closeMenu();
  };

  const handleDelete = async (path: string) => {
    const node = tree.find((n) => n.path === path);
    if (node?.kind === 'directory') {
      await workspace.deleteDirectory(path);
    } else {
      await workspace.deleteFile(path);
    }
    closeMenu();
  };

  return (
    <div class="file-tree" data-testid="file-tree">
      <div class="file-tree-header">
        <span>Files</span>
        <button onClick={handleNewFile} title="New file" disabled={noHandle}>+</button>
      </div>
      {noHandle && flat.length === 0 ? (
        <div class="file-tree-empty">
          <p>No folder open.</p>
          <button onClick={handleSelectFolder}>Select folder</button>
        </div>
      ) : (
        <ul class="file-tree-list">
          {flat.map((node) => (
            <li
              key={node.path}
              class={`file-tree-item ${node.kind}`}
              style={{ paddingLeft: `${8 + node.depth * 16}px` }}
              onClick={() => handleOpen(node)}
              onContextMenu={(e) => handleContextMenu(e, node)}
              draggable
              onDragStart={(e) => e.dataTransfer?.setData('text/plain', node.path)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const src = e.dataTransfer?.getData('text/plain');
                if (src && src !== node.path) {
                  const draggedNode = tree.find((n) => n.path === src);
                  const dest = node.kind === 'directory'
                    ? `${node.path}/${src.split('/').pop()}`
                    : node.path;
                  if (draggedNode?.kind === 'directory') {
                    void workspace.moveDirectory(src, dest);
                  } else {
                    void workspace.moveFile(src, dest);
                  }
                }
              }}
            >
              <span class="node-icon" aria-hidden="true">{node.kind === 'directory' ? '📁' : '📄'}</span>
              <span class="node-name">{node.name}</span>
            </li>
          ))}
        </ul>
      )}
      {contextMenu.value && (
        <div
          class="context-menu"
          style={{ left: `${contextMenu.value.x}px`, top: `${contextMenu.value.y}px` }}
        >
          <button onClick={handleNewFile}>New file</button>
          <button onClick={() => handleRename(contextMenu.value!.path)}>Rename</button>
          <button onClick={() => handleDelete(contextMenu.value!.path)}>Delete</button>
        </div>
      )}
    </div>
  );
}
