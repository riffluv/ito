import { FieldValue } from "firebase-admin/firestore";

import { getAdminAuth, getAdminDb } from "@/lib/server/firebaseAdmin";
import { acquireRoomLock } from "@/lib/server/roomQueue";
import { composeWaitingResetPayload } from "@/lib/server/roomActions";
import { logRoomCommandAudit } from "@/lib/server/roomAudit";
import { buildRoomSyncPatch, publishRoomSyncPatch } from "@/lib/server/roomSync";
import { traceAction, traceError } from "@/lib/utils/trace";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import type { RoomSyncPatch } from "@/lib/sync/roomSyncPatch";
import {
  codedError,
  releaseLockSafely,
  safeTraceAction,
} from "@/lib/server/roomCommandShared";
import { verifyHostIdentity } from "@/lib/server/roomCommandAuth";

type WithAuth = { token: string };

export async function resetRoomCommand(params: {
  roomId: string;
  recallSpectators?: boolean;
  requestId: string | null;
  sessionId?: string;
} & WithAuth): Promise<RoomSyncPatch> {
  const db = getAdminDb();
  const roomRef = db.collection("rooms").doc(params.roomId);
  const roomSnapForAuth = await roomRef.get();
  const roomForAuth = roomSnapForAuth.exists
    ? (roomSnapForAuth.data() as RoomDoc)
    : undefined;
  const uid = await verifyHostIdentity(
    roomForAuth,
    params.token,
    params.roomId,
    params.sessionId ?? undefined
  );
  const lockHolder = `reset:${params.requestId ?? "none"}`;
  const locked = await acquireRoomLock(params.roomId, lockHolder);
  if (!locked) {
    throw codedError("rate_limited", "rate_limited");
  }
  try {
    let isAdmin = false;
    try {
      isAdmin = (await getAdminAuth().verifyIdToken(params.token)).admin === true;
    } catch {
      isAdmin = false;
    }

    let prevStatus: RoomDoc["status"] | null = null;
    let alreadyReset = false;
    let playerCount = 0;
    let nextStatusVersion = 0;
    const syncTs = Date.now();

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists) {
        throw codedError("room_not_found", "room_not_found");
      }

      const room = snap.data() as RoomDoc | undefined;
      prevStatus = room?.status ?? null;
      const currentStatusVersion =
        typeof room?.statusVersion === "number" ? room.statusVersion : 0;
      alreadyReset =
        !!params.requestId &&
        room?.resetRequestId === params.requestId &&
        room?.status === "waiting";
      nextStatusVersion = alreadyReset
        ? currentStatusVersion
        : currentStatusVersion + 1;

      const authorized = uid === room?.hostId || uid === room?.creatorId || isAdmin;
      if (!authorized) {
        throw codedError("forbidden", "forbidden", "host_only");
      }

      // Read all docs before any writes (Firestore transaction requirement).
      const playersRef = roomRef.collection("players");
      const playersSnap = await tx.get(playersRef);
      playerCount = playersSnap.size;

      if (!alreadyReset) {
        const resetPayload = composeWaitingResetPayload({
          recallOpen: params.recallSpectators ?? true,
          resetRound: true,
          clearTopic: true,
          closedAt: null,
          expiresAt: null,
        });
        if (params.requestId) {
          resetPayload.resetRequestId = params.requestId;
        }
        resetPayload.lastCommandAt =
          FieldValue.serverTimestamp() as unknown as RoomDoc["lastCommandAt"];
        resetPayload.statusVersion = nextStatusVersion;
        tx.update(roomRef, resetPayload);
      }

      // Atomic: waiting reset must clear per-player state together to avoid "room waiting but players stale".
      playersSnap.forEach((doc) => {
        tx.update(doc.ref, {
          number: null,
          clue1: "",
          ready: false,
          orderIndex: 0,
        } satisfies Partial<PlayerDoc>);
      });
    });

    if (alreadyReset) {
      traceAction("room.reset.server.idempotent", {
        roomId: params.roomId,
        uid,
        requestId: params.requestId,
        players: playerCount,
      });
      void logRoomCommandAudit({
        roomId: params.roomId,
        uid,
        requestId: params.requestId,
        command: "reset",
        prevStatus,
        nextStatus: "waiting",
        note: "idempotent",
      });
      const sync = buildRoomSyncPatch({
        roomId: params.roomId,
        statusVersion: nextStatusVersion,
        room: {
          status: "waiting",
          topic: null,
          topicBox: null,
          round: 0,
          ui: {
            roundPreparing: false,
            recallOpen: params.recallSpectators ?? true,
            revealPending: false,
          },
        },
        command: "reset",
        requestId: params.requestId,
        source: "api",
        ts: syncTs,
      });
      void publishRoomSyncPatch({
        ...sync,
        meta: { ...sync.meta, source: "rtdb" },
      });
      return sync;
    }

    // ルーム更新完了後、即座にログを出力（レスポンス前の最小限の処理）
    traceAction("room.reset.server", {
      roomId: params.roomId,
      uid,
      requestId: params.requestId ?? null,
      prevStatus,
      nextStatus: "waiting",
      players: playerCount,
    });
    void logRoomCommandAudit({
      roomId: params.roomId,
      uid,
      requestId: params.requestId,
      command: "reset",
      prevStatus,
      nextStatus: "waiting",
    });

    // Spectator pending cleanup を非同期で実行（ユーザーの体感速度を優先）
    // API レスポンスはここで返し、cleanup はバックグラウンドで継続
    void (async () => {
      try {
        const sessionsRef = db.collection("spectatorSessions");
        const pendingSnap = await sessionsRef
          .where("roomId", "==", params.roomId)
          .where("rejoinRequest.status", "==", "pending")
          .get();

        const watchingSnap = await sessionsRef
          .where("roomId", "==", params.roomId)
          .where("rejoinRequest", "==", null)
          .where("status", "==", "watching")
          .get();

        if (!pendingSnap.empty || !watchingSnap.empty) {
          const batch = db.batch();
          pendingSnap.forEach((doc) => {
            batch.update(doc.ref, {
              status: "watching",
              rejoinRequest: null,
              updatedAt: FieldValue.serverTimestamp(),
            });
          });

          watchingSnap.forEach((doc) => {
            batch.update(doc.ref, {
              rejoinRequest: {
                status: "pending",
                source: "auto",
                createdAt: FieldValue.serverTimestamp(),
              },
              updatedAt: FieldValue.serverTimestamp(),
            });
          });

          await batch.commit();
          safeTraceAction("room.reset.spectator.cleanup.done", {
            roomId: params.roomId,
            pending: pendingSnap.size,
            watching: watchingSnap.size,
          });
        }
      } catch (cleanupError) {
        traceError("room.reset.spectator.cleanup", cleanupError, { roomId: params.roomId });
      }
    })();

    const sync = buildRoomSyncPatch({
      roomId: params.roomId,
      statusVersion: nextStatusVersion,
      room: {
        status: "waiting",
        topic: null,
        topicBox: null,
        round: 0,
        ui: {
          roundPreparing: false,
          recallOpen: params.recallSpectators ?? true,
          revealPending: false,
        },
      },
      command: "reset",
      requestId: params.requestId,
      source: "api",
      ts: syncTs,
    });
    void publishRoomSyncPatch({
      ...sync,
      meta: { ...sync.meta, source: "rtdb" },
    });
    return sync;
  } finally {
    await releaseLockSafely(params.roomId, lockHolder);
  }
}

