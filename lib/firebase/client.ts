import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
} from "firebase/firestore";

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

export const firebaseEnabled =
  hasValue(firebaseConfig.apiKey) &&
  hasValue(firebaseConfig.authDomain) &&
  hasValue(firebaseConfig.projectId) &&
  hasValue(firebaseConfig.appId);

export const app = ((): any => {
  if (!firebaseEnabled) return null as any;
  const apps = getApps();
  return apps.length ? apps[0] : initializeApp(firebaseConfig);
})();

export const db = ((): any => {
  if (!firebaseEnabled || !app) return null as any;
  try {
    // 高速・安定化: ローカル永続キャッシュ + 自動ロングポーリング検出
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentSingleTabManager(undefined),
      }),
      ignoreUndefinedProperties: true,
      experimentalAutoDetectLongPolling: true,
    });
  } catch {
    return getFirestore(app);
  }
})();
export const auth = firebaseEnabled && app ? getAuth(app) : (null as any);
// RTDBはdatabaseURL未設定だと初期化時に例外になる可能性があるため、try/catchで安全化
export const rtdb = (() => {
  if (!firebaseEnabled || !app) return null as any;
  try {
    return getDatabase(app);
  } catch {
    return null as any;
  }
})();
