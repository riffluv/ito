import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/server/firebaseAdmin";
import {
  normalizeProposalCompact,
  validateSubmitList,
  buildRevealOutcomePayload,
} from "@/lib/game/domain";
import type { RoomDoc } from "@/lib/types";
import { traceAction } from "@/lib/utils/trace";
import { codedError } from "@/lib/server/roomCommandShared";
import { verifyViewerIdentity } from "@/lib/server/roomCommandAuth";

type WithAuth = { token: string };

export type SubmitOrderParams = WithAuth & {
  roomId: string;
  list: string[];
};

export async function submitOrder(params: SubmitOrderParams) {
  const uid = await verifyViewerIdentity(params.token);
  const db = getAdminDb();
  const roomRef = db.collection("rooms").doc(params.roomId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists) throw codedError("room_not_found", "room_not_found");
    const room = snap.data() as RoomDoc;
    if (room.status !== "clue") {
      throw codedError("invalid_status", "invalid_status");
    }
    if (room.hostId && room.hostId !== uid) throw codedError("forbidden", "forbidden", "host_only");
    const order = room.order ?? { total: params.list.length };
    const validation = validateSubmitList(params.list, room.deal?.players ?? null, order.total ?? params.list.length);
    if (!validation.ok) {
      throw codedError("invalid_payload", "invalid_payload", validation.error);
    }
    const normalizedList = normalizeProposalCompact(params.list, validation.expected).filter(
      (value): value is string => typeof value === "string"
    );
    const numbersSource =
      room.order && (room.order as { numbers?: Record<string, unknown> | undefined }).numbers &&
      Object.keys((room.order as { numbers?: Record<string, unknown> }).numbers ?? {}).length > 0
        ? (room.order as { numbers?: Record<string, number | null | undefined> }).numbers
        : (room.deal as { numbers?: Record<string, number | null | undefined> } | undefined)?.numbers ?? {};

    const revealOutcome = buildRevealOutcomePayload({
      list: normalizedList,
      numbers: numbersSource as Record<string, number | null | undefined>,
      expectedTotal: validation.expected,
      previousStats: room.stats,
    });
    const serverNow = FieldValue.serverTimestamp();
    tx.update(roomRef, {
      order: {
        ...(room.order ?? {}),
        ...revealOutcome.order,
        decidedAt: serverNow,
      },
      status: "reveal",
      "ui.revealPending": true,
      "ui.revealBeginAt": serverNow,
      result: {
        success: revealOutcome.success,
        failedAt: revealOutcome.order.failedAt ?? null,
        lastNumber: revealOutcome.order.lastNumber ?? null,
        revealedAt: serverNow,
      },
      stats: revealOutcome.stats,
      lastActiveAt: serverNow,
      statusVersion: FieldValue.increment(1) as unknown as number,
    });
  });
  traceAction("order.submit.server", { roomId: params.roomId, uid, size: params.list.length });
}

