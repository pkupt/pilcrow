import { afterEach } from 'vitest';

// @testing-library/preact only registers its automatic `cleanup()` hook when a
// global `afterEach` exists at import time. Vitest runs without globals here,
// so expose it to keep rendered DOM isolated between tests.
(globalThis as unknown as { afterEach: typeof afterEach }).afterEach = afterEach;

// jsdom (v24) does not implement PointerEvent; the resizer drag logic uses it.
// @ts-expect-error jsdom's lib has an incomplete PointerEvent; our polyfill is a MouseEvent subclass
globalThis.PointerEvent ??= class PointerEvent extends MouseEvent {
  pointerId: number;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
  }
};

// Preact infers the real event name from `name in dom` (see preact diff/props):
// `'onclick' in div` is true in jsdom, but `'onpointerdown' in div` is not,
// which makes preact attach a bogus `PointerDown` listener. Real browsers expose
// these on-event handler properties, so polyfill them to match.
const ON_POINTER_EVENTS = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'] as const;
for (const ev of ON_POINTER_EVENTS) {
  const prop = `on${ev}` as keyof Element;
  if (!(prop in Element.prototype)) {
    Object.defineProperty(Element.prototype, prop, {
      get() {
        return undefined;
      },
      set(v: unknown) {
        (this as Record<string, unknown>)[`_on${ev}`] = v;
      },
      configurable: true,
    });
  }
}

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
