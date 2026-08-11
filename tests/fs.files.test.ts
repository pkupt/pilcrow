import { describe, it, expect, vi } from 'vitest';
import { createMockFs } from './mocks/fs';
import {
  readFile,
  writeFile,
  createFile,
  createDirectory,
  deleteFile,
  deleteDirectory,
  moveEntry,
  exists,
} from '../src/fs/files';

describe('readFile', () => {
  it('reads existing file content', async () => {
    const fs = createMockFs({ 'a.md': '# A' });
    expect(await readFile(fs.handle, 'a.md')).toBe('# A');
  });

  it('returns null for missing file', async () => {
    const fs = createMockFs({});
    expect(await readFile(fs.handle, 'missing.md')).toBeNull();
  });

  it('reads nested path', async () => {
    const fs = createMockFs({ 'notes/sub/b.md': 'B' });
    expect(await readFile(fs.handle, 'notes/sub/b.md')).toBe('B');
  });
});

describe('writeFile', () => {
  it('writes new file', async () => {
    const fs = createMockFs({});
    await writeFile(fs.handle, 'a.md', 'hello');
    expect(fs.files.get('a.md')).toBe('hello');
  });

  it('overwrites existing file', async () => {
    const fs = createMockFs({ 'a.md': 'old' });
    await writeFile(fs.handle, 'a.md', 'new');
    expect(fs.files.get('a.md')).toBe('new');
  });

  it('creates parent directories implicitly', async () => {
    const fs = createMockFs({});
    await writeFile(fs.handle, 'notes/sub/a.md', 'x');
    expect(fs.files.get('notes/sub/a.md')).toBe('x');
  });

  it('cleans up tmp file when the atomic move fails', async () => {
    const fs = createMockFs({});
    const handle = fs.handle as unknown as {
      getFileHandle: (
        name: string,
        opts?: { create?: boolean },
      ) => Promise<{
        name: string;
        move: (n: string) => Promise<void>;
        createWritable: () => Promise<FileSystemWritableFileStream>;
        getFile: () => Promise<File>;
      }>;
    };
    const original = handle.getFileHandle.bind(handle);
    vi.spyOn(handle, 'getFileHandle').mockImplementation(async (name, opts) => {
      const fh = await original(name, opts);
      if (name.startsWith('.')) {
        return Object.create(fh, {
          move: {
            value: () =>
              Promise.reject(new DOMException('move failed', 'InvalidStateError')),
          },
        });
      }
      return fh;
    });
    await expect(writeFile(fs.handle, 'a.md', 'content')).rejects.toMatchObject({
      name: 'InvalidStateError',
    });
    expect(fs.files.has('.a.md.tmp')).toBe(false);
    expect(fs.files.has('a.md')).toBe(false);
  });
});

describe('createFile / createDirectory', () => {
  it('creates an empty file', async () => {
    const fs = createMockFs({});
    await createFile(fs.handle, 'a.md');
    expect(fs.files.has('a.md')).toBe(true);
    expect(fs.files.get('a.md')).toBe('');
  });

  it('creates a directory by creating a sentinel file', async () => {
    const fs = createMockFs({});
    await createDirectory(fs.handle, 'notes');
    // Directory exists when a child exists
    await writeFile(fs.handle, 'notes/.gitkeep', '');
    expect(fs.files.has('notes/.gitkeep')).toBe(true);
  });
});

describe('deleteFile / deleteDirectory', () => {
  it('deletes a file', async () => {
    const fs = createMockFs({ 'a.md': 'a' });
    await deleteFile(fs.handle, 'a.md');
    expect(fs.files.has('a.md')).toBe(false);
  });

  it('deletes a directory recursively', async () => {
    const fs = createMockFs({ 'dir/a.md': 'a', 'dir/b.md': 'b' });
    await deleteDirectory(fs.handle, 'dir');
    expect(fs.files.has('dir/a.md')).toBe(false);
    expect(fs.files.has('dir/b.md')).toBe(false);
  });
});

describe('moveEntry', () => {
  it('moves a file to a new path', async () => {
    const fs = createMockFs({ 'a.md': 'A' });
    await moveEntry(fs.handle, 'a.md', 'b.md');
    expect(fs.files.has('a.md')).toBe(false);
    expect(fs.files.get('b.md')).toBe('A');
  });

  it('moves a file across directories', async () => {
    const fs = createMockFs({ 'a.md': 'A' });
    await moveEntry(fs.handle, 'a.md', 'notes/b.md');
    expect(fs.files.has('a.md')).toBe(false);
    expect(fs.files.get('notes/b.md')).toBe('A');
  });
});

describe('exists', () => {
  it('returns true for existing file', async () => {
    const fs = createMockFs({ 'a.md': 'a' });
    expect(await exists(fs.handle, 'a.md')).toBe(true);
  });

  it('returns false for missing file', async () => {
    const fs = createMockFs({});
    expect(await exists(fs.handle, 'missing.md')).toBe(false);
  });

  it('throws on SecurityError instead of returning false', async () => {
    const fs = createMockFs({});
    const handle = fs.handle as unknown as {
      getFileHandle: (
        name: string,
        opts?: { create?: boolean },
      ) => Promise<unknown>;
    };
    vi.spyOn(handle, 'getFileHandle').mockRejectedValue(
      new DOMException('Blocked', 'SecurityError'),
    );
    await expect(exists(fs.handle, 'a.md')).rejects.toMatchObject({
      name: 'SecurityError',
    });
  });
});