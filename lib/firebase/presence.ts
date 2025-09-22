import { firebaseEnabled, rtdb } from "@/lib/firebase/client";
import { logError, logInfo, logWarn } from "@/lib/utils/log";
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
  type Database,
} from "firebase/database";

// ルーム配下: presence/<roomId>/<uid>/<connId> = { online: true, ts }
// 同一uidの複数タブでも衝突しないよう、接続単位で管理する
const ROOM_PATH = (roomId: string) => `presence/${roomId}`;
const CONN_PATH = (roomId: string, uid: string, connId: string) =>
  `presence/${roomId}/${uid}/${connId}`;

export type PresenceConn = {
  online?: boolean;
  ts?: any;
  offlineAt?: any;
  connectedAt?: any;
};
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

const presenceLog = (action: string, detail?: Record<string, unknown>) =>
  logInfo("presence", action, detail);
const presenceWarn = (action: string, detail?: Record<string, unknown>) =>
  logWarn("presence", action, detail);
const presenceError = (action: string, detail?: Record<string, unknown>) =>
  logError("presence", action, detail);

const toNumber = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

export function isPresenceConnectionActive(
  conn: PresenceConn | Record<string, any> | null | undefined,
  now: number
): boolean {
  if (!conn) return false;
  const onlineFlag = (conn as PresenceConn | Record<string, any>)?.online;
  if (onlineFlag === false) return false;
  if (onlineFlag === true && typeof (conn as any)?.ts !== "number") return true;
  const ts = toNumber((conn as any)?.ts);
  if (!ts) return false;
  if (ts - now > MAX_CLOCK_SKEW_MS) return false;
  return now - ts <= PRESENCE_STALE_MS;
}

async function cleanupResidualConnections(
  db: Database,
  roomId: string,
  uid: string,
  keepConnId: string | null
) {
  try {
    const baseRef = ref(db, ROOM_PATH(roomId) + "/" + uid);
    const snap = await get(baseRef);
    const val = snap.val() as PresenceUserMap | null;
    if (!val) return;
    const now = Date.now();
    const tasks: Promise<unknown>[] = [];
    for (const [connId, payload] of Object.entries(val)) {
      if (keepConnId && connId === keepConnId) continue;
      if (!payload) continue;
      if (payload.online === true && isPresenceConnectionActive(payload, now)) continue;
      const targetRef = ref(db, CONN_PATH(roomId, uid, connId));
      tasks.push(remove(targetRef).catch((err) => {
        presenceWarn("cleanup-remove-failed", { roomId, uid, connId, error: err });
      }));
    }
    if (tasks.length) await Promise.all(tasks);
  } catch (err) {
    presenceWarn("cleanup-residual-error", { roomId, uid, error: err });
  }
}

export async function attachPresence(roomId: string, uid: string) {
  if (!presenceSupported()) return () => {};
  const db = rtdb!;
  // 接続状態を監視し、接続ごとに push で一意キーを作成
  const connectedRef = ref(db, "/.info/connected");
  let meConnPath: string | null = null;
  let meConnId: string | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const startHeartbeat = (path: string, connId: string) => {
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
        update(meConnRef, {
          ts: serverTimestamp() as any,
          online: true,
        }).catch((err) => {
          presenceWarn("heartbeat-update-failed", {
            roomId,
            uid,
            connId,
            error: err,
          });
        });
      } catch (err) {
        presenceWarn("heartbeat-update-error", {
          roomId,
          uid,
          connId,
          error: err,
        });
      }
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
      const connId = meRef.key;
      meConnPath = connId ? CONN_PATH(roomId, uid, connId) : null;
      meConnId = connId ?? null;
      presenceLog("connected", { roomId, uid, connId });
      if (!connId || !meConnPath) {
        presenceWarn("missing-connid", { roomId, uid });
        return;
      }
      try {
        await onDisconnect(meRef).set({
          online: false,
          ts: serverTimestamp() as any,
          offlineAt: serverTimestamp() as any,
        });
        presenceLog("ondisconnect-armed", { roomId, uid, connId });
      } catch (err) {
        presenceWarn("ondisconnect-arm-failed", {
          roomId,
          uid,
          connId,
          error: err,
        });
      }
      try {
        await set(meRef, {
          online: true,
          ts: serverTimestamp() as any,
          connectedAt: serverTimestamp() as any,
        });
      } catch (err) {
        presenceError("initial-set-failed", { roomId, uid, connId, error: err });
      }
      startHeartbeat(meConnPath, connId);
      cleanupResidualConnections(db, roomId, uid, connId).catch(() => {});
    } else {
      // 切断検知: ハートビート停止（onDisconnect がサーバ側で削除する）
      presenceLog("connection-offline", { roomId, uid, connId: meConnId });
      stopHeartbeat();
    }
  };

  onRtdbValue(connectedRef, connectedHandler);

  // 明示的に解除するための関数を返す
  return async () => {
    presenceLog("detach", { uid, roomId, connId: meConnId });
    try {
      off(connectedRef, "value", connectedHandler as any);
    } catch {}
    stopHeartbeat();
    try {
      if (meConnPath) {
        await remove(ref(db, meConnPath));
        presenceLog("detach-remove", { roomId, uid, connId: meConnId });
      }
    } catch (err) {
      presenceWarn("detach-remove-failed", {
        roomId,
        uid,
        connId: meConnId,
        error: err,
      });
      if (meConnPath) {
        try {
          await update(ref(db, meConnPath), {
            online: false,
            ts: serverTimestamp() as any,
            offlineAt: serverTimestamp() as any,
          });
          presenceLog("detach-mark-offline", {
            roomId,
            uid,
            connId: meConnId,
          });
        } catch (err2) {
          presenceError("detach-mark-offline-failed", {
            roomId,
            uid,
            connId: meConnId,
            error: err2,
          });
        }
      }
    }
    meConnPath = null;
    meConnId = null;
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
    const uids = Object.keys(val).filter((uidKey) => {
      const conns = val[uidKey] || {};
      return Object.values(conns).some((conn) =>
        isPresenceConnectionActive(conn as any, now)
      );
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
    return Object.keys(val).filter((uidKey) => {
      const conns = val[uidKey] || {};
      return Object.values(conns).some((conn) =>
        isPresenceConnectionActive(conn as any, now)
      );
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
    await remove(baseRef).catch(() => {});
  } catch {}
}

