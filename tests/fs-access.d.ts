// Type augmentation: TypeScript 5.9's lib.dom.d.ts omits the async iteration
// methods on FileSystemDirectoryHandle from the File System Access API.
// The real API (and our mock) supports `for await (const entry of handle.values())`.
// This declaration merges with the global interface so calls like
// `handle.values()` typecheck in both production code and the mock factory.
interface FileSystemDirectoryHandle {
  values(): AsyncIterableIterator<FileSystemHandle>;
  keys(): AsyncIterableIterator<string>;
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
  [Symbol.asyncIterator](): AsyncIterableIterator<[string, FileSystemHandle]>;
  requestPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
}
