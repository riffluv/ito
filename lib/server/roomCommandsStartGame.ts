import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/server/firebaseAdmin";
import { acquireRoomLock } from "@/lib/server/roomQueue";
import { traceAction, traceError } from "@/lib/utils/trace";
import type { RoomDoc } from "@/lib/types";
import type { RoomSyncPatch } from "@/lib/sync/roomSyncPatch";
import {
  clearRoundPreparingWithRetry,
  codedError,
  releaseLockSafely,
} from "@/lib/server/roomCommandShared";
import { verifyHostIdentity } from "@/lib/server/roomCommandAuth";
import { auditStartGame } from "@/lib/server/startGame/auditStartGame";
import { prepareStartGameAutoDeal } from "@/lib/server/startGame/prepareStartGameAutoDeal";
import { publishStartGameSync } from "@/lib/server/startGame/publishStartGameSync";
import { runStartGameTransaction } from "@/lib/server/startGame/runStartGameTransaction";

type WithAuth = { token: string };

export async function startGameCommand(params: {
  roomId: string;
  allowFromFinished?: boolean;
  allowFromClue?: boolean;
  requestId: string;
  sessionId?: string;
  autoDeal?: boolean;
  topicType?: string | null;
  customTopic?: string | null;
  presenceUids?: string[] | null;
} & WithAuth): Promise<RoomSyncPatch> {
  const db = getAdminDb();
  const roomRef = db.collection("rooms").doc(params.roomId);
  const roomSnapForAuth = await roomRef.get();
  const roomForAuth = roomSnapForAuth.exists ? (roomSnapForAuth.data() as RoomDoc) : undefined;
  const uid = await verifyHostIdentity(roomForAuth, params.token, params.roomId, params.sessionId);
  const allowFromFinished = params.allowFromFinished ?? false;
  const allowFromClue = params.allowFromClue ?? false;
  const requestId = params.requestId;
  const doAutoDeal = params.autoDeal === true;
  const syncTs = Date.now();
  let prevStatus: RoomDoc["status"] | null = null;

  const lockHolder = `start:${requestId}`;
  const locked = await acquireRoomLock(params.roomId, lockHolder);
  if (!locked) {
    traceAction("room.start.locked", {
      roomId: params.roomId,
      requestId,
      holder: lockHolder,
    });
    throw codedError("rate_limited", "rate_limited");
  }

  let roundPreparingActivated = false;
  try {
    // Start/NextGame 時の体感遅延（複数API呼び出し＋ガード）を避けるため、
    // server-authoritative な start command 内で roundPreparing を制御する。
    try {
      await roomRef.update({
        "ui.roundPreparing": true,
        lastActiveAt: FieldValue.serverTimestamp() as unknown as RoomDoc["lastActiveAt"],
      });
      roundPreparingActivated = true;
    } catch (error) {
      traceError("ui.roundPreparing.start.begin", error, { roomId: params.roomId });
    }

    const playersSnap = await roomRef.collection("players").get();

    const preparedDeal = doAutoDeal
      ? await prepareStartGameAutoDeal({
          roomId: params.roomId,
          roomForAuth,
          playersSnap,
          topicType: params.topicType,
          customTopic: params.customTopic,
          presenceUids: params.presenceUids ?? null,
        })
      : null;

    const txResult = await runStartGameTransaction({
      db,
      roomRef,
      playersSnap,
      uid,
      requestId,
      allowFromFinished,
      allowFromClue,
      doAutoDeal,
      preparedDeal,
    });
    prevStatus = txResult.prevStatus;

    await auditStartGame({
      roomId: params.roomId,
      uid,
      requestId,
      prevStatus: txResult.prevStatus,
      allowFromFinished,
      allowFromClue,
      doAutoDeal,
      alreadyStarted: txResult.alreadyStarted,
    });

    return publishStartGameSync({
      roomId: params.roomId,
      statusVersion: txResult.nextStatusVersion,
      requestId,
      ts: syncTs,
      topic: txResult.syncTopic,
      topicBox: txResult.syncTopicBox,
    });
  } catch (error) {
    try {
      const failureSnap = await roomRef.get();
      const failureRoom = failureSnap.exists ? (failureSnap.data() as RoomDoc) : undefined;
      traceError("room.start.server.failure", error, {
        roomId: params.roomId,
        requestId,
        prevStatus,
        status: failureRoom?.status ?? null,
        roundPreparing: failureRoom?.ui?.roundPreparing ?? null,
        startRequestId: failureRoom?.startRequestId ?? null,
        locked: locked ? "1" : "0",
      });
    } catch (detailError) {
      traceError("room.start.server.failure.detail", detailError, { roomId: params.roomId, requestId });
    }
    throw error;
  } finally {
    if (roundPreparingActivated) {
      const cleared = await clearRoundPreparingWithRetry({
        roomRef,
        roomId: params.roomId,
        context: "startGameCommand",
      });
      if (cleared) {
        roundPreparingActivated = false;
      }
    }
    await releaseLockSafely(params.roomId, lockHolder);
  }
}
