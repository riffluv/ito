import { FieldValue } from "firebase-admin/firestore";
import { buildPlayOutcomePayload } from "@/lib/game/domain";
import type { OrderState } from "@/lib/game/rules";
import { toMillis } from "@/lib/time";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { getAdminDb } from "@/lib/server/firebaseAdmin";
import { codedError } from "@/lib/server/roomCommandShared";
import { verifyViewerIdentity } from "@/lib/server/roomCommandAuth";

export async function commitPlayFromClueCommand(params: { token: string; roomId: string; playerId: string }) {
  const uid = await verifyViewerIdentity(params.token);
  if (uid !== params.playerId) {
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
    const allowContinue = !!room?.options?.allowContinueAfterFail;

    const meSnap = await tx.get(meRef);
    if (!meSnap.exists) throw codedError("forbidden", "forbidden", "player_not_found");
    const me = meSnap.data() as PlayerDoc | undefined;
    const myNum = typeof me?.number === "number" ? me.number : null;
    if (typeof myNum !== "number") throw codedError("forbidden", "forbidden", "number_not_set");

    const roundPlayers: string[] | null = Array.isArray(room?.deal?.players) ? (room.deal!.players as string[]) : null;
    const roundTotal: number | null = roundPlayers ? roundPlayers.length : null;
    const decidedAtSource = (room?.order as { decidedAt?: unknown } | undefined)?.decidedAt ?? null;
    const decidedAtMs = toMillis(
      decidedAtSource as unknown as number | FirebaseFirestore.Timestamp | FieldValue | Date | null | undefined
    );
    const currentOrder: OrderState = {
      list: Array.isArray(room?.order?.list) ? [...room.order!.list] : [],
      lastNumber: typeof room?.order?.lastNumber === "number" ? room.order.lastNumber : null,
      failed: !!room?.order?.failed,
      failedAt: typeof room?.order?.failedAt === "number" ? room.order.failedAt : null,
      decidedAt: decidedAtMs > 0 ? decidedAtMs : Date.now(),
      total:
        typeof roundTotal === "number"
          ? roundTotal
          : typeof room?.order?.total === "number"
            ? room.order.total
            : undefined,
    } as OrderState;

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

