import { describe, it, expect, beforeEach } from 'vitest';
import { createMockFs } from './mocks/fs';
import { listTree, persistHandle, loadHandle } from '../src/fs/directory';

describe('listTree', () => {
  it('walks a flat vault', async () => {
    const fs = createMockFs({ 'a.md': 'a', 'b.md': 'b' });
    const tree = await listTree(fs.handle);
    expect(tree.filter((n) => n.kind === 'file').map((n) => n.path).sort()).toEqual([
      'a.md',
      'b.md',
    ]);
  });

  it('walks nested directories', async () => {
    const fs = createMockFs({ 'notes/a.md': 'a', 'notes/sub/b.md': 'b' });
    const tree = await listTree(fs.handle);
    const paths = tree.map((n) => n.path).sort();
    expect(paths).toContain('notes');
    expect(paths).toContain('notes/a.md');
    expect(paths).toContain('notes/sub');
    expect(paths).toContain('notes/sub/b.md');
  });

  it('reports file sizes', async () => {
    const fs = createMockFs({ 'a.md': 'hello' });
    const tree = await listTree(fs.handle);
    const a = tree.find((n) => n.path === 'a.md')!;
    expect(a.size).toBe(5);
  });

  it('skips non-markdown files', async () => {
    const fs = createMockFs({ 'a.md': 'a', 'b.txt': 'b', 'c.json': '{}' });
    const tree = await listTree(fs.handle);
    const files = tree.filter((n) => n.kind === 'file');
    expect(files.map((n) => n.path)).toEqual(['a.md']);
  });
});

describe('handle persistence', () => {
  const store = new Map<string, unknown>();

  beforeEach(() => {
    store.clear();
    (globalThis as unknown as { indexedDB: unknown }).indexedDB = createFakeIndexedDb(store);
  });

  it('persistHandle then loadHandle returns same handle', async () => {
    const fs = createMockFs({ 'a.md': 'a' });
    await persistHandle(fs.handle);
    const loaded = await loadHandle();
    expect(loaded).toBe(fs.handle);
  });

  it('loadHandle returns null when nothing persisted', async () => {
    const loaded = await loadHandle();
    expect(loaded).toBeNull();
  });
});

function fireOnAssign(target: object, prop: string): void {
  let handler: unknown = null;
  Object.defineProperty(target, prop, {
    configurable: true,
    get: () => handler,
    set: (fn: unknown) => {
      handler = fn;
      if (typeof fn === 'function') queueMicrotask(() => (fn as () => void)());
    },
  });
}

function createFakeIndexedDb(store: Map<string, unknown>): unknown {
  const db: Record<string, unknown> = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => {},
    transaction: () => {
      const tx: Record<string, unknown> = {};
      fireOnAssign(tx, 'oncomplete');
      fireOnAssign(tx, 'onerror');
      tx.objectStore = () => ({
        put: (value: unknown, key: string) => store.set(key, value),
        get: (key: string) => {
          const req: Record<string, unknown> = { result: store.get(key) };
          fireOnAssign(req, 'onsuccess');
          fireOnAssign(req, 'onerror');
          return req;
        },
      });
      return tx;
    },
  };
  return {
    open: () => {
      const req: Record<string, unknown> = { result: db };
      fireOnAssign(req, 'onupgradeneeded');
      fireOnAssign(req, 'onsuccess');
      fireOnAssign(req, 'onerror');
      return req;
    },
  };
}
