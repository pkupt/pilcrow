export interface MockFs {
  handle: FileSystemDirectoryHandle;
  files: Map<string, string>;
}

class MockFileHandle {
  constructor(
    public readonly name: string,
    public readonly kind = 'file',
    private fs: MockFs,
    public readonly path: string,
  ) {}
  async getFile(): Promise<File> {
    const content = this.fs.files.get(this.path) ?? '';
    return new File([content], this.name);
  }
  async createWritable(): Promise<FileSystemWritableFileStream> {
    const path = this.path;
    const fs = this.fs;
    let buffer = '';
    const stream = {
      async write(data: unknown): Promise<void> {
        if (typeof data === 'string') buffer += data;
        else if (typeof data === 'object' && data !== null && 'data' in data) {
          buffer += String((data as { data: unknown }).data);
        }
      },
      async close(): Promise<void> {
        fs.files.set(path, buffer);
      },
    };
    return stream as unknown as FileSystemWritableFileStream;
  }
  async move(newName: string): Promise<void> {
    const dir = this.path.substring(0, this.path.lastIndexOf('/'));
    const newPath = dir ? `${dir}/${newName}` : newName;
    const content = this.fs.files.get(this.path);
    if (content !== undefined) {
      this.fs.files.delete(this.path);
      this.fs.files.set(newPath, content);
    }
  }
}

class MockDirHandle {
  public readonly kind = 'directory' as const;
  constructor(
    public readonly name: string,
    private fs: MockFs,
    public readonly path: string,
  ) {}
  async *values(): AsyncIterableIterator<MockFileHandle | MockDirHandle> {
    const seen = new Set<string>();
    for (const key of this.fs.files.keys()) {
      if (!key.startsWith(this.path === '' ? '' : this.path + '/')) continue;
      const rest = this.path === '' ? key : key.substring(this.path.length + 1);
      const top = rest.split('/')[0];
      if (seen.has(top)) continue;
      seen.add(top);
      const childPath = this.path === '' ? top : `${this.path}/${top}`;
      if (rest.includes('/')) {
        yield new MockDirHandle(top, this.fs, childPath);
      } else {
        yield new MockFileHandle(top, 'file', this.fs, childPath);
      }
    }
  }
  async getFileHandle(name: string, opts?: { create?: boolean }): Promise<MockFileHandle> {
    const childPath = this.path === '' ? name : `${this.path}/${name}`;
    const exists = [...this.fs.files.keys()].some(
      (k) => k === childPath || k.startsWith(childPath + '/'),
    );
    if (!exists && !opts?.create) {
      throw new DOMException('Not found', 'NotFoundError');
    }
    return new MockFileHandle(name, 'file', this.fs, childPath);
  }
  async getDirectoryHandle(
    name: string,
    _opts?: { create?: boolean },
  ): Promise<MockDirHandle> {
    const childPath = this.path === '' ? name : `${this.path}/${name}`;
    return new MockDirHandle(name, this.fs, childPath);
  }
  async removeEntry(name: string, opts?: { recursive?: boolean }): Promise<void> {
    const childPath = this.path === '' ? name : `${this.path}/${name}`;
    for (const key of [...this.fs.files.keys()]) {
      if (key === childPath || (opts?.recursive && key.startsWith(childPath + '/'))) {
        this.fs.files.delete(key);
      }
    }
  }
  async requestPermission(): Promise<PermissionState> {
    return 'granted';
  }
}

export function createMockFs(initial: Record<string, string> = {}): MockFs {
  const files = new Map<string, string>(Object.entries(initial));
  const fs: MockFs = { handle: null as unknown as FileSystemDirectoryHandle, files };
  fs.handle = new MockDirHandle('', fs, '') as unknown as FileSystemDirectoryHandle;
  return fs;
}
