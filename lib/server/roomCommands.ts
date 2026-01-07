import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/server/firebaseAdmin";
import { APP_VERSION } from "@/lib/constants/appVersion";
import { getAvatarByOrder } from "@/lib/utils";
import { generateRoomId } from "@/lib/utils/roomId";
import {
  createInitialRoomStats,
  normalizeProposalCompact,
  validateSubmitList,
  buildDealPayload,
  selectDealTargetPlayers,
  buildRevealOutcomePayload,
} from "@/lib/game/domain";
import { acquireRoomLock } from "@/lib/server/roomQueue";
import { leaveRoomServer } from "@/lib/server/roomActions";
import { buildRoomSyncPatch, publishRoomSyncPatch } from "@/lib/server/roomSync";
import { logRoomCommandAudit } from "@/lib/server/roomAudit";
import { traceAction, traceError } from "@/lib/utils/trace";
import type { RoomDoc, PlayerDoc } from "@/lib/types";
import { normalizeVersion } from "@/lib/server/roomVersionGate";
import type { RoomSyncPatch } from "@/lib/sync/roomSyncPatch";
import { generateDeterministicNumbers } from "@/lib/game/random";
import { toMillis } from "@/lib/time";
import { pickOne, type TopicType } from "@/lib/topics";
import {
  clearRoundPreparingWithRetry,
  codedError,
  fetchPresenceUids,
  isTopicTypeValue,
  loadTopicSectionsFromFs,
  releaseLockSafely,
  safeTraceAction,
  sanitizeClue,
  sanitizeName,
  sanitizeTopicText,
} from "@/lib/server/roomCommandShared";
import {
  ensurePlayerDoc,
  verifyHostIdentity,
  verifyViewerIdentity,
} from "@/lib/server/roomCommandAuth";
type WithAuth = { token: string };

export type CreateRoomParams = WithAuth & {
  roomName: string;
  displayName: string;
  displayMode?: string | null;
  options?: RoomDoc["options"];
  passwordHash?: string | null;
  passwordSalt?: string | null;
  passwordVersion?: number | null;
};

export type JoinRoomParams = WithAuth & {
  roomId: string;
  displayName: string | null;
};

export type LeaveRoomParams = WithAuth & {
  roomId: string;
  uid: string;
  displayName?: string | null;
};

export type UpdateReadyParams = WithAuth & {
  roomId: string;
  ready: boolean;
};

export type SubmitClueParams = WithAuth & {
  roomId: string;
  clue: string;
};

export type SubmitOrderParams = WithAuth & {
  roomId: string;
  list: string[];
};

export { resetRoomCommand } from "./roomCommandsReset";
export { dealNumbersCommand } from "./roomCommandsDeal";
export {
  nextRoundCommand,
  type NextRoundParams,
  type NextRoundResult,
} from "./roomCommandsNextRound";
export { topicCommand } from "./roomCommandsTopic";
export { mutateProposal } from "./roomCommandsProposal";
export { commitPlayFromClueCommand } from "./roomCommandsCommitPlay";
export { continueAfterFailCommand } from "./roomCommandsContinueAfterFail";
export { setRevealPendingCommand } from "./roomCommandsRevealPending";
export { setRoundPreparingCommand } from "./roomCommandsRoundPreparing";
export { finalizeRevealCommand } from "./roomCommandsFinalizeReveal";
export { pruneProposalCommand } from "./roomCommandsPruneProposal";
export { updateRoomOptionsCommand } from "./roomCommandsRoomOptions";
export { castMvpVoteCommand } from "./roomCommandsMvpVote";

