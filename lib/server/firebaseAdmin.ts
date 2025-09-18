import fs from "fs";
import path from "path";
import type { App, AppOptions } from "firebase-admin/app";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getDatabase } from "firebase-admin/database";
import { getAuth } from "firebase-admin/auth";

let cachedApp: App | null = null;

function buildOptions(): AppOptions {
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
