import { FieldValue } from "firebase-admin/firestore";
import { buildPlayOutcomePayload } from "@/lib/game/domain";
import type { OrderState } from "@/lib/game/rules";
import { toMillis } from "@/lib/time";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { getAdminDb } from "@/lib/server/firebaseAdmin";
import { codedError } from "@/lib/server/roomCommandShared";
import { verifyViewerIdentity } from "@/lib/server/roomCommandAuth";
import {
  buildCurrentOrderState,
  deriveAllowContinue,
  deriveRoundPlayers,
  deriveRoundTotal,
  isPlayerMismatch,
} from "@/lib/server/roomCommandsCommitPlay/helpers";

export async function commitPlayFromClueCommand(params: { token: string; roomId: string; playerId: string }) {
  const uid = await verifyViewerIdentity(params.token);
  if (isPlayerMismatch({ uid, playerId: params.playerId })) {
    throw codedError("forbidden", "forbidden", "player_mismatch");
  }
  const db = getAdminDb();
  const roomRef = db.collection("rooms").doc(params.roomId);
  const meRef = roomRef.collection("players").doc(params.playerId);

  await db.runTransaction(async (tx) => {
    const roomSnap = await tx.get(roomRef);
    if (!roomSnap.exists) throw codedError("room_not_found", "room_not_found");
    const room = roomSnap.data() as RoomDoc;
    if (room.status !== "clue") return;
    const allowContinue = deriveAllowContinue(room);

    const meSnap = await tx.get(meRef);
    if (!meSnap.exists) throw codedError("forbidden", "forbidden", "player_not_found");
    const me = meSnap.data() as PlayerDoc | undefined;
    const myNum = typeof me?.number === "number" ? me.number : null;
    if (typeof myNum !== "number") throw codedError("forbidden", "forbidden", "number_not_set");

    const roundPlayers = deriveRoundPlayers(room);
    const roundTotal = deriveRoundTotal(roundPlayers);
    const decidedAtSource = (room?.order as { decidedAt?: unknown } | undefined)?.decidedAt ?? null;
    const decidedAtMs = toMillis(
      decidedAtSource as unknown as number | FirebaseFirestore.Timestamp | FieldValue | Date | null | undefined
    );
    const currentOrder: OrderState = buildCurrentOrderState({
      room,
      decidedAtMs,
      nowMs: Date.now(),
      roundTotal,
    });

    if (currentOrder.list.includes(params.playerId)) return;
    if (roundPlayers && !roundPlayers.includes(params.playerId)) return;

    const playResult = buildPlayOutcomePayload({
      currentOrder,
      playerId: params.playerId,
      myNum,
      total: roundTotal ?? currentOrder.total,
      presenceCount: null,
      allowContinue,
      previousStats: room?.stats,
      decidedAt: decidedAtMs,
    });

    if (playResult.shouldFinish && playResult.payload) {
      tx.update(roomRef, {
        status: "reveal",
        order: playResult.payload.order,
        result: {
          success: playResult.payload.success,
          failedAt: playResult.payload.order.failedAt ?? null,
          lastNumber: playResult.payload.order.lastNumber ?? null,
          revealedAt: FieldValue.serverTimestamp(),
        },
        stats: playResult.payload.stats,
        lastActiveAt: FieldValue.serverTimestamp(),
        statusVersion: FieldValue.increment(1) as unknown as number,
      });
      return;
    }

    tx.update(roomRef, {
      order: playResult.next,
      lastActiveAt: FieldValue.serverTimestamp(),
      statusVersion: FieldValue.increment(1) as unknown as number,
    });
  });
}
