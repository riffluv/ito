import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import { getDatabase, connectDatabaseEmulator, type Database } from "firebase/database";
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  setLogLevel,
  type Firestore,
} from "firebase/firestore";
import { notify } from "@/components/ui/notify";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function isPlaceholder(v: string): boolean {
  const s = v.trim();
  // よくあるプレースホルダや全角カッコ、例示の語、キー名そのものを弾く
  if (/[（）]/.test(s)) return true;
  if (/^\(.*\)$/.test(s)) return true; // (apiKey) など半角カッコ
  if (/your_|example|例/i.test(s)) return true;
  if (
    /^(apiKey|authDomain|projectId|appId|storageBucket|messagingSenderId|measurementId)$/i.test(
      s
    )
  )
    return true;
  if (
    /projectid|authdomain|apikey|appid|messagingsenderid|storagebucket|measurementid/i.test(
      s
    )
  )
    return true;
  if (/^1:1234567890:/.test(s)) return true; // テンプレの appId 例
  return false;
}

function hasValue(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0 && !isPlaceholder(v);
}

const useEmulator = process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATOR === "true";

let persistenceWarningShown = false;

const isMultiTabPersistenceError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  if (code === "failed-precondition") return true;
  const message = String((error as { message?: unknown }).message || "").toLowerCase();
  return message.includes("another tab") || message.includes("multiple tabs") || message.includes("persistence");
};

const FIRESTORE_EMULATOR_HOST = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST || "localhost";
const FIRESTORE_EMULATOR_PORT = Number(process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_PORT || 8080);
const AUTH_EMULATOR_HOST = process.env.NEXT_PUBLIC_AUTH_EMULATOR_HOST || "localhost";
const AUTH_EMULATOR_PORT = Number(process.env.NEXT_PUBLIC_AUTH_EMULATOR_PORT || 9099);
const DATABASE_EMULATOR_HOST = process.env.NEXT_PUBLIC_DATABASE_EMULATOR_HOST || "localhost";
const DATABASE_EMULATOR_PORT = Number(process.env.NEXT_PUBLIC_DATABASE_EMULATOR_PORT || 9000);

const hasFullConfig =
  hasValue(firebaseConfig.apiKey) &&
  hasValue(firebaseConfig.authDomain) &&
  hasValue(firebaseConfig.projectId) &&
  hasValue(firebaseConfig.appId);

const fallbackConfig = {
  apiKey: firebaseConfig.apiKey || "emulator-api-key",
  authDomain: firebaseConfig.authDomain || "localhost",
  projectId: firebaseConfig.projectId || "demo-emulator",
  databaseURL: firebaseConfig.databaseURL,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId,
  appId: firebaseConfig.appId || "emulator-app-id",
};

export const firebaseEnabled = hasFullConfig || useEmulator;

const resolvedConfig = hasFullConfig ? firebaseConfig : fallbackConfig;

export const app: FirebaseApp | null = ((): FirebaseApp | null => {
  if (!firebaseEnabled) return null;
  const apps = getApps();
  return apps.length ? apps[0] : initializeApp(resolvedConfig);
})();

export const db: Firestore | null = ((): Firestore | null => {
  if (!firebaseEnabled || !app) return null;
  try {
    // SDKのログレベルを環境変数で制御（デフォルト: 本番=error, 開発=warn）
    try {
      const lv = process.env.NEXT_PUBLIC_FIRESTORE_LOG_LEVEL || (process.env.NODE_ENV === "production" ? "error" : "warn");
      setLogLevel(lv as Parameters<typeof setLogLevel>[0]);
    } catch {}
    // 高速・安定化: ローカル永続キャッシュ + 自動ロングポーリング検出
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentSingleTabManager(undefined),
      }),
      ignoreUndefinedProperties: true,
      experimentalAutoDetectLongPolling: true,
    });
  } catch (error) {
    if (isMultiTabPersistenceError(error) && typeof window !== "undefined" && !persistenceWarningShown) {
      persistenceWarningShown = true;
      notify({
        id: "firestore-single-tab",
        title: "他のタブで序の紋章が開かれています",
        description: "他のタブを閉じてからこの画面をリロードしてください。（オフラインキャッシュ無効化中）",
        type: "warning",
        duration: 5200,
      });
    }
    return getFirestore(app);
  }
})();
export const auth: Auth | null = firebaseEnabled && app ? getAuth(app) : null;
// RTDBはdatabaseURL未設定だと初期化時に例外になる可能性があるため、try/catchで安全化
export const rtdb: Database | null = (() => {
  if (!firebaseEnabled || !app) return null;
  try {
    return getDatabase(app);
  } catch {
    return null;
  }
})();

const globalScope = globalThis as typeof globalThis & {
  __FIRESTORE_EMULATOR_INITIALIZED__?: boolean;
  __AUTH_EMULATOR_INITIALIZED__?: boolean;
  __RTDB_EMULATOR_INITIALIZED__?: boolean;
};

if (useEmulator && db) {
  if (!globalScope.__FIRESTORE_EMULATOR_INITIALIZED__) {
    connectFirestoreEmulator(db, FIRESTORE_EMULATOR_HOST, FIRESTORE_EMULATOR_PORT);
    globalScope.__FIRESTORE_EMULATOR_INITIALIZED__ = true;
  }
}

if (useEmulator && auth) {
  if (!globalScope.__AUTH_EMULATOR_INITIALIZED__) {
    const host =
      process.env.NEXT_PUBLIC_AUTH_EMULATOR_URL || `http://${AUTH_EMULATOR_HOST}:${AUTH_EMULATOR_PORT}`;
    connectAuthEmulator(auth, host, { disableWarnings: true });
    globalScope.__AUTH_EMULATOR_INITIALIZED__ = true;
  }
}

if (useEmulator && rtdb) {
  if (!globalScope.__RTDB_EMULATOR_INITIALIZED__) {
    connectDatabaseEmulator(rtdb, DATABASE_EMULATOR_HOST, DATABASE_EMULATOR_PORT);
    globalScope.__RTDB_EMULATOR_INITIALIZED__ = true;
  }
}