export async function createRoom(params: CreateRoomParams): Promise<{ roomId: string; appVersion: string }> {
  const uid = await verifyViewerIdentity(params.token);
  const roomName = sanitizeName(params.roomName);
  const displayName = sanitizeName(params.displayName || "匿名");
  const db = getAdminDb();
  const createdAt = FieldValue.serverTimestamp() as unknown as Timestamp;
  const lastActiveAt = FieldValue.serverTimestamp() as unknown as Timestamp;

  const basePayload = {
    name: roomName,
    hostId: uid,
    hostName: displayName,
    creatorId: uid,
    creatorName: displayName,
    appVersion: normalizeVersion(APP_VERSION) ?? APP_VERSION,
    options: params.options ?? {},
    status: "waiting",
    createdAt,
    lastActiveAt,
    closedAt: null,
    expiresAt: Timestamp.fromDate(new Date(Date.now() + 12 * 60 * 60 * 1000)),
    topic: null,
    topicOptions: null,
    topicBox: null,
    result: null,
    stats: createInitialRoomStats(),
    requiresPassword: !!params.passwordHash,
    passwordHash: params.passwordHash ?? null,
    passwordSalt: params.passwordSalt ?? null,
    passwordVersion: params.passwordVersion ?? null,
    deal: null,
    order: null,
    mvpVotes: {},
    round: 0,
    ui: { recallOpen: true },
    statusVersion: 0,
  } as unknown as RoomDoc & { createdAt: Timestamp; lastActiveAt: Timestamp };

  const MAX_ATTEMPTS = 8;
  let roomId: string | null = null;
  for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
    const candidate = generateRoomId();
    const ref = db.collection("rooms").doc(candidate);
    const existing = await ref.get();
    if (existing.exists) continue;
    await ref.set(basePayload);
    await ref.collection("players").doc(uid).set({
      name: displayName,
      avatar: getAvatarByOrder(0),
      number: null,
      clue1: "",
      ready: false,
      orderIndex: 0,
      uid,
      lastSeen: FieldValue.serverTimestamp(),
      joinedAt: FieldValue.serverTimestamp(),
    } satisfies PlayerDoc);
    roomId = candidate;
    break;
  }

  if (!roomId) {
    throw codedError("room_id_allocation_failed", "room_id_allocation_failed");
  }

  safeTraceAction("room.create.server", { roomId, uid });
  return { roomId, appVersion: basePayload.appVersion ?? APP_VERSION };
}

