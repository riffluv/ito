import { onDisconnect, onValue, ref, remove, set, serverTimestamp, off, get } from "firebase/database";
import { rtdb, firebaseEnabled } from "@/lib/firebase/client";

// ルーム配下: presence/<roomId>/<uid>/<connId> = { online: true, ts }
// 同一uidの複数タブでも衝突しないよう、接続単位で管理する
const ROOM_PATH = (roomId: string) => `presence/${roomId}`;
const USER_PATH = (roomId: string, uid: string) => `presence/${roomId}/${uid}`;
const CONN_PATH = (roomId: string, uid: string, connId: string) => `presence/${roomId}/${uid}/${connId}`;

export type PresenceConn = { online?: boolean; ts?: any };
export type PresenceUserMap = Record<string, PresenceConn>; // connId -> PresenceConn
export type PresenceRoomMap = Record<string, PresenceUserMap>; // uid -> PresenceUserMap

export function presenceSupported(): boolean {
  return !!(firebaseEnabled && rtdb);
}

export async function attachPresence(roomId: string, uid: string) {
  if (!presenceSupported()) return () => {};
  const db = rtdb!;
  const connId = (() => Math.random().toString(36).slice(2) + Date.now().toString(36))();
  const meConnRef = ref(db, CONN_PATH(roomId, uid, connId));
  // onlineマーク（onDisconnectで自動削除）
  await set(meConnRef, { online: true, ts: serverTimestamp() });
  try { await onDisconnect(meConnRef).remove(); } catch {}
  // 明示的に解除するための関数を返す
  return async () => {
    try { await remove(meConnRef); } catch {}
  };
}

export function subscribePresence(roomId: string, cb: (uids: string[], raw?: PresenceRoomMap) => void) {
  if (!presenceSupported()) return () => {};
  const db = rtdb!;
  const roomRef = ref(db, ROOM_PATH(roomId));
  const handler = (snap: any) => {
    const val = (snap.val() || {}) as PresenceRoomMap;
    const uids = Object.keys(val).filter((uid) => {
      const conns = val[uid] || {};
      // 1つでも接続があればオンラインとみなす
      return Object.keys(conns).length > 0;
    });
    cb(uids, val as any);
  };
  const onErr = () => {
    // 読み取り権限エラーや一時的な接続エラー時は空扱いにして継続
    try { cb([], {} as any); } catch {}
  };
  onValue(roomRef, handler, onErr as any);
  return () => off(roomRef, 'value', handler);
}

export async function fetchPresenceUids(roomId: string): Promise<string[]> {
  if (!presenceSupported()) return [];
  try {
    const snap = await get(ref(rtdb!, ROOM_PATH(roomId)));
    const val = (snap.val() || {}) as PresenceRoomMap;
    return Object.keys(val).filter((uid) => {
      const conns = val[uid] || {};
      return Object.keys(conns).length > 0;
    });
  } catch {
    return [];
  }
}
