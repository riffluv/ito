const encoder = new TextEncoder();

function getCrypto(): Crypto {
  if (typeof globalThis !== "undefined" && globalThis.crypto) {
    return globalThis.crypto as Crypto;
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { webcrypto } = require("crypto");
  return webcrypto as Crypto;
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

export async function hashPassword(password: string, salt: string): Promise<string> {
  const cryptoObj = getCrypto();
  const data = encoder.encode(`${salt}:${password}`);
  const digest = await cryptoObj.subtle.digest("SHA-256", data);
  return bufferToBase64(digest);
}

export async function createPasswordEntry(password: string): Promise<{
  hash: string;
  salt: string;
  version: number;
}> {
  const cryptoObj = getCrypto();
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
