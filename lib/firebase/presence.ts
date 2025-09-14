import { firebaseEnabled, rtdb } from "@/lib/firebase/client";
import {
  get,
  off,
  onDisconnect,
  onValue as onRtdbValue,
  onValue,
  push,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
} from "firebase/database";

// ルーム配下: presence/<roomId>/<uid>/<connId> = { online: true, ts }
// 同一uidの複数タブでも衝突しないよう、接続単位で管理する
const ROOM_PATH = (roomId: string) => `presence/${roomId}`;
const CONN_PATH = (roomId: string, uid: string, connId: string) =>
  `presence/${roomId}/${uid}/${connId}`;

export type PresenceConn = { online?: boolean; ts?: any };
export type PresenceUserMap = Record<string, PresenceConn>; // connId -> PresenceConn
export type PresenceRoomMap = Record<string, PresenceUserMap>; // uid -> PresenceUserMap

export function presenceSupported(): boolean {
  return !!(firebaseEnabled && rtdb);
}

// presence の心拍とオフライン判定
// ENVで上書き可能（NEXT_PUBLIC_*）にしつつ、デフォルトは厳しめの値に最適化
const ENV_HEARTBEAT = Number(
  (process.env.NEXT_PUBLIC_PRESENCE_HEARTBEAT_MS || "").toString()
);
export const PRESENCE_HEARTBEAT_MS =
  Number.isFinite(ENV_HEARTBEAT) && ENV_HEARTBEAT > 0 ? ENV_HEARTBEAT : 20_000; // 20s

const ENV_STALE = Number(
  (process.env.NEXT_PUBLIC_PRESENCE_STALE_MS || "").toString()
);
export const PRESENCE_STALE_MS =
  Number.isFinite(ENV_STALE) && ENV_STALE > 0 ? ENV_STALE : 45_000; // 45s

// クライアント時計ずれが大きい端末の未来時刻を無視するための上限（ENV上書き可）
const ENV_SKEW = Number(
  (process.env.NEXT_PUBLIC_PRESENCE_MAX_CLOCK_SKEW_MS || "").toString()
);
export const MAX_CLOCK_SKEW_MS =
  Number.isFinite(ENV_SKEW) && ENV_SKEW > 0 ? ENV_SKEW : 30_000; // 30s

export async function attachPresence(roomId: string, uid: string) {
  if (!presenceSupported()) return () => {};
  const db = rtdb!;
  // 接続状態を監視し、接続ごとに push で一意キーを作成
  const connectedRef = ref(db, "/.info/connected");
  let meConnPath: string | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const startHeartbeat = (path: string) => {
    if (heartbeat) {
      try {
        clearInterval(heartbeat);
      } catch {}
      heartbeat = null;
    }
    const meConnRef = ref(db, path);
    heartbeat = setInterval(() => {
      try {
        // サーバ時刻で更新（ローカル時計への依存を排除）
        update(meConnRef, { ts: serverTimestamp() as any }).catch(() => {});
      } catch {}
    }, PRESENCE_HEARTBEAT_MS);
  };

  const stopHeartbeat = () => {
    if (heartbeat) {
      try {
        clearInterval(heartbeat);
      } catch {}
      heartbeat = null;
    }
  };

  const connectedHandler = async (snap: any) => {
    const isConnected = !!snap.val();
    if (isConnected) {
      // 新しい接続ノードを作成
      const baseRef = ref(db, ROOM_PATH(roomId) + "/" + uid);
      const meRef = push(baseRef);
      // push() の toJSON() はフル URL を返すことがあり、ref(db, fullUrl) は無効になる。
      // ここでは connId を取り出して相対パスを保持する（ref() に渡すため）。
      const connId = meRef.key;
      meConnPath = connId ? CONN_PATH(roomId, uid, connId) : null;
      try {
        await onDisconnect(meRef).remove();
      } catch {}
      try {
        await set(meRef, { online: true, ts: serverTimestamp() as any });
      } catch {}
      if (meConnPath) startHeartbeat(meConnPath);
    } else {
      // 切断検知: ハートビート停止（onDisconnect がサーバ側で削除する）
      stopHeartbeat();
    }
  };

  onRtdbValue(connectedRef, connectedHandler);

  // 明示的に解除するための関数を返す
  return async () => {
    console.log(`🚪 Detaching presence for uid=${uid}, roomId=${roomId}`);
    try {
      off(connectedRef, "value", connectedHandler as any);
    } catch {}
    stopHeartbeat();
    try {
      if (meConnPath) {
        console.log(`🗑️ Removing presence path: ${meConnPath}`);
        await remove(ref(db, meConnPath));
        console.log(`✅ Presence removed successfully`);
      }
    } catch (err) {
      console.error(`❌ Failed to remove presence:`, err);
    }
  };
}

export function subscribePresence(
  roomId: string,
  cb: (uids: string[], raw?: PresenceRoomMap) => void
) {
  if (!presenceSupported()) return () => {};
  const db = rtdb!;
  const roomRef = ref(db, ROOM_PATH(roomId));
  const handler = (snap: any) => {
    const val = (snap.val() || {}) as PresenceRoomMap;
    const now = Date.now();
    const uids = Object.keys(val).filter((uid) => {
      const conns = val[uid] || {};
      // いずれかの接続で ts が鮮度内ならオンライン
      return Object.values(conns).some((c: any) => {
        // serverTimestamp() 直後は数値でない可能性があるため online:true で即時オンライン扱い
        if (c?.online === true && typeof c?.ts !== "number") return true;
        const ts = typeof c?.ts === "number" ? c.ts : 0;
        if (ts <= 0) return false;
        // 未来に大きく進んだ ts は無効扱い（時計ズレ対策）
        if (ts - now > MAX_CLOCK_SKEW_MS) return false;
        return now - ts <= PRESENCE_STALE_MS;
      });
    });
    cb(uids, val as any);
  };
  const onErr = () => {
    // 読み取り権限エラーや一時的な接続エラー時は空扱いにして継続
    try {
      cb([], {} as any);
    } catch {}
  };
  onValue(roomRef, handler, onErr as any);
  return () => off(roomRef, "value", handler);
}

export async function fetchPresenceUids(roomId: string): Promise<string[]> {
  if (!presenceSupported()) return [];
  try {
    const snap = await get(ref(rtdb!, ROOM_PATH(roomId)));
    const val = (snap.val() || {}) as PresenceRoomMap;
    const now = Date.now();
    return Object.keys(val).filter((uid) => {
      const conns = val[uid] || {};
      return Object.values(conns).some((c: any) => {
        const ts = typeof c?.ts === "number" ? c.ts : 0;
        if (ts <= 0) return false;
        if (ts - now > MAX_CLOCK_SKEW_MS) return false;
        return now - ts <= PRESENCE_STALE_MS;
      });
    });
  } catch {
    return [];
  }
}

// 自分の uid 配下に残っている全ての connId を削除（多重タブやクラッシュ時の残骸対策）
export async function forceDetachAll(roomId: string, uid: string) {
  if (!presenceSupported()) return;
  try {
    const baseRef = ref(rtdb!, ROOM_PATH(roomId) + "/" + uid);
    const snap = await get(baseRef);
    const val = snap.val() as Record<string, any> | null;
    if (!val) return;
    const tasks: Promise<any>[] = [];
    for (const connId of Object.keys(val)) {
      tasks.push(
        remove(ref(rtdb!, CONN_PATH(roomId, uid, connId))).catch(() => {})
      );
    }
    await Promise.all(tasks);
  } catch {}
}