export async function joinRoom(params: JoinRoomParams) {
  const uid = await verifyViewerIdentity(params.token);
  const { roomId } = params;
  const db = getAdminDb();
  const roomRef = db.collection("rooms").doc(roomId);
  const roomSnap = await roomRef.get();
  if (!roomSnap.exists) {
    throw codedError("room_not_found", "room_not_found");
  }
  const room = roomSnap.data() as RoomDoc | undefined;
  const status = room?.status ?? "waiting";
  const recallOpen = room?.ui?.recallOpen ?? true;
  const hostId = room?.hostId ?? null;

  const dealPlayers = Array.isArray(room?.deal?.players) ? room!.deal!.players : [];
  const seatHistory =
    room?.deal && typeof room.deal === "object" && "seatHistory" in room.deal
      ? ((room.deal as { seatHistory?: Record<string, number> }).seatHistory ?? {})
      : {};
  const orderList = Array.isArray(room?.order?.list) ? room!.order!.list : [];
  const orderProposal = Array.isArray(room?.order?.proposal) ? room!.order!.proposal : [];
  const wasSeated =
    dealPlayers.includes(uid) ||
    typeof seatHistory?.[uid] === "number" ||
    orderList.includes(uid) ||
    orderProposal.includes(uid);

  const isHost = hostId === uid;

  if (!isHost && status !== "waiting" && !wasSeated) {
    throw codedError("in_progress", "room_in_progress");
  }

  if (!isHost && status === "waiting" && recallOpen === false && !wasSeated) {
    throw codedError("recall_closed", "room_recall_closed");
  }

  const result = await ensurePlayerDoc({
    roomId,
    uid,
    displayName: params.displayName,
  });

  await roomRef.update({
    lastActiveAt: FieldValue.serverTimestamp(),
  });

  traceAction("room.join.server", { roomId, uid, joined: result.joined });

  if (result.joined) {
    try {
      await roomRef.collection("chat").add({
        sender: "system",
        text: `${sanitizeName(params.displayName ?? "匿名")} さんが参加しました`,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch {}
  }

  return result;
}

export async function leaveRoom(params: LeaveRoomParams) {
  const uid = await verifyViewerIdentity(params.token);
  if (uid !== params.uid) {
    throw codedError("forbidden", "forbidden", "uid_mismatch");
  }

  await leaveRoomServer(params.roomId, uid, params.displayName ?? null);
  traceAction("room.leave.server", { roomId: params.roomId, uid });
}

export async function updateReady(params: UpdateReadyParams) {
  const uid = await verifyViewerIdentity(params.token);
  const db = getAdminDb();
  await db
    .collection("rooms")
    .doc(params.roomId)
    .collection("players")
    .doc(uid)
    .update({ ready: params.ready, lastSeen: FieldValue.serverTimestamp() });
  traceAction("player.ready.server", { roomId: params.roomId, uid, ready: params.ready });
}

export async function submitClue(params: SubmitClueParams) {
  const uid = await verifyViewerIdentity(params.token);
  const clue = sanitizeClue(params.clue);
  const db = getAdminDb();
  await db
    .collection("rooms")
    .doc(params.roomId)
    .collection("players")
    .doc(uid)
    .update({
      clue1: clue,
      ready: true,
      lastSeen: FieldValue.serverTimestamp(),
    });
  traceAction("clue.submit.server", { roomId: params.roomId, uid });
}

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
  let alreadyStarted = false;
  const rateLimitMs = 700;
  let prevStatus: RoomDoc["status"] | null = null;
  let nextStatusVersion = 0;
  let syncTopic: string | null | undefined = undefined;
  let syncTopicBox: RoomDoc["topicBox"] | null | undefined = undefined;
  const doAutoDeal = params.autoDeal === true;
  const syncTs = Date.now();

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

    // 事前にプレイヤー情報・トピック・配札を用意（autoDeal時のみ） - ロック取得後に行う
    let preparedDeal:
      | {
          dealPayload: ReturnType<typeof buildDealPayload>;
          orderedPlayers: { id: string; uid?: string }[];
          topic: string | null;
          topicBox: TopicType | "カスタム" | null;
        }
      | null = null;

    if (doAutoDeal) {
      const now = Date.now();
      const presenceUids = params.presenceUids ?? (await fetchPresenceUids(params.roomId));
      const candidates = playersSnap.docs.map((d) => {
        const data = d.data() as PlayerDoc | undefined;
        const lastSeenRaw = (data as { lastSeen?: unknown })?.lastSeen;
        const lastSeen = (lastSeenRaw ?? null) as number | FirebaseFirestore.Timestamp | Date | null;
        return {
          id: d.id,
          uid: typeof data?.uid === "string" ? data.uid : undefined,
          lastSeen,
        } as const;
      });
      const target = selectDealTargetPlayers(candidates, presenceUids, now);
      let ordered = [...target].sort((a, b) => String(a.uid || a.id).localeCompare(String(b.uid || b.id)));
      const eligibleCount = candidates.filter((c) => typeof c.uid === "string" && c.uid.trim().length > 0).length;
      const suspectedMismatch = eligibleCount > 1 && ordered.length <= 1;
      if (suspectedMismatch) {
        const fallbackOrdered = [...candidates].sort((a, b) => String(a.uid || a.id).localeCompare(String(b.uid || b.id)));
        if (fallbackOrdered.length > ordered.length) {
          ordered = fallbackOrdered;
        }
      }
      if (ordered.length === 0) {
        throw codedError("no_players", "no_players", "no_eligible_players");
      }

      // topic 決定（nextRound と同等のロジックを流用）
      const sections = await loadTopicSectionsFromFs();
      const requestedTopicType = params.topicType ?? roomForAuth?.options?.defaultTopicType ?? "通常版";
      const normalizedTopicType =
        typeof requestedTopicType === "string" && isTopicTypeValue(requestedTopicType)
          ? (requestedTopicType as TopicType)
          : ("通常版" as TopicType);

      let topic: string | null = null;
      let topicBox: TopicType | "カスタム" | null =
        (roomForAuth?.topicBox as TopicType | "カスタム" | null | undefined) ?? normalizedTopicType;

      if (topicBox === "カスタム") {
        const customText = params.customTopic ? sanitizeTopicText(params.customTopic) : null;
        if (customText && customText.trim().length > 0) {
          topic = customText;
          topicBox = "カスタム";
        } else if (roomForAuth?.topic && String(roomForAuth.topicBox) === "カスタム") {
          topic = roomForAuth.topic;
          topicBox = "カスタム";
        } else {
          const pool = sections.normal;
          topic = pickOne(pool) || null;
          topicBox = "通常版";
        }
      } else {
        const pool =
          normalizedTopicType === "通常版"
            ? sections.normal
            : normalizedTopicType === "レインボー版"
              ? sections.rainbow
              : sections.classic;
        topic = pickOne(pool) || null;
      }

      const seed = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const min = 1;
      const max = 100;
      const playerIds = ordered.map((p) => p.id);
      const generatedNumbers = generateDeterministicNumbers(playerIds.length, min, max, seed);
      const dealPayload = buildDealPayload(playerIds, seed, min, max, generatedNumbers);

      preparedDeal = {
        dealPayload,
        orderedPlayers: ordered,
        topic,
        topicBox,
      };
    }

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists) {
        throw codedError("room_not_found", "room_not_found");
      }
      const room = snap.data() as RoomDoc;
      prevStatus = room.status ?? null;
      const currentStatusVersion = typeof room.statusVersion === "number" ? room.statusVersion : 0;

      // Idempotent: 同じ requestId で既に clue になっていれば成功扱いで何もしない
      if (room.startRequestId && room.startRequestId === requestId && room.status === "clue") {
        alreadyStarted = true;
        nextStatusVersion = currentStatusVersion;
        syncTopic = room.topic ?? null;
        syncTopicBox = (room.topicBox as RoomDoc["topicBox"] | null | undefined) ?? null;
        return;
      }

      // Rate limit (per room): 拒否してクライアントにリトライさせる
      const lastMs = toMillis(room.lastCommandAt);
      const nowMs = Date.now();
      const existingNumbers =
        room && typeof room.deal === "object" && room.deal
          ? (room.deal as { numbers?: Record<string, unknown> | undefined }).numbers
          : undefined;
      const isFreshWaiting =
        (room.status === "waiting" || room.status === "reveal" || room.status === "finished") &&
        (!existingNumbers || Object.keys(existingNumbers).length === 0);
      const canBypassRateLimit = isFreshWaiting;
      if (!canBypassRateLimit && lastMs !== null && nowMs - lastMs < rateLimitMs) {
        throw codedError("rate_limited", "rate_limited");
      }

      // allowFromFinished が true の場合、reveal/finished 状態からも開始可能
      // これにより「次のゲーム」ボタン押下時のレース条件を解消
      // allowFromClue が true の場合、clue 状態からも開始可能（リトライ時のレース条件対策）
      const validStatuses: RoomDoc["status"][] = ["waiting"];
      if (allowFromFinished) {
        validStatuses.push("reveal", "finished");
      }
      if (allowFromClue) {
        validStatuses.push("clue");
      }

      if (!validStatuses.includes(room.status)) {
        throw codedError("invalid_status", "invalid_status", `status_is_${room.status}`);
      }
      if (room.hostId && room.hostId !== uid) {
        throw codedError("forbidden", "forbidden", "host_only");
      }
      nextStatusVersion = currentStatusVersion + 1;
      const payload: Partial<RoomDoc> = {
        status: "clue",
        result: null,
        deal: doAutoDeal && preparedDeal ? preparedDeal.dealPayload : null,
        order: doAutoDeal && preparedDeal
          ? {
              list: [],
              lastNumber: null,
              failed: false,
              failedAt: null,
              total: preparedDeal.orderedPlayers.length,
              numbers: preparedDeal.dealPayload.numbers,
            }
          : null,
        mvpVotes: {},
        lastActiveAt: FieldValue.serverTimestamp() as unknown as RoomDoc["lastActiveAt"],
        ui: { ...(room.ui ?? {}), recallOpen: false, roundPreparing: false, revealPending: false },
        startRequestId: requestId,
        dealRequestId: doAutoDeal && preparedDeal ? requestId : room.dealRequestId ?? null,
        lastCommandAt: FieldValue.serverTimestamp() as unknown as RoomDoc["lastCommandAt"],
        statusVersion: nextStatusVersion,
      };

      if (doAutoDeal && preparedDeal) {
        payload.topic = preparedDeal.topic;
        payload.topicBox = preparedDeal.topicBox as RoomDoc["topicBox"] | null;
        payload.topicOptions = null;
        payload.deal = preparedDeal.dealPayload;
        syncTopic = preparedDeal.topic;
        syncTopicBox = (preparedDeal.topicBox as RoomDoc["topicBox"] | null) ?? null;
      } else {
        syncTopic = room.topic ?? null;
        syncTopicBox = (room.topicBox as RoomDoc["topicBox"] | null | undefined) ?? null;
      }

      tx.update(roomRef, payload);

      // Atomic: room + players reset must move together to avoid "room started but players stale".
      playersSnap.forEach((doc) => {
        const pid = doc.id;
        if (doAutoDeal && preparedDeal) {
          const seatIndex =
            typeof preparedDeal.dealPayload.seatHistory?.[pid] === "number"
              ? preparedDeal.dealPayload.seatHistory[pid]!
              : 0;
          tx.update(doc.ref, {
            number: preparedDeal.dealPayload.numbers[pid] ?? null,
            clue1: "",
            ready: false,
            orderIndex: seatIndex,
            lastSeen: FieldValue.serverTimestamp(),
          } satisfies Partial<PlayerDoc>);
        } else {
          tx.update(doc.ref, { number: null, clue1: "", ready: false, orderIndex: 0 });
        }
      });
    });

    if (alreadyStarted) {
      traceAction("host.start.server.idempotent", { roomId: params.roomId, uid, requestId });
      void logRoomCommandAudit({
        roomId: params.roomId,
        uid,
        requestId,
        command: "start",
        prevStatus,
        nextStatus: "clue",
        note: "idempotent",
      });
      const sync = buildRoomSyncPatch({
        roomId: params.roomId,
        statusVersion: nextStatusVersion,
        room: {
          status: "clue",
          topic: syncTopic,
          topicBox: syncTopicBox,
          ui: { roundPreparing: false, recallOpen: false, revealPending: false },
        },
        command: "start",
        requestId,
        source: "api",
        ts: syncTs,
      });
      void publishRoomSyncPatch({
        ...sync,
        meta: { ...sync.meta, source: "rtdb" },
      });
      return sync;
    }

    traceAction("host.start.server", {
      roomId: params.roomId,
      uid,
      requestId,
      allowFromFinished,
      allowFromClue,
      prevStatus,
      nextStatus: "clue",
      autoDeal: doAutoDeal ? "1" : "0",
    });
    void logRoomCommandAudit({
      roomId: params.roomId,
      uid,
      requestId,
      command: "start",
      prevStatus,
      nextStatus: "clue",
      note: doAutoDeal ? "autoDeal" : undefined,
    });

    const sync = buildRoomSyncPatch({
      roomId: params.roomId,
      statusVersion: nextStatusVersion,
      room: {
        status: "clue",
        topic: syncTopic,
        topicBox: syncTopicBox,
        ui: { roundPreparing: false, recallOpen: false, revealPending: false },
      },
      command: "start",
      requestId,
      source: "api",
      ts: syncTs,
    });
    void publishRoomSyncPatch({
      ...sync,
      meta: { ...sync.meta, source: "rtdb" },
    });
    return sync;
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
      (v): v is string => typeof v === "string"
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


