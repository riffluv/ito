import "@testing-library/jest-dom";
import { webcrypto } from "crypto";
import { TextDecoder, TextEncoder } from "util";

// Add structuredClone polyfill for Node.js environments
if (!global.structuredClone) {
  global.structuredClone = <T>(obj: T): T => {
    if (obj === undefined || obj === null) {
      return obj;
    }
    if (obj instanceof Date) {
      return new Date(obj.getTime()) as T;
    }
    if (obj instanceof ArrayBuffer) {
      return obj.slice(0) as T;
    }
    if (ArrayBuffer.isView(obj)) {
      if (obj instanceof DataView) {
        const cloned = obj.buffer.slice(0);
        return new DataView(cloned, obj.byteOffset, obj.byteLength) as unknown as T;
      }
      const ctor = (obj as any).constructor;
      try {
        return new ctor(obj as any);
      } catch {
        return obj;
      }
    }
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch {
      return obj;
    }
  };
}

if (typeof global.TextEncoder === "undefined") {
  global.TextEncoder = TextEncoder as unknown as typeof global.TextEncoder;
}

if (typeof global.TextDecoder === "undefined") {
  global.TextDecoder = TextDecoder as unknown as typeof global.TextDecoder;
}

if (typeof globalThis.crypto === "undefined") {
  (globalThis as typeof globalThis & { crypto: Crypto }).crypto =
    webcrypto as Crypto;
} else if (!globalThis.crypto.subtle) {
  Object.assign(globalThis.crypto, webcrypto);
}

if (typeof window !== "undefined") {
  if (typeof window.crypto === "undefined") {
    window.crypto = webcrypto as Crypto;
  } else if (!window.crypto.subtle) {
    Object.assign(window.crypto, webcrypto);
  }
}

// Setup for Firebase testing - prevent Firebase app conflicts
beforeEach(() => {
  // Clear any Firebase apps from previous tests
  jest.clearAllMocks();
});
