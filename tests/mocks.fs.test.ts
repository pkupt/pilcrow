import { describe, it, expect } from 'vitest';
import { createMockFs } from './mocks/fs';

describe('mock fs', () => {
  it('lists files at root', async () => {
    const fs = createMockFs({ 'a.md': '# A', 'b.md': '# B' });
    const names: string[] = [];
    for await (const entry of fs.handle.values()) {
      names.push(entry.name);
    }
    expect(names.sort()).toEqual(['a.md', 'b.md']);
  });

  it('reads file content', async () => {
    const fs = createMockFs({ 'a.md': '# A' });
    const fh = await fs.handle.getFileHandle('a.md');
    const file = await fh.getFile();
    expect(await file.text()).toBe('# A');
  });

  it('writes file content', async () => {
    const fs = createMockFs({});
    const fh = await fs.handle.getFileHandle('a.md', { create: true });
    const w = await fh.createWritable();
    await w.write('hello');
    await w.close();
    expect(fs.files.get('a.md')).toBe('hello');
  });

  it('removes entries recursively', async () => {
    const fs = createMockFs({ 'dir/a.md': 'a', 'dir/b.md': 'b', 'c.md': 'c' });
    await fs.handle.removeEntry('dir', { recursive: true });
    expect(fs.files.has('dir/a.md')).toBe(false);
    expect(fs.files.has('dir/b.md')).toBe(false);
    expect(fs.files.has('c.md')).toBe(true);
  });
});
