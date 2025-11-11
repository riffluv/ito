import { auth, firebaseEnabled, rtdb } from "@/lib/firebase/client";
import {
  PRESENCE_HEARTBEAT_MS,
  PRESENCE_HEARTBEAT_RETRY_DELAYS_MS,
  PRESENCE_STALE_MS,
} from "@/lib/constants/presence";
import { incrementPresenceMetric, setPresenceMetric } from "@/lib/utils/metrics";
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
  type DataSnapshot,
} from "firebase/database";
import type { Unsubscribe } from "firebase/auth";

type PresenceTimestamp = number | ReturnType<typeof serverTimestamp> | null;

// ルーム配下: presence/<roomId>/<uid>/<connId> = { online: true, ts }
// 同一uidの複数タブでも衝突しないよう、接続単位で管理する
const ROOM_PATH = (roomId: string) => `presence/${roomId}`;
const CONN_PATH = (roomId: string, uid: string, connId: string) =>
  `presence/${roomId}/${uid}/${connId}`;

export type PresenceConn = {
  online?: boolean;
  ts?: PresenceTimestamp;
  offlineAt?: PresenceTimestamp;
  connectedAt?: PresenceTimestamp;
  swVersion?: string | null;
  swReadyAt?: PresenceTimestamp;
};
export type PresenceUserMap = Record<string, PresenceConn>; // connId -> PresenceConn
export type PresenceRoomMap = Record<string, PresenceUserMap>; // uid -> PresenceUserMap

export function presenceSupported(): boolean {
  return !!(firebaseEnabled && rtdb);
}

const presenceLog = (action: string, detail?: Record<string, unknown>) =>
  logInfo("presence", action, detail);
const presenceWarn = (action: string, detail?: Record<string, unknown>) =>
  logWarn("presence", action, detail);
const presenceError = (action: string, detail?: Record<string, unknown>) =>
  logError("presence", action, detail);

const toNumber = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

