import type { FileNode } from '../types';

const DB_NAME = 'md_rw';
const STORE_NAME = 'handles';
const KEY = 'root_directory';

export function pickDirectory(): Promise<FileSystemDirectoryHandle> {
  return (globalThis as unknown as {
    showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>;
  }).showDirectoryPicker();
}

export async function persistHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(handle, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(KEY);
    req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const MD_EXT = /\.(md|mkd|mdx|markdown)$/i;

export async function listTree(
  handle: FileSystemDirectoryHandle,
  prefix = '',
): Promise<FileNode[]> {
  const nodes: FileNode[] = [];
  for await (const entry of handle.values()) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.kind === 'directory') {
      nodes.push({
        path,
        name: entry.name,
        kind: 'directory',
        size: 0,
        mtime: 0,
      });
      const subHandle = await (handle as unknown as {
        getDirectoryHandle: (n: string) => Promise<FileSystemDirectoryHandle>;
      }).getDirectoryHandle(entry.name);
      const sub = await listTree(subHandle, path);
      nodes.push(...sub);
    } else {
      if (!MD_EXT.test(entry.name)) continue;
      const file = await (entry as unknown as {
        getFile: () => Promise<File>;
      }).getFile();
      nodes.push({
        path,
        name: entry.name,
        kind: 'file',
        size: file.size,
        mtime: file.lastModified,
      });
    }
  }
  return nodes;
}
