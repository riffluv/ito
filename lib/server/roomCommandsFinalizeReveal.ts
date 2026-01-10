import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/server/firebaseAdmin";
import type { RoomDoc } from "@/lib/types";
import { traceAction } from "@/lib/utils/trace";
import { codedError } from "@/lib/server/roomCommandShared";
import { verifyViewerIdentity } from "@/lib/server/roomCommandAuth";
import { canFinalizeReveal, deriveRoundPlayersForFinalize } from "@/lib/server/roomCommandsFinalizeReveal/helpers";

export async function finalizeRevealCommand(params: { token: string; roomId: string }) {
  const uid = await verifyViewerIdentity(params.token);
  const db = getAdminDb();
  const roomRef = db.collection("rooms").doc(params.roomId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists) throw codedError("room_not_found", "room_not_found");
    const room = snap.data() as RoomDoc;
    // reveal→finished は「決定処理」ではなく演出完了の合図なので、
    // ホストが離脱しても詰まらないよう「ラウンド参加者」からの finalize を許可する。
    // ただし、無関係な第三者の悪用を避けるため参加者 or ホスト/作成者に限定する。
    const roundPlayers = deriveRoundPlayersForFinalize(room);
    if (!canFinalizeReveal({ uid, room, roundPlayers })) {
      throw codedError("forbidden", "forbidden", "host_only");
    }
    if (room.status !== "reveal") return;
    tx.update(roomRef, {
      status: "finished",
      lastActiveAt: FieldValue.serverTimestamp(),
      statusVersion: FieldValue.increment(1) as unknown as number,
    });
  });

  traceAction("reveal.finalize.server", { roomId: params.roomId, uid });
}