export async function updatePlayerProfileCommand(params: {
  token: string;
  roomId: string;
  playerId?: string | null;
  name?: string | null;
  avatar?: string | null;
}) {
  const uid = await verifyViewerIdentity(params.token);
  const targetId = params.playerId && params.playerId.trim().length > 0 ? params.playerId : uid;
  const db = getAdminDb();
  const playerRef = db.collection("rooms").doc(params.roomId).collection("players").doc(targetId);
  const playerSnap = await playerRef.get();
  if (!playerSnap.exists) throw codedError("forbidden", "forbidden", "not_member");
  if (targetId !== uid) {
    const roomSnap = await db.collection("rooms").doc(params.roomId).get();
    const room = roomSnap.data() as RoomDoc | undefined;
    const isHost = !room?.hostId || room.hostId === uid || room?.creatorId === uid;
    if (!isHost) throw codedError("forbidden", "forbidden", "host_only");
  }

  const updates: Partial<PlayerDoc> & Record<string, unknown> = {
    lastSeen: FieldValue.serverTimestamp() as unknown as PlayerDoc["lastSeen"],
  };
  if (typeof params.name === "string" && params.name.trim().length > 0) {
    updates.name = sanitizeName(params.name);
  }
  if (typeof params.avatar === "string" && params.avatar.trim().length > 0) {
    updates.avatar = params.avatar;
  }

  await playerRef.update(updates);
  traceAction("player.profile.update.server", { roomId: params.roomId, uid, targetId });
}

export async function resetPlayerStateCommand(params: { token: string; roomId: string; playerId?: string | null }) {
  const uid = await verifyViewerIdentity(params.token);
  const targetId = params.playerId && params.playerId.trim().length > 0 ? params.playerId : uid;
  const db = getAdminDb();
  const roomRef = db.collection("rooms").doc(params.roomId);
  const playerRef = roomRef.collection("players").doc(targetId);
  const playerSnap = await playerRef.get();
  if (!playerSnap.exists) throw codedError("forbidden", "forbidden", "not_member");

  if (targetId !== uid) {
    const roomSnap = await roomRef.get();
    const room = roomSnap.data() as RoomDoc | undefined;
    const isHost = !room?.hostId || room.hostId === uid || room?.creatorId === uid;
    if (!isHost) throw codedError("forbidden", "forbidden", "host_only");
  }

  await playerRef.update({
    number: null,
    clue1: "",
    ready: false,
    orderIndex: 0,
    lastSeen: FieldValue.serverTimestamp(),
  } as Partial<PlayerDoc>);

  traceAction("player.resetState.server", { roomId: params.roomId, uid, targetId });
}
