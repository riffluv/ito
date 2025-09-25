"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminApp = getAdminApp;
exports.getAdminDb = getAdminDb;
exports.getAdminRtdb = getAdminRtdb;
exports.getAdminAuth = getAdminAuth;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const database_1 = require("firebase-admin/database");
const auth_1 = require("firebase-admin/auth");
let cachedApp = null;
function ensureEmulatorEnv() {
    if (process.env.__ADMIN_EMULATOR_PATCHED__ === "true")
        return;
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
function buildOptions() {
    ensureEmulatorEnv();
    const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || process.env.FIREBASE_DATABASE_URL;
    const opts = {};
    if (databaseURL)
        opts.databaseURL = databaseURL;
    return opts;
}
function parseServiceAccount(raw) {
    try {
        return JSON.parse(raw);
    }
    catch (error) {
        console.error("[firebaseAdmin] Failed to parse service account JSON", error);
        return null;
    }
}
function resolveServiceAccountFromEnv() {
    const directJson = process.env.FIREBASE_ADMIN_KEY_JSON;
    if (directJson && directJson.trim().length > 0) {
        const parsed = parseServiceAccount(directJson.trim());
        if (parsed)
            return parsed;
    }
    const base64Json = process.env.FIREBASE_ADMIN_KEY_BASE64 || process.env.FIREBASE_ADMIN_CREDENTIAL;
    if (base64Json && base64Json.trim().length > 0) {
        try {
            const decoded = Buffer.from(base64Json.trim(), "base64").toString("utf8");
            const parsed = parseServiceAccount(decoded);
            if (parsed)
                return parsed;
        }
        catch (error) {
            console.error("[firebaseAdmin] Failed to decode base64 service account", error);
        }
    }
    return null;
}
function resolveServiceAccountFromFile() {
    const customPath = process.env.FIREBASE_ADMIN_KEY_PATH;
    const defaultPath = path_1.default.join(process.cwd(), "service-account-key.json");
    const candidatePaths = [customPath, defaultPath].filter((p) => !!p && p.trim().length > 0);
    for (const credentialPath of candidatePaths) {
        try {
            if (!fs_1.default.existsSync(credentialPath))
                continue;
            const raw = fs_1.default.readFileSync(credentialPath, "utf8");
            const parsed = parseServiceAccount(raw);
            if (parsed)
                return parsed;
        }
        catch (error) {
            console.error(`[firebaseAdmin] Failed to read credential file at ${credentialPath}`, error);
        }
    }
    return null;
}
function resolveServiceAccount() {
    const fromEnv = resolveServiceAccountFromEnv();
    if (fromEnv)
        return fromEnv;
    return resolveServiceAccountFromFile();
}
function ensureApp() {
    if (cachedApp)
        return cachedApp;
    const existing = (0, app_1.getApps)();
    if (existing.length > 0) {
        cachedApp = existing[0];
        return cachedApp;
    }
    const options = buildOptions();
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        cachedApp = (0, app_1.initializeApp)({ ...options, credential: (0, app_1.applicationDefault)() });
        return cachedApp;
    }
    const serviceAccount = resolveServiceAccount();
    if (serviceAccount) {
        cachedApp = (0, app_1.initializeApp)({ ...options, credential: (0, app_1.cert)(serviceAccount) });
        return cachedApp;
    }
    throw new Error("Firebase admin credential not found. Provide FIREBASE_ADMIN_KEY_JSON, FIREBASE_ADMIN_KEY_BASE64, FIREBASE_ADMIN_KEY_PATH, or set GOOGLE_APPLICATION_CREDENTIALS.");
}
function getAdminApp() {
    return ensureApp();
}
function getAdminDb() {
    return (0, firestore_1.getFirestore)(ensureApp());
}
function getAdminRtdb() {
    try {
        return (0, database_1.getDatabase)(ensureApp());
    }
    catch {
        return null;
    }
}
function getAdminAuth() {
    return (0, auth_1.getAuth)(ensureApp());
}