export function isPresenceConnectionActive(
  conn: PresenceConn | Record<string, unknown> | null | undefined,
  now: number
): boolean {
  if (!conn) return false;
  const record = conn as PresenceConn;
  if (record.online === false) return false;
  const offlineAt = toNumber(record.offlineAt);
  if (offlineAt && now - offlineAt > PRESENCE_STALE_MS * 2) {
    return false;
  }
  return true;
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
      if (payload.online === true) continue;
      const offlineAt = toNumber(payload.offlineAt);
      if (!offlineAt || now - offlineAt <= PRESENCE_STALE_MS * 2) continue;
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
  const connectedRef = ref(db, "/.info/connected");
  const wait = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));
  const attachRetryDelays = [0, ...PRESENCE_HEARTBEAT_RETRY_DELAYS_MS];

  let meConnPath: string | null = null;
  let meConnId: string | null = null;
  let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeatInFlight = false;
  let heartbeatRetryIndex = 0;
  let disposed = false;
  let cachedToken: string | null = null;
  const teardownCallbacks: Array<() => void> = [];
  const eventTeardownCallbacks: Array<() => void> = [];

  const clearHeartbeatTimer = () => {
    if (!heartbeatTimer) return;
    try {
      clearTimeout(heartbeatTimer);
    } catch {}
    heartbeatTimer = null;
  };

  const scheduleNextHeartbeat = (delay: number) => {
    if (disposed) return;
    clearHeartbeatTimer();
    heartbeatTimer = setTimeout(() => {
      heartbeatTimer = null;
      void sendHeartbeat("timer");
    }, delay);
  };

  const refreshToken = async () => {
    if (!auth?.currentUser) {
      cachedToken = null;
      return;
    }
    try {
      cachedToken = await auth.currentUser.getIdToken();
    } catch (error) {
      cachedToken = null;
      presenceWarn("token-refresh-failed", { roomId, uid, error });
    }
  };

  const authUnsubscribe: Unsubscribe | null = auth
    ? auth.onIdTokenChanged((user) => {
        if (!user) {
          cachedToken = null;
          return;
        }
        user
          .getIdToken()
          .then((token) => {
            cachedToken = token;
          })
          .catch((error) => {
            cachedToken = null;
            presenceWarn("token-update-error", { roomId, uid, error });
          });
      })
    : null;
  if (authUnsubscribe) {
    teardownCallbacks.push(authUnsubscribe);
    void refreshToken();
  }

  const sendBeaconHeartbeat = (reason: string) => {
    if (
      typeof navigator === "undefined" ||
      typeof navigator.sendBeacon !== "function"
    ) {
      return false;
    }
    if (!meConnId || !cachedToken) return false;
    if (typeof location === "undefined") return false;
    const payload = JSON.stringify({
      roomId,
      uid,
      connId: meConnId,
      token: cachedToken,
      reason,
    });
    try {
      const ok = navigator.sendBeacon(
        `${location.origin}/api/presence/heartbeat`,
        payload
      );
      if (ok) incrementPresenceMetric("beacon.sent");
      else incrementPresenceMetric("beacon.dropped");
      return ok;
    } catch (error) {
      incrementPresenceMetric("beacon.error");
      presenceWarn("beacon-send-failed", { roomId, uid, connId: meConnId, error });
      return false;
    }
  };

  const sendHeartbeat = async (reason: string) => {
    if (disposed) return;
    if (!meConnPath) return;
    if (heartbeatInFlight) return;
    heartbeatInFlight = true;
    const meConnRef = ref(db, meConnPath);
    try {
      const payload: PresenceConn = {
        ts: serverTimestamp(),
        online: true,
      };
      try {
        const ver =
          process?.env?.NEXT_PUBLIC_APP_VERSION ??
          process?.env?.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
          "dev";
        payload.swVersion = ver;
      } catch {}
      await update(meConnRef, payload);
      incrementPresenceMetric("heartbeat.ok");
      presenceLog("heartbeat", { roomId, uid, connId: meConnId, reason });
      heartbeatRetryIndex = 0;
      scheduleNextHeartbeat(PRESENCE_HEARTBEAT_MS);
    } catch (error) {
      incrementPresenceMetric("heartbeat.fail");
      presenceWarn("heartbeat-update-failed", {
        roomId,
        uid,
        connId: meConnId,
        reason,
        attempt: heartbeatRetryIndex,
        error,
      });
      const retryDelay =
        PRESENCE_HEARTBEAT_RETRY_DELAYS_MS[
          Math.min(
            heartbeatRetryIndex,
            PRESENCE_HEARTBEAT_RETRY_DELAYS_MS.length - 1
          )
        ] ?? PRESENCE_HEARTBEAT_MS;
      heartbeatRetryIndex = Math.min(
        heartbeatRetryIndex + 1,
        PRESENCE_HEARTBEAT_RETRY_DELAYS_MS.length
      );
      scheduleNextHeartbeat(retryDelay);
    } finally {
      heartbeatInFlight = false;
    }
  };

  const triggerImmediateHeartbeat = (reason: string) => {
    if (disposed) return;
    clearHeartbeatTimer();
    void sendHeartbeat(reason);
  };

  const registerVisibilityFallbacks = () => {
    detachEventListeners();
    if (typeof document !== "undefined") {
      const visibilityHandler = () => {
        if (!meConnId) return;
        triggerImmediateHeartbeat(
          document.visibilityState === "visible"
            ? "visibility-visible"
            : "visibility-hidden"
        );
      };
      document.addEventListener("visibilitychange", visibilityHandler, {
        passive: true,
      });
      eventTeardownCallbacks.push(() =>
        document.removeEventListener("visibilitychange", visibilityHandler)
      );
    }
    if (typeof window !== "undefined") {
      const unloadHandler = () => {
        if (sendBeaconHeartbeat("unload")) return;
        triggerImmediateHeartbeat("unload");
      };
      window.addEventListener("pagehide", unloadHandler);
      window.addEventListener("beforeunload", unloadHandler);
      eventTeardownCallbacks.push(() => {
        window.removeEventListener("pagehide", unloadHandler);
        window.removeEventListener("beforeunload", unloadHandler);
      });
    }
  };

  const detachEventListeners = () => {
    for (const callback of eventTeardownCallbacks.splice(0)) {
      try {
        callback();
      } catch {}
    }
  };

  const detachListeners = () => {
    detachEventListeners();
    for (const callback of teardownCallbacks.splice(0)) {
      try {
        callback();
      } catch {}
    }
  };

  const executeWithBackoff = async <T>(
    label: string,
    task: () => Promise<T>,
    context: Record<string, unknown>
  ): Promise<T> => {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < attachRetryDelays.length; attempt += 1) {
      const delay = attachRetryDelays[attempt] ?? 0;
      if (delay > 0) {
        await wait(delay);
      }
      try {
        const result = await task();
        if (attempt > 0) {
          presenceLog(`${label}-retry-success`, { ...context, attempt });
        }
        return result;
      } catch (error) {
        lastError = error;
        if (attempt === attachRetryDelays.length - 1) {
          presenceError(`${label}-failed`, { ...context, error });
          throw error;
        }
        presenceWarn(`${label}-retry`, { ...context, attempt, error });
      }
    }
    throw lastError ?? new Error(`${label}-failed`);
  };

  const connectedHandler = async (snap: DataSnapshot) => {
    const isConnected = !!snap.val();
    if (!isConnected) {
      presenceLog("connection-offline", { roomId, uid, connId: meConnId });
      clearHeartbeatTimer();
      detachEventListeners();
      meConnPath = null;
      meConnId = null;
      setPresenceMetric("connId", null);
      return;
    }

    incrementPresenceMetric("connection.open");
    const baseRef = ref(db, ROOM_PATH(roomId) + "/" + uid);
    const meRef = push(baseRef);
    const connId = meRef.key;
    meConnPath = connId ? CONN_PATH(roomId, uid, connId) : null;
    meConnId = connId ?? null;
    setPresenceMetric("connId", meConnId || null);
    presenceLog("connected", { roomId, uid, connId });
    if (!connId || !meConnPath) {
      presenceWarn("missing-connid", { roomId, uid });
      return;
    }

    const context = { roomId, uid, connId };
    await executeWithBackoff(
      "ondisconnect-set",
      () =>
        onDisconnect(meRef).set({
          online: false,
          ts: serverTimestamp(),
          offlineAt: serverTimestamp(),
        }),
      context
    );

    await executeWithBackoff(
      "presence-initial",
      () =>
        set(meRef, {
          online: true,
          ts: serverTimestamp(),
          connectedAt: serverTimestamp(),
        }),
      context
    );

    // 現行アプリ版を presence に記録（best-effort）
    try {
      const version = ((): string => {
        try {
          return (
            process?.env?.NEXT_PUBLIC_APP_VERSION ||
            process?.env?.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
            "dev"
          );
        } catch {
          return "dev";
        }
      })();
      await update(meRef, {
        swVersion: version,
        swReadyAt: serverTimestamp(),
      });
    } catch {}

    registerVisibilityFallbacks();
    triggerImmediateHeartbeat("initial");
    cleanupResidualConnections(db, roomId, uid, connId).catch(() => {});
  };

  onRtdbValue(connectedRef, connectedHandler);

  return async () => {
    disposed = true;
    presenceLog("detach", { uid, roomId, connId: meConnId });
    try {
      off(connectedRef, "value", connectedHandler);
    } catch {}
    clearHeartbeatTimer();
    detachListeners();
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
            ts: serverTimestamp(),
            offlineAt: serverTimestamp(),
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
    setPresenceMetric("connId", null);
  };
}

