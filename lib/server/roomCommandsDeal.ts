import { FieldValue } from "firebase-admin/firestore";

import { getAdminDb } from "@/lib/server/firebaseAdmin";
import { acquireRoomLock } from "@/lib/server/roomQueue";
import { logRoomCommandAudit } from "@/lib/server/roomAudit";
import { buildDealPayload, selectDealTargetPlayers } from "@/lib/game/domain";
import { generateDeterministicNumbers } from "@/lib/game/random";
import { toMillis } from "@/lib/time";
import { traceAction, traceError } from "@/lib/utils/trace";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import {
  codedError,
  fetchPresenceUids,
  releaseLockSafely,
} from "@/lib/server/roomCommandShared";
import { verifyHostIdentity } from "@/lib/server/roomCommandAuth";
import {
  canBypassDealRateLimit,
  countEligibleUids,
  deriveIsFirstDeal,
  getExistingDealCount,
  maybeFallbackDealTarget,
  shouldReturnIdempotentDealCount,
  sortDealCandidates,
} from "@/lib/server/roomCommandsDeal/helpers";

type WithAuth = { token: string };

export async function dealNumbersCommand(params: {
  token: string;
  roomId: string;
  skipPresence?: boolean;
  requestId: string;
  sessionId?: string;
  presenceUids?: string[] | null;
} & WithAuth): Promise<number> {
  const db = getAdminDb();
  const roomRef = db.collection("rooms").doc(params.roomId);
  const roomSnap = await roomRef.get();
  if (!roomSnap.exists) throw codedError("room_not_found", "room_not_found");
  const room = roomSnap.data() as RoomDoc | undefined;
  const uid = await verifyHostIdentity(
    room,
    params.token,
    params.roomId,
    params.sessionId ?? undefined
  );
  if (room?.hostId && room.hostId !== uid) {
    throw codedError("forbidden", "forbidden", "host_only");
  }

  // 状態チェック: clue または waiting（配り直しもここで扱う）
  const currentStatus = room?.status ?? "waiting";
  if (currentStatus !== "clue" && currentStatus !== "waiting") {
    throw codedError("invalid_status", "invalid_status");
  }

  const rateLimitMs = 700;
  const lastMs = room?.lastCommandAt ? toMillis(room.lastCommandAt) : null;
  // Idempotent: 同じ requestId で既に配札済みなら成功扱い
  const existingDealCount = getExistingDealCount(room);
  const idempotent = shouldReturnIdempotentDealCount({
    dealRequestId: typeof room?.dealRequestId === "string" ? room.dealRequestId : null,
    requestId: params.requestId,
    existingDealCount,
  });
  if (idempotent !== null) return idempotent;

  // allow the very first deal right after start without waiting,
  // so quickStart/start -> deal のシーケンスが 700ms 未満でも失敗しない
  const existingNumbers =
    room && typeof room.deal === "object" && room.deal
      ? (room.deal as { numbers?: Record<string, unknown> | undefined }).numbers
      : undefined;
  const isFirstDeal = deriveIsFirstDeal(existingNumbers);
  const canBypassRateLimit = canBypassDealRateLimit({
    isFirstDeal,
    status: room?.status ?? null,
  });

  if (!canBypassRateLimit && lastMs !== null && Date.now() - lastMs < rateLimitMs) {
    throw codedError("rate_limited", "rate_limited");
  }
  const lockHolder = `deal:${params.requestId}`;
  const locked = await acquireRoomLock(params.roomId, lockHolder);
  if (!locked) {
    throw codedError("rate_limited", "rate_limited");
  }

  try {
    const seed = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const min = 1;
    const max = 100;

    const playersSnap = await roomRef.collection("players").get();
    const now = Date.now();
    const presenceUids =
      params.presenceUids ??
      (params.skipPresence ? null : await fetchPresenceUids(params.roomId));
    const candidates = playersSnap.docs.map((d) => {
      const data = d.data() as PlayerDoc | undefined;
      const lastSeenRaw = (data as { lastSeen?: unknown })?.lastSeen;
      const lastSeen = (lastSeenRaw ?? null) as
        | number
        | FirebaseFirestore.Timestamp
        | Date
        | null;
      return {
        id: d.id,
        uid: typeof data?.uid === "string" ? data.uid : undefined,
        lastSeen,
      } as const;
    });

    const target = selectDealTargetPlayers(candidates, presenceUids, now);
    const eligibleCount = countEligibleUids(candidates);
    const ordered = maybeFallbackDealTarget({
      ordered: sortDealCandidates(target),
      candidates,
      eligibleCount,
    });

    const playerIds = ordered.map((p) => p.id);
    const generatedNumbers = generateDeterministicNumbers(
      playerIds.length,
      min,
      max,
      seed
    );
    const dealPayload = buildDealPayload(playerIds, seed, min, max, generatedNumbers);

    // Atomic: room + players must be updated together to avoid "dealt on room doc, but players missing numbers".
    try {
      const batch = db.batch();
      batch.update(roomRef, {
        deal: dealPayload,
        "order.total": ordered.length,
        "order.numbers": dealPayload.numbers,
        "order.list": [],
        "order.proposal": [],
        dealRequestId: params.requestId,
        lastActiveAt: FieldValue.serverTimestamp(),
        lastCommandAt: FieldValue.serverTimestamp(),
        statusVersion: FieldValue.increment(1) as unknown as number,
      });

      playersSnap.forEach((doc) => {
        const pid = doc.id;
        const seatIndex =
          typeof dealPayload.seatHistory?.[pid] === "number"
            ? dealPayload.seatHistory[pid]!
            : 0;
        batch.update(doc.ref, {
          number: dealPayload.numbers[pid] ?? null,
          clue1: "",
          ready: false,
          orderIndex: seatIndex,
          lastSeen: FieldValue.serverTimestamp(),
        } satisfies Partial<PlayerDoc>);
      });

      batch.set(
        db.collection("roomProposals").doc(params.roomId),
        {
          proposal: [],
          seed,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      await batch.commit();
    } catch (error) {
      traceError("deal.batch.commit", error, {
        roomId: params.roomId,
        requestId: params.requestId,
      });
      throw error;
    }

    traceAction("deal.end", {
      roomId: params.roomId,
      count: ordered.length,
      eligibleCount,
      requestId: params.requestId,
      redeal: isFirstDeal ? "0" : "1",
      prevStatus: room?.status ?? null,
      nextStatus: room?.status ?? null,
    });
    void logRoomCommandAudit({
      roomId: params.roomId,
      uid,
      requestId: params.requestId,
      command: "deal",
      prevStatus: room?.status ?? null,
      nextStatus: room?.status ?? null,
      note: `count:${ordered.length},redeal:${isFirstDeal ? "0" : "1"}`,
    });

    return ordered.length;
  } finally {
    await releaseLockSafely(params.roomId, lockHolder);
  }
}
