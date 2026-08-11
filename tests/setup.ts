import { afterEach } from 'vitest';

// @testing-library/preact only registers its automatic `cleanup()` hook when a
// global `afterEach` exists at import time. Vitest runs without globals here,
// so expose it to keep rendered DOM isolated between tests.
(globalThis as unknown as { afterEach: typeof afterEach }).afterEach = afterEach;

// jsdom (v24) does not implement Blob.text() / File.text() from the File API.
// The mock fs factory returns real `File` instances and downstream tests call
// `file.text()`. Polyfill via FileReader so the standard API works in tests.
const BlobCtor = globalThis.Blob;
if (BlobCtor && !BlobCtor.prototype.text) {
  BlobCtor.prototype.text = function (): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}