export function subscribePresence(
  roomId: string,
  cb: (uids: string[], raw?: PresenceRoomMap) => void
) {
  if (!presenceSupported()) return () => {};
  const db = rtdb!;
  const roomRef = ref(db, ROOM_PATH(roomId));
  let lastSnapshot: { uids: string[]; raw: PresenceRoomMap } | null = null;
  const handler = (snap: DataSnapshot) => {
    const val = (snap.val() || {}) as PresenceRoomMap;
    const now = Date.now();
    const uids = Object.keys(val).filter((uidKey) => {
      const conns = val[uidKey] || {};
      return Object.values(conns).some((conn) =>
        isPresenceConnectionActive(conn, now)
      );
    });
    lastSnapshot = { uids, raw: val };
    cb(uids, val);
  };
  const onErr = (error: Error) => {
    presenceWarn("subscribe-error", { roomId, error });
    if (!lastSnapshot) return;
    try {
      cb(lastSnapshot.uids, lastSnapshot.raw);
    } catch {}
  };
  onValue(roomRef, handler, onErr);
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
        isPresenceConnectionActive(conn, now)
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
    const val = snap.val() as Record<string, unknown> | null;
    if (!val) return;
    const tasks: Promise<void>[] = [];
    for (const connId of Object.keys(val)) {
      tasks.push(
        remove(ref(rtdb!, CONN_PATH(roomId, uid, connId))).catch(() => {})
      );
    }
    await Promise.all(tasks);
    await remove(baseRef).catch(() => {});
  } catch {}
}

