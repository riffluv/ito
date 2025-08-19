import { onDisconnect, onValue, ref, remove, set, serverTimestamp, off } from "firebase/database";
import { rtdb, firebaseEnabled } from "@/lib/firebase/client";

const PATH = (roomId: string, uid?: string) => uid ? `presence/${roomId}/${uid}` : `presence/${roomId}`;

export type PresenceMap = Record<string, { online?: boolean; ts?: any }>;

export function presenceSupported(): boolean {
  return !!(firebaseEnabled && rtdb);
}

export async function attachPresence(roomId: string, uid: string) {
  if (!presenceSupported()) return () => {};
  const db = rtdb!;
  const meRef = ref(db, PATH(roomId, uid));
  // onlineマーク（onDisconnectで自動削除）
  await set(meRef, { online: true, ts: serverTimestamp() });
  try { await onDisconnect(meRef).remove(); } catch {}
  // 明示的に解除するための関数を返す
  return async () => {
    try { await remove(meRef); } catch {}
  };
}

export function subscribePresence(roomId: string, cb: (uids: string[], raw: PresenceMap) => void) {
  if (!presenceSupported()) return () => {};
  const db = rtdb!;
  const roomRef = ref(db, PATH(roomId));
  const handler = (snap: any) => {
    const val = (snap.val() || {}) as PresenceMap;
    const uids = Object.keys(val);
    cb(uids, val);
  };
  const onErr = () => {
    // 読み取り権限エラーや一時的な接続エラー時は空扱いにして継続
    try { cb([], {} as any); } catch {}
  };
  onValue(roomRef, handler, onErr as any);
  return () => off(roomRef, 'value', handler);
}
