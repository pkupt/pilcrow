type DirHandle = FileSystemDirectoryHandle & {
  getFileHandle: (
    name: string,
    opts?: { create?: boolean },
  ) => Promise<
    FileSystemFileHandle & {
      move: (newName: string) => Promise<void>;
      createWritable: () => Promise<FileSystemWritableFileStream>;
      getFile: () => Promise<File>;
    }
  >;
  getDirectoryHandle: (
    name: string,
    opts?: { create?: boolean },
  ) => Promise<FileSystemDirectoryHandle>;
  removeEntry: (name: string, opts?: { recursive?: boolean }) => Promise<void>;
  values: () => AsyncIterableIterator<
    FileSystemHandle & { name: string; kind: 'file' | 'directory' }
  >;
};

function splitPath(path: string): { dir: string; name: string } {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? { dir: '', name: path } : { dir: path.slice(0, idx), name: path.slice(idx + 1) };
}

async function getDir(
  root: DirHandle,
  dirPath: string,
  create: boolean,
): Promise<DirHandle> {
  let cur = root;
  if (dirPath === '') return cur;
  for (const part of dirPath.split('/')) {
    cur = (await cur.getDirectoryHandle(part, { create })) as DirHandle;
  }
  return cur;
}

export async function readFile(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<string | null> {
  const { dir, name } = splitPath(path);
  try {
    const d = await getDir(root as DirHandle, dir, false);
    const fh = await d.getFileHandle(name);
    const file = await fh.getFile();
    return await file.text();
  } catch (e) {
    if ((e as DOMException).name === 'NotFoundError') return null;
    throw e;
  }
}

export async function writeFile(
  root: FileSystemDirectoryHandle,
  path: string,
  content: string,
): Promise<void> {
  const { dir, name } = splitPath(path);
  const d = await getDir(root as DirHandle, dir, true);
  const tmpName = `.${name}.tmp`;
  try {
    const tmpFh = await d.getFileHandle(tmpName, { create: true });
    const w = await tmpFh.createWritable();
    await w.write(content);
    await w.close();
    // Atomically replace: move tmp over target if move() available, else direct write.
    if (typeof (tmpFh as { move?: unknown }).move === 'function') {
      await (tmpFh as unknown as { move: (n: string) => Promise<void> }).move(name);
    } else {
      const fh = await d.getFileHandle(name, { create: true });
      const w2 = await fh.createWritable();
      await w2.write(content);
      await w2.close();
    }
  } finally {
    await d.removeEntry(tmpName).catch(() => {});
  }
}

export async function createFile(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<void> {
  await writeFile(root, path, '');
}

export async function createDirectory(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<void> {
  await getDir(root as DirHandle, path, true);
}

export async function deleteFile(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<void> {
  const { dir, name } = splitPath(path);
  const d = await getDir(root as DirHandle, dir, false);
  await d.removeEntry(name);
}

export async function deleteDirectory(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<void> {
  const { dir, name } = splitPath(path);
  const d = await getDir(root as DirHandle, dir, false);
  await d.removeEntry(name, { recursive: true });
}

export async function moveEntry(
  root: FileSystemDirectoryHandle,
  srcPath: string,
  destPath: string,
): Promise<void> {
  const content = await readFile(root, srcPath);
  if (content === null) return;
  await writeFile(root, destPath, content);
  await deleteFile(root, srcPath);
}

export async function moveDirectory(
  root: FileSystemDirectoryHandle,
  srcPath: string,
  destPath: string,
): Promise<void> {
  if (srcPath === destPath || destPath.startsWith(srcPath + '/')) return;
  const srcDir = await getDir(root as DirHandle, srcPath, false);
  const entries: { name: string; kind: 'file' | 'directory' }[] = [];
  for await (const entry of srcDir.values()) {
    entries.push({ name: entry.name, kind: entry.kind });
  }
  for (const entry of entries) {
    const srcChild = `${srcPath}/${entry.name}`;
    const destChild = `${destPath}/${entry.name}`;
    if (entry.kind === 'directory') {
      await moveDirectory(root, srcChild, destChild);
    } else {
      const content = await readFile(root, srcChild);
      if (content === null) continue;
      await writeFile(root, destChild, content);
    }
  }
  await deleteDirectory(root, srcPath);
}

export async function getFileMtime(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<number | null> {
  const { dir, name } = splitPath(path);
  try {
    const d = await getDir(root as DirHandle, dir, false);
    const fh = await d.getFileHandle(name);
    const file = await fh.getFile();
    return file.lastModified;
  } catch {
    return null;
  }
}

export async function exists(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<boolean> {
  const { dir, name } = splitPath(path);
  try {
    const d = await getDir(root as DirHandle, dir, false);
    await d.getFileHandle(name);
    return true;
  } catch (e) {
    if ((e as DOMException).name === 'NotFoundError') return false;
    throw e;
  }
}