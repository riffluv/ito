const encoder = new TextEncoder();

let cachedWebCrypto: Crypto | null = null;

let cryptoInit: Promise<Crypto> | null = null;

function isUsableCrypto(candidate: Crypto | undefined): candidate is Crypto {
  if (!candidate) {
    return false;
  }
  const { subtle, getRandomValues } = candidate;
  return (
    typeof subtle?.digest === "function" &&
    typeof getRandomValues === "function"
  );
}

async function resolveCrypto(): Promise<Crypto> {
  if (typeof globalThis !== "undefined") {
    const existing = globalThis.crypto;
    if (isUsableCrypto(existing as Crypto | undefined)) {
      return existing as Crypto;
    }
  }

  // Node.js ランタイムではグローバル提供が無い場合があるため、必要に応じて fallback をロード
  const isNodeRuntime =
    typeof process !== "undefined" && process.release?.name === "node";
  if (typeof window === "undefined" || isNodeRuntime) {
    try {
      const { webcrypto } = await import("crypto");
      if (isUsableCrypto(webcrypto as Crypto | undefined)) {
        if (typeof globalThis !== "undefined" && !globalThis.crypto) {
          Object.defineProperty(globalThis, "crypto", {
            value: webcrypto,
            configurable: true,
            enumerable: false,
            writable: false,
          });
        }
        return webcrypto as Crypto;
      }
    } catch (error) {
      // fall through to error below
    }
  }

  throw new Error(
    "Web Crypto API is unavailable in this environment. Please ensure Node.js 19+ (or globalThis.crypto) is available."
  );
}

async function getCrypto(): Promise<Crypto> {
  if (cachedWebCrypto) {
    return cachedWebCrypto;
  }
  if (!cryptoInit) {
    cryptoInit = resolveCrypto().then((instance) => {
      cachedWebCrypto = instance;
      return instance;
    });
  }
  return cryptoInit;
}

function bufferToBase64(buffer: ArrayBuffer): string {
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
  return Buffer.from(buffer).toString("base64");
}

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export const PASSWORD_VERSION = 1;

export async function hashPassword(
  password: string,
  salt: string
): Promise<string> {
  const cryptoObj = await getCrypto();
  const data = encoder.encode(`${salt}:${password}`);
  const digest = await cryptoObj.subtle.digest("SHA-256", data);
  return bufferToBase64(digest);
}

export async function createPasswordEntry(password: string): Promise<{
  hash: string;
  salt: string;
  version: number;
}> {
  const cryptoObj = await getCrypto();
  const saltBytes = new Uint8Array(16);
  cryptoObj.getRandomValues(saltBytes);
  const salt = bufferToBase64(saltBytes.buffer);
  const hash = await hashPassword(password, salt);
  return { hash, salt, version: PASSWORD_VERSION };
}

export async function verifyPassword(
  password: string,
  salt: string | null | undefined,
  expectedHash: string | null | undefined
): Promise<boolean> {
  if (!salt || !expectedHash) {
    return false;
  }
  const computed = await hashPassword(password, salt);
  return constantTimeCompare(computed, expectedHash);
}
