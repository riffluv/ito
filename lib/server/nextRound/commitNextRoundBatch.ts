import { FieldValue } from "firebase-admin/firestore";
import type { DealPayload } from "@/lib/game/domain";
import type { OrderState } from "@/lib/game/rules";
import type { PlayerDoc } from "@/lib/types";
import { traceError } from "@/lib/utils/trace";

export async function commitNextRoundBatch(params: {
  db: FirebaseFirestore.Firestore;
  roomRef: FirebaseFirestore.DocumentReference;
  roomId: string;
  requestId: string;
  nextRound: number;
  nextStatusVersion: number;
  topic: string | null;
  topicBox: string | null;
  seed: string;
  dealPayload: DealPayload;
  orderedCount: number;
  playersSnap: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>;
}): Promise<void> {
  // room を更新（アトミックに全てを設定）
  const roomUpdate: Record<string, unknown> = {
    status: "clue",
    round: params.nextRound,
    topic: params.topic,
    topicBox: params.topicBox,
    topicOptions: null,
    deal: params.dealPayload,
    order: {
      list: [],
      lastNumber: null,
      failed: false,
      failedAt: null,
      total: params.orderedCount,
    } satisfies OrderState,
    result: null,
    mvpVotes: {},
    lastActiveAt: FieldValue.serverTimestamp(),
    startRequestId: params.requestId,
    nextRequestId: params.requestId,
    dealRequestId: params.requestId,
    lastCommandAt: FieldValue.serverTimestamp(),
    statusVersion: params.nextStatusVersion,
    "ui.roundPreparing": false,
    "ui.recallOpen": false,
    "ui.revealPending": false,
  };

  // Atomic: room + players must move together to avoid "new round started, but some players still have old numbers/clues".
  try {
    const batch = params.db.batch();
    batch.update(params.roomRef, roomUpdate);

    params.playersSnap.forEach((docSnap) => {
      const pid = docSnap.id;
      const seatIndex =
        typeof params.dealPayload?.seatHistory?.[pid] === "number"
          ? (params.dealPayload.seatHistory[pid] as number)
          : 0;
      batch.update(docSnap.ref, {
        number: params.dealPayload?.numbers?.[pid] ?? null,
        clue1: "",
        ready: false,
        orderIndex: seatIndex,
        lastSeen: FieldValue.serverTimestamp(),
      } satisfies Partial<PlayerDoc>);
    });

    batch.set(
      params.db.collection("roomProposals").doc(params.roomId),
      {
        proposal: [],
        seed: params.seed,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await batch.commit();
  } catch (error) {
    traceError("room.nextRound.batch.commit", error, {
      roomId: params.roomId,
      requestId: params.requestId,
    });
    throw error;
  }
}
