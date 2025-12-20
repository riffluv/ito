import { PRESENCE_HEARTBEAT_MS, PRESENCE_STALE_MS } from "@/lib/constants/presence";
import { rtdb } from "@/lib/firebase/client";
import { presenceSupported } from "@/lib/firebase/presence";
import { logWarn } from "@/lib/utils/log";
import {
  onDisconnect,
  onValue,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
  off,
  type DataSnapshot,
} from "firebase/database";

type PresenceTimestamp = number | ReturnType<typeof serverTimestamp> | null;

const SESSION_ROOT = (roomId: string, uid: string) =>
  `presenceSessions/${roomId}/${uid}`;
const SESSION_PATH = (roomId: string, uid: string, sessionId: string) =>
  `${SESSION_ROOT(roomId, uid)}/${sessionId}`;

export type PresenceSessionRecord = {
  sessionId?: string;
  online?: boolean;
  connectedAt?: PresenceTimestamp;
  lastActive?: PresenceTimestamp;
  offlineAt?: PresenceTimestamp;
};

const toNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export function isPresenceSessionActive(
  session: PresenceSessionRecord | null | undefined,
  now: number
): boolean {
  if (!session) return false;
  if (session.online === false) return false;
  const lastActive = toNumber(session.lastActive);
  if (lastActive && now - lastActive > PRESENCE_STALE_MS * 2) return false;
  const offlineAt = toNumber(session.offlineAt);
  if (offlineAt && now - offlineAt > PRESENCE_STALE_MS * 2) return false;
  return true;
}

export function subscribePresenceSessions(
  roomId: string,
  uid: string,
  cb: (sessions: Record<string, PresenceSessionRecord>) => void
): () => void {
  if (!presenceSupported()) return () => {};
  const db = rtdb!;
  const baseRef = ref(db, SESSION_ROOT(roomId, uid));
  const handler = (snap: DataSnapshot) => {
    const val = (snap.val() || {}) as Record<string, PresenceSessionRecord>;
    cb(val);
  };
  onValue(baseRef, handler);
  return () => {
    try {
      off(baseRef, "value", handler);
    } catch {}
  };
}

const shouldPing = (): boolean => {
  if (typeof document === "undefined") return true;
  if (document.visibilityState !== "visible") return false;
  if (typeof document.hasFocus === "function" && !document.hasFocus()) return false;
  return true;
};

export async function touchPresenceSession(
  roomId: string,
  uid: string,
  sessionId: string
) {
  if (!presenceSupported()) return;
  if (!roomId || !uid || !sessionId) return;
  if (!shouldPing()) return;
  try {
    const db = rtdb!;
    await update(ref(db, SESSION_PATH(roomId, uid, sessionId)), {
      lastActive: serverTimestamp(),
      online: true,
    });
  } catch (error) {
    logWarn("presence-session", "touch-failed", {
      roomId,
      uid,
      sessionId,
      error,
    });
  }
}

export function attachPresenceSession(
  roomId: string,
  uid: string,
  sessionId: string
) {
  if (!presenceSupported()) return () => {};
  if (!roomId || !uid || !sessionId) return () => {};
  const db = rtdb!;
  const connectedRef = ref(db, "/.info/connected");
  const sessionRef = ref(db, SESSION_PATH(roomId, uid, sessionId));
  let disposed = false;
  let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;

  const clearHeartbeatTimer = () => {
    if (!heartbeatTimer) return;
    try {
      clearTimeout(heartbeatTimer);
    } catch {}
    heartbeatTimer = null;
  };

  const scheduleHeartbeat = (delay: number) => {
    if (disposed) return;
    clearHeartbeatTimer();
    heartbeatTimer = setTimeout(() => {
      heartbeatTimer = null;
      void touchPresenceSession(roomId, uid, sessionId);
      scheduleHeartbeat(PRESENCE_HEARTBEAT_MS);
    }, delay);
  };

  const connectedHandler = async (snap: DataSnapshot) => {
    if (!snap.val()) {
      clearHeartbeatTimer();
      return;
    }
    const context = { roomId, uid, sessionId };
    try {
      await onDisconnect(sessionRef).set({
        online: false,
        offlineAt: serverTimestamp(),
        lastActive: serverTimestamp(),
      });
    } catch (error) {
      logWarn("presence-session", "ondisconnect-failed", {
        ...context,
        error,
      });
    }
    try {
      const payload: PresenceSessionRecord = {
        sessionId,
        online: true,
        connectedAt: serverTimestamp(),
      };
      if (shouldPing()) {
        payload.lastActive = serverTimestamp();
      }
      await set(sessionRef, payload);
      if (shouldPing()) {
        void touchPresenceSession(roomId, uid, sessionId);
      }
      scheduleHeartbeat(PRESENCE_HEARTBEAT_MS);
    } catch (error) {
      logWarn("presence-session", "attach-failed", {
        ...context,
        error,
      });
    }
  };

  const visibilityHandler = () => {
    if (disposed) return;
    if (!shouldPing()) return;
    void touchPresenceSession(roomId, uid, sessionId);
  };

  const focusHandler = () => {
    if (disposed) return;
    if (!shouldPing()) return;
    void touchPresenceSession(roomId, uid, sessionId);
  };

  const blurHandler = () => {
    if (disposed) return;
    clearHeartbeatTimer();
  };

  onValue(connectedRef, connectedHandler);
  if (typeof window !== "undefined") {
    window.addEventListener("focus", focusHandler);
    window.addEventListener("blur", blurHandler);
  }
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", visibilityHandler);
  }

  return async () => {
    disposed = true;
    clearHeartbeatTimer();
    try {
      off(connectedRef, "value", connectedHandler);
    } catch {}
    if (typeof window !== "undefined") {
      window.removeEventListener("focus", focusHandler);
      window.removeEventListener("blur", blurHandler);
    }
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", visibilityHandler);
    }
    try {
      await remove(sessionRef);
    } catch (error) {
      logWarn("presence-session", "detach-failed", {
        roomId,
        uid,
        sessionId,
        error,
      });
    }
  };
}
