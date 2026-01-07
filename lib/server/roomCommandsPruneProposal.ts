import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/server/firebaseAdmin";
import type { RoomDoc } from "@/lib/types";
import { traceAction } from "@/lib/utils/trace";
import { codedError } from "@/lib/server/roomCommandShared";
import { verifyViewerIdentity } from "@/lib/server/roomCommandAuth";

export async function pruneProposalCommand(params: { token: string; roomId: string; eligibleIds: string[] }) {
  const uid = await verifyViewerIdentity(params.token);
  const db = getAdminDb();
  const roomRef = db.collection("rooms").doc(params.roomId);
  const proposalRef = db.collection("roomProposals").doc(params.roomId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists) throw codedError("room_not_found", "room_not_found");
    const room = snap.data() as RoomDoc;
    const isHost = !room?.hostId || room.hostId === uid || room?.creatorId === uid;
    if (!isHost) throw codedError("forbidden", "forbidden", "host_only");
    if (room.status !== "clue") return;

    const eligible = new Set((params.eligibleIds ?? []).filter((id) => typeof id === "string" && id.trim().length > 0));
    if (eligible.size === 0) return;

    const proposal = Array.isArray(room?.order?.proposal) ? (room.order!.proposal as (string | null)[]) : [];
    const filtered = proposal.filter((id) => typeof id === "string" && eligible.has(id));
    if (filtered.length === proposal.length) return;

    tx.update(roomRef, {
      "order.proposal": filtered,
      lastActiveAt: FieldValue.serverTimestamp(),
      statusVersion: FieldValue.increment(1) as unknown as number,
    });
    tx.set(
      proposalRef,
      {
        proposal: filtered,
        updatedAt: FieldValue.serverTimestamp(),
        seed: typeof room?.deal?.seed === "string" ? room.deal.seed : null,
      },
      { merge: true }
    );
  });

  traceAction("order.proposal.prune.server", {
    roomId: params.roomId,
    uid,
    eligible: params.eligibleIds?.length ?? 0,
  });
}

