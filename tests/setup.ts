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
