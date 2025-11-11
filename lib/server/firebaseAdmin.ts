import fs from "fs";
import path from "path";
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
  type AppOptions,
} from "firebase-admin/app";
import type { ServiceAccount } from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getDatabase } from "firebase-admin/database";
import { getAuth } from "firebase-admin/auth";

let cachedApp: App | null = null;

function ensureEmulatorEnv() {
  if (process.env.__ADMIN_EMULATOR_PATCHED__ === "true") return;
  const useEmulator = process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATOR === "true";
  if (!useEmulator) {
    process.env.__ADMIN_EMULATOR_PATCHED__ = "true";
    return;
  }

  const fsHost = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST;
  const fsPort = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_PORT || process.env.FIRESTORE_EMULATOR_PORT;
  if (fsHost && fsPort && !process.env.FIRESTORE_EMULATOR_HOST) {
    process.env.FIRESTORE_EMULATOR_HOST = `${fsHost}:${fsPort}`;
  }

  const authHost = process.env.NEXT_PUBLIC_AUTH_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const authPort = process.env.NEXT_PUBLIC_AUTH_EMULATOR_PORT || process.env.FIREBASE_AUTH_EMULATOR_PORT;
  if (authHost && authPort && !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = `${authHost}:${authPort}`;
  }

  const dbHost = process.env.NEXT_PUBLIC_DATABASE_EMULATOR_HOST || process.env.FIREBASE_DATABASE_EMULATOR_HOST;
  const dbPort = process.env.NEXT_PUBLIC_DATABASE_EMULATOR_PORT || process.env.FIREBASE_DATABASE_EMULATOR_PORT;
  if (dbHost && dbPort && !process.env.FIREBASE_DATABASE_EMULATOR_HOST) {
    process.env.FIREBASE_DATABASE_EMULATOR_HOST = `${dbHost}:${dbPort}`;
  }

  process.env.__ADMIN_EMULATOR_PATCHED__ = "true";
}

function buildOptions(): AppOptions {
  ensureEmulatorEnv();
  const databaseURL =
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || process.env.FIREBASE_DATABASE_URL;
  const opts: AppOptions = {};
  if (databaseURL) opts.databaseURL = databaseURL;
  return opts;
}

function parseServiceAccount(raw: string): ServiceAccount | null {
  try {
    return JSON.parse(raw) as ServiceAccount;
  } catch (error) {
    console.error("[firebaseAdmin] Failed to parse service account JSON", error);
    return null;
  }
}

function resolveServiceAccountFromEnv(): ServiceAccount | null {
  const directJson = process.env.FIREBASE_ADMIN_KEY_JSON;
  if (directJson && directJson.trim().length > 0) {
    const parsed = parseServiceAccount(directJson.trim());
    if (parsed) return parsed;
  }

  const base64Json = process.env.FIREBASE_ADMIN_KEY_BASE64 || process.env.FIREBASE_ADMIN_CREDENTIAL;
  if (base64Json && base64Json.trim().length > 0) {
    try {
      const decoded = Buffer.from(base64Json.trim(), "base64").toString("utf8");
      const parsed = parseServiceAccount(decoded);
      if (parsed) return parsed;
    } catch (error) {
      console.error("[firebaseAdmin] Failed to decode base64 service account", error);
    }
  }

  return null;
}

function resolveServiceAccountFromFile(): ServiceAccount | null {
  const customPath = process.env.FIREBASE_ADMIN_KEY_PATH;
  const defaultPath = path.join(process.cwd(), "service-account-key.json");
  const candidatePaths = [customPath, defaultPath].filter((p): p is string => !!p && p.trim().length > 0);

  for (const credentialPath of candidatePaths) {
    try {
      if (!fs.existsSync(credentialPath)) continue;
      const raw = fs.readFileSync(credentialPath, "utf8");
      const parsed = parseServiceAccount(raw);
      if (parsed) return parsed;
    } catch (error) {
      console.error(`[firebaseAdmin] Failed to read credential file at ${credentialPath}`, error);
    }
  }

  return null;
}

function resolveServiceAccount(): ServiceAccount | null {
  const fromEnv = resolveServiceAccountFromEnv();
  if (fromEnv) return fromEnv;
  return resolveServiceAccountFromFile();
}

function ensureApp(): App {
  if (cachedApp) return cachedApp;
  const existing = getApps();
  if (existing.length > 0) {
    cachedApp = existing[0]!;
    return cachedApp;
  }

  const options = buildOptions();

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    cachedApp = initializeApp({ ...options, credential: applicationDefault() });
    return cachedApp;
  }

  const serviceAccount = resolveServiceAccount();
  if (serviceAccount) {
    cachedApp = initializeApp({ ...options, credential: cert(serviceAccount) });
    return cachedApp;
  }

  throw new Error(
    "Firebase admin credential not found. Provide FIREBASE_ADMIN_KEY_JSON, FIREBASE_ADMIN_KEY_BASE64, FIREBASE_ADMIN_KEY_PATH, or set GOOGLE_APPLICATION_CREDENTIALS."
  );
}

export function getAdminApp(): App {
  return ensureApp();
}

export function getAdminDb() {
  return getFirestore(ensureApp());
}

export function getAdminRtdb() {
  try {
    return getDatabase(ensureApp());
  } catch {
    return null;
  }
}

export function getAdminAuth() {
  return getAuth(ensureApp());
}
