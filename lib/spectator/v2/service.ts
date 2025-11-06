import { auth, db } from "@/lib/firebase/client";
import { traceAction, traceError } from "@/lib/utils/trace";
import { doc, onSnapshot, Timestamp, type Unsubscribe } from "firebase/firestore";

import type {
  SpectatorRejoinSnapshot,
  SpectatorRejoinSource,
  SpectatorSessionMode,
  SpectatorSessionServices,
} from "./types";

const INVITE_COLLECTION = "spectatorInvites";
const SESSION_COLLECTION = "spectatorSessions";

type PostResult<T> = { ok: true; data: T } | { ok: false; error: string };

const ensureDb = () => {
  if (!db) {
    throw new Error("firebase-unavailable");
  }
  return db;
};

const toMillis = (value: Timestamp | { toMillis?: () => number } | number | null | undefined) => {
  if (typeof value === "number") return value;
  if (value && typeof (value as any).toMillis === "function") {
    try {
      return Number((value as { toMillis: () => number }).toMillis());
    } catch {
      return null;
    }
  }
  return null;
};

async function obtainIdToken(forceRefresh: boolean): Promise<string | null> {
  try {
    const user = auth?.currentUser ?? null;
    if (!user) return null;
    const token = await user.getIdToken(forceRefresh);
    return token ?? null;
  } catch {
    return null;
  }
}

async function callSpectatorApi<TResponse>(
  path: string,
  body: Record<string, unknown>,
  { optionalAuth = false }: { optionalAuth?: boolean } = {}
): Promise<PostResult<TResponse>> {
  const user = auth?.currentUser ?? null;

  const execute = async (token: string | null) => {
    const payload =
      token && token.length > 0 ? { ...body, token } : body;

    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });

    if (response.ok) {
      try {
        const json = (await response.json()) as TResponse;
        return { ok: true, data: json } as const;
      } catch {
        return { ok: false, error: "invalid_response" } as const;
      }
    }

    let detail: any = null;
    try {
      detail = await response.json();
    } catch {
      detail = null;
    }
    const errorCode =
      typeof detail?.error === "string" ? detail.error : `http_${response.status}`;
    return { ok: false, error: errorCode } as const;
  };

  if (!user) {
    if (optionalAuth) {
      return await execute(null);
    }
    return { ok: false, error: "auth_required" };
  }

  let token = await obtainIdToken(false);
  let result = await execute(token);
  if (!result.ok && result.error === "unauthorized") {
    token = await obtainIdToken(true);
    result = await execute(token);
  }
  return result;
}

const mapErrorToMessage = (code: string): string => {
  switch (code) {
    case "auth_required":
    case "unauthorized":
      return "auth-required";
    case "room_id_required":
    case "room_not_found":
      return "room-invalid";
    case "session_not_found":
      return "session-not-found";
    case "invite_room_mismatch":
    case "invite-room-mismatch":
      return "invite-room-mismatch";
    case "invite_not_found":
    case "invite-not-found":
      return "invite-not-found";
    case "invite_limit_reached":
    case "invite-limit-reached":
      return "invite-limit-reached";
    case "invite_expired":
    case "invite-expired":
      return "invite-expired";
    case "forbidden":
      return "forbidden";
    case "rejoin_not_pending":
      return "rejoin-not-pending";
    case "viewer_mismatch":
      return "viewer-mismatch";
    case "room_mismatch":
    case "room-mismatch":
      return "room-mismatch";
    default:
      return code || "unknown-error";
  }
};

