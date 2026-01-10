import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/server/firebaseAdmin";
import type { RoomDoc } from "@/lib/types";
import { traceAction } from "@/lib/utils/trace";
import { codedError } from "@/lib/server/roomCommandShared";
import { verifyViewerIdentity } from "@/lib/server/roomCommandAuth";
import { buildEligibleIdSet, filterProposalByEligible } from "@/lib/server/roomCommandsPruneProposal/helpers";

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

    const eligible = buildEligibleIdSet(params.eligibleIds);
    if (eligible.size === 0) return;

    const proposal = room?.order?.proposal;
    const filtered = filterProposalByEligible(proposal, eligible);
    const rawLength = Array.isArray(proposal) ? proposal.length : 0;
    if (filtered.length === rawLength) return;

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
