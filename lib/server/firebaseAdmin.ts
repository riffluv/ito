import fs from "fs";
import path from "path";
import type { App, AppOptions } from "firebase-admin/app";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
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

  const keyPath =
    process.env.FIREBASE_ADMIN_KEY_PATH || path.join(process.cwd(), "service-account-key.json");
  if (fs.existsSync(keyPath)) {
    const raw = fs.readFileSync(keyPath, "utf8");
    const data = JSON.parse(raw);
    cachedApp = initializeApp({ ...options, credential: cert(data) });
    return cachedApp;
  }

  throw new Error("Firebase admin credential not found. Set GOOGLE_APPLICATION_CREDENTIALS or provide service-account-key.json");
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