export const spectatorV2Service: SpectatorSessionServices = {
  consumeInvite: async ({ inviteId, roomId, viewerUid }) => {
    const traceDetail = { inviteId, roomId };
    try {
      const response = await callSpectatorApi<{
        ok: true;
        sessionId: string;
        mode: SpectatorSessionMode;
        inviteId: string;
        flags?: Record<string, unknown> | null;
      }>(`/api/spectator/invites/${encodeURIComponent(inviteId)}/consume`, {
        roomId,
        viewerUid: viewerUid ?? null,
      }, { optionalAuth: true });

      if (!response.ok) {
        const message = mapErrorToMessage(response.error);
        traceError("spectatorV2.invite.consume", new Error(message), traceDetail);
        throw new Error(message);
      }

      const { sessionId, mode } = response.data;
      traceAction("spectatorV2.invite.consume", {
        ...traceDetail,
        sessionId,
        mode,
      });
      return {
        sessionId,
        mode,
        inviteId,
      };
    } catch (error) {
      if (!(error instanceof Error)) {
        traceError("spectatorV2.invite.consume", error, traceDetail);
        throw error;
      }
      traceError("spectatorV2.invite.consume", error, traceDetail);
      throw error;
    }
  },

  startWatching: async ({ sessionId, roomId }) => {
    const traceDetail = { sessionId, roomId };
    try {
      const response = await callSpectatorApi<{ ok: true }>(
        `/api/spectator/sessions/${encodeURIComponent(sessionId)}/watch`,
        { roomId }
      );
      if (!response.ok) {
        const message = mapErrorToMessage(response.error);
        traceError("spectatorV2.session.watch", new Error(message), traceDetail);
        throw new Error(message);
      }
      traceAction("spectatorV2.session.watch", traceDetail);
    } catch (error) {
      traceError("spectatorV2.session.watch", error, traceDetail);
      throw error;
    }
  },

  requestRejoin: async ({ sessionId, roomId, source }) => {
    const traceDetail = { sessionId, roomId, source };
    try {
      const response = await callSpectatorApi<{ ok: true }>(
        `/api/spectator/sessions/${encodeURIComponent(sessionId)}/rejoin`,
        { roomId, source }
      );
      if (!response.ok) {
        const message = mapErrorToMessage(response.error);
        traceError("spectatorV2.session.rejoin", new Error(message), traceDetail);
        throw new Error(message);
      }
      traceAction("spectatorV2.session.rejoin", traceDetail);
    } catch (error) {
      traceError("spectatorV2.session.rejoin", error, traceDetail);
      throw error;
    }
  },

  cancelRejoin: async ({ sessionId, roomId }) => {
    const traceDetail = { sessionId, roomId };
    try {
      const response = await callSpectatorApi<{ ok: true }>(
        `/api/spectator/sessions/${encodeURIComponent(sessionId)}/cancel`,
        { roomId }
      );
      if (!response.ok) {
        const message = mapErrorToMessage(response.error);
        traceError("spectatorV2.session.cancel", new Error(message), traceDetail);
        throw new Error(message);
      }
      traceAction("spectatorV2.session.cancel", traceDetail);
    } catch (error) {
      traceError("spectatorV2.session.cancel", error, traceDetail);
      throw error;
    }
  },

  endSession: async ({ sessionId, roomId, reason }) => {
    const traceDetail = { sessionId, roomId, reason: reason ?? null };
    try {
      const response = await callSpectatorApi<{ ok: true }>(
        `/api/spectator/sessions/${encodeURIComponent(sessionId)}/end`,
        { roomId, reason: reason ?? null }
      );
      if (!response.ok) {
        const message = mapErrorToMessage(response.error);
        traceError("spectatorV2.session.end", new Error(message), traceDetail);
        throw new Error(message);
      }
      traceAction("spectatorV2.session.end", traceDetail);
    } catch (error) {
      traceError("spectatorV2.session.end", error, traceDetail);
      throw error;
    }
  },

  observeRejoinSnapshot: ({ sessionId, roomId, onSnapshot: handleSnapshot, onError }) => {
    const database = ensureDb();
    const sessionRef = doc(database, SESSION_COLLECTION, sessionId);
    let unsub: Unsubscribe | null = null;
    try {
      unsub = onSnapshot(
        sessionRef,
        (snap) => {
          try {
            if (!snap.exists()) {
              handleSnapshot(null);
              return;
            }
            const data = snap.data() as Record<string, any>;
            if (roomId && data.roomId && data.roomId !== roomId) {
              handleSnapshot(null);
              return;
            }
            const rejoinData = data.rejoinRequest ?? null;
            handleSnapshot(mapRejoinSnapshot(rejoinData));
          } catch (error) {
            traceError("spectatorV2.session.observe", error, {
              sessionId,
              roomId,
            });
            onError(error);
          }
        },
        (error) => {
          traceError("spectatorV2.session.observe", error, { sessionId, roomId });
          onError(error);
        }
      );
    } catch (error) {
      traceError("spectatorV2.session.observe", error, { sessionId, roomId });
      throw error;
    }
    traceAction("spectatorV2.session.observe.start", { sessionId, roomId });
    return () => {
      traceAction("spectatorV2.session.observe.stop", { sessionId, roomId });
      unsub?.();
    };
  },
  approveRejoin: approveSpectatorRejoin,
  rejectRejoin: rejectSpectatorRejoin,
};

export function mapRejoinSnapshot(snapshot: Record<string, any> | null): SpectatorRejoinSnapshot {
  if (!snapshot) return null;
  const statusRaw = snapshot.status;
  const source: SpectatorRejoinSource = snapshot.source === "auto" ? "auto" : "manual";
  const createdAt =
    typeof snapshot.createdAt === "number"
      ? snapshot.createdAt
      : toMillis(snapshot.createdAt ?? null);
  if (statusRaw === "accepted") {
    return {
      status: "accepted",
      source,
      createdAt,
    };
  }
  if (statusRaw === "rejected") {
    return {
      status: "rejected",
      source,
      createdAt,
      reason: typeof snapshot.reason === "string" ? snapshot.reason : null,
    };
  }
  return {
    status: "pending",
    source,
    createdAt,
  };
}

export async function approveSpectatorRejoin(params: { sessionId: string; roomId: string }) {
  const { sessionId, roomId } = params;
  const traceDetail = { sessionId, roomId };
  const response = await callSpectatorApi<{ ok: true }>(
    `/api/spectator/sessions/${encodeURIComponent(sessionId)}/approve`,
    { roomId }
  );
  if (!response.ok) {
    const message = mapErrorToMessage(response.error);
    traceError("spectatorV2.session.approve", new Error(message), traceDetail);
    throw new Error(message);
  }
  traceAction("spectatorV2.session.approve", traceDetail);
}

export async function rejectSpectatorRejoin(params: {
  sessionId: string;
  roomId: string;
  reason?: string | null;
}) {
  const { sessionId, roomId, reason } = params;
  const traceDetail = { sessionId, roomId, hasReason: !!reason };
  const response = await callSpectatorApi<{ ok: true }>(
    `/api/spectator/sessions/${encodeURIComponent(sessionId)}/reject`,
    { roomId, reason: reason ?? null }
  );
  if (!response.ok) {
    const message = mapErrorToMessage(response.error);
    traceError("spectatorV2.session.reject", new Error(message), traceDetail);
    throw new Error(message);
  }
  traceAction("spectatorV2.session.reject", traceDetail);
}
