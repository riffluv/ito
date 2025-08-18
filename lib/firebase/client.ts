import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const isBrowser = typeof window !== "undefined";

function isPlaceholder(v: string): boolean {
  const s = v.trim();
  // よくあるプレースホルダや全角カッコ、例示の語、キー名そのものを弾く
  if (/[（）]/.test(s)) return true;
  if (/^\(.*\)$/.test(s)) return true; // (apiKey) など半角カッコ
  if (/your_|example|例/i.test(s)) return true;
  if (/^(apiKey|authDomain|projectId|appId|storageBucket|messagingSenderId|measurementId)$/i.test(s)) return true;
  if (/projectid|authdomain|apikey|appid|messagingsenderid|storagebucket|measurementid/i.test(s)) return true;
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

export const db = firebaseEnabled && app ? getFirestore(app) : (null as any);
export const auth = firebaseEnabled && app ? getAuth(app) : (null as any);
