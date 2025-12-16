import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { promises as fs } from "fs";
import path from "path";
import { getAdminAuth, getAdminDb, getAdminRtdb } from "@/lib/server/firebaseAdmin";
import { APP_VERSION } from "@/lib/constants/appVersion";
import { AVATAR_LIST, getAvatarByOrder } from "@/lib/utils";
import { generateRoomId } from "@/lib/utils/roomId";
import {
  createInitialRoomStats,
  normalizeProposalCompact,
  validateSubmitList,
  buildDealPayload,
  normalizeProposal,
  prepareProposalInsert,
  selectDealTargetPlayers,
  buildPlayOutcomePayload,
  buildRevealOutcomePayload,
} from "@/lib/game/domain";
import { acquireRoomLock, releaseRoomLock } from "@/lib/server/roomQueue";
import { composeWaitingResetPayload, leaveRoomServer } from "@/lib/server/roomActions";
import { logRoomCommandAudit } from "@/lib/server/roomAudit";
import { sanitizePlainText } from "@/lib/utils/sanitize";
import { traceAction, traceError } from "@/lib/utils/trace";
import type { RoomDoc, PlayerDoc } from "@/lib/types";
import { normalizeVersion } from "@/lib/server/roomVersionGate";
import type { OrderState } from "@/lib/game/rules";
import { generateDeterministicNumbers } from "@/lib/game/random";
import { toMillis } from "@/lib/time";
import {
  parseItoWordMarkdown,
  pickOne,
  topicTypeLabels,
  type TopicSections,
  type TopicType,
} from "@/lib/topics";
import { verifyHostSession } from "@/lib/server/hostToken";
type WithAuth = { token: string };
type CodedError = Error & { code?: string; reason?: string };

const codedError = (message: string, code: string, reason?: string): CodedError => {
  const err = new Error(message) as CodedError;
  err.code = code;
  if (reason) err.reason = reason;
  return err;
};

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

type ProposalAction = "add" | "remove" | "move";

const sanitizeName = (value: string) => sanitizePlainText(value).slice(0, 24);

const sanitizeClue = (value: string) => sanitizePlainText(value).slice(0, 120);

const sanitizeTopicText = (value: string) => sanitizePlainText(value).slice(0, 240);

const safeTraceAction = (name: string, detail?: Record<string, unknown>) => {
  try {
    traceAction(name, detail);
  } catch {
    // swallow tracing failures on the server to avoid impacting API responses
  }
};

const releaseLockSafely = async (roomId: string, holder: string) => {
  try {
    await releaseRoomLock(roomId, holder);
  } catch (error) {
    traceError("room.lock.release", error, { roomId, holder });
  }
};

const waitMs = (durationMs: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, durationMs));

const clearRoundPreparingWithRetry = async (params: {
  roomRef: FirebaseFirestore.DocumentReference;
  roomId: string;
  context: string;
}): Promise<boolean> => {
  const { roomRef, roomId, context } = params;
  const MAX_ATTEMPTS = 2;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await roomRef.update({
        "ui.roundPreparing": false,
        lastActiveAt: FieldValue.serverTimestamp() as unknown as RoomDoc["lastActiveAt"],
      });
      return true;
    } catch (error) {
      traceError("ui.roundPreparing.clear.retry", error, { roomId, attempt, context });
      if (attempt < MAX_ATTEMPTS) {
        await waitMs(100);
      }
    }
  }
  return false;
};

const fetchPresenceUids = async (roomId: string): Promise<string[] | null> => {
  const rtdb = getAdminRtdb();
  if (!rtdb) return null;
  try {
    const snap = await rtdb.ref(`presence/${roomId}`).get();
    const val = (snap.val() as Record<string, Record<string, { online?: boolean; ts?: number }>> | null) ?? {};
    const now = Date.now();
    const ACTIVE_WINDOW_MS = 30_000;
    const online: string[] = [];
    for (const [uid, conns] of Object.entries(val)) {
      const hasActive = Object.values(conns ?? {}).some((c) => {
        if (c?.online === false) return false;
        const ts = typeof c?.ts === "number" ? c.ts : 0;
        if (!ts) return true;
        return now - ts <= ACTIVE_WINDOW_MS;
      });
      if (hasActive) online.push(uid);
    }
    return online;
  } catch {
    return null;
  }
};

let cachedTopicSections: TopicSections | null = null;
let cachedTopicSectionsPromise: Promise<TopicSections> | null = null;

const loadTopicSectionsFromFs = async (): Promise<TopicSections> => {
  const isProd = process.env.NODE_ENV === "production";
  if (isProd && cachedTopicSections) {
    return cachedTopicSections;
  }
  if (isProd && cachedTopicSectionsPromise) {
    return cachedTopicSectionsPromise;
  }

  const filePath = path.join(process.cwd(), "public", "itoword.md");
  const load = fs
    .readFile(filePath, "utf8")
    .then((text) => parseItoWordMarkdown(text));

  if (!isProd) {
    return load;
  }

  cachedTopicSectionsPromise = load
    .then((sections) => {
      cachedTopicSections = sections;
      return sections;
    })
    .finally(() => {
      cachedTopicSectionsPromise = null;
    });
  return cachedTopicSectionsPromise;
};

const isTopicTypeValue = (value: string | null | undefined): value is TopicType =>
  typeof value === "string" && (topicTypeLabels as readonly string[]).includes(value as TopicType);

async function verifyToken(token: string): Promise<string> {
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    const uid = decoded?.uid;
    if (!uid) {
      throw codedError("unauthorized", "unauthorized", "uid_missing");
    }
    return uid;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[verifyToken] failed", (error as Error)?.message);
    throw codedError("unauthorized", "unauthorized", (error as Error | undefined)?.message);
  }
}

async function verifyHostIdentity(
  room: RoomDoc | undefined,
  token: string,
  roomId: string,
  sessionId?: string | null
): Promise<string> {
  if (sessionId) {
    const session = await verifyHostSession(sessionId, roomId);
    if (session?.uid) {
      return session.uid;
    }
  }
  const uid = await verifyToken(token);
  const hostId = room?.hostId;
  const creatorId = room?.creatorId;
  if (hostId && hostId !== uid && creatorId !== uid) {
    throw codedError("forbidden", "forbidden", "host_only");
  }
  return uid;
}

async function chooseAvatar(roomId: string): Promise<string> {
  const db = getAdminDb();
  const snap = await db.collection("rooms").doc(roomId).collection("players").get();
  const used = new Set<string>();
  snap.forEach((d) => {
    const avatar = (d.data() as { avatar?: unknown })?.avatar;
    if (typeof avatar === "string") used.add(avatar);
  });
  const available = AVATAR_LIST.filter((a) => !used.has(a));
  if (available.length === 0) {
    return getAvatarByOrder(0);
  }
  const idx = Math.floor(Math.random() * available.length);
  return available[idx]!;
}

async function ensurePlayerDoc(params: {
  roomId: string;
  uid: string;
  displayName: string | null;
}): Promise<{ joined: boolean; avatar: string | null }> {
  const { roomId, uid } = params;
  const displayName = params.displayName ? sanitizeName(params.displayName) : "匿名";
  const db = getAdminDb();
  const playerRef = db.collection("rooms").doc(roomId).collection("players").doc(uid);
  const snap = await playerRef.get();
  if (snap.exists) {
    const patch: Partial<PlayerDoc> = {
      lastSeen: FieldValue.serverTimestamp() as unknown as PlayerDoc["lastSeen"],
    };
    if (displayName && snap.data()?.name !== displayName) {
      patch.name = displayName;
    }
    await playerRef.update(patch);
    return { joined: false, avatar: (snap.data() as PlayerDoc | undefined)?.avatar ?? null };
  }

  const avatar = await chooseAvatar(roomId);
  const payload: PlayerDoc = {
    name: displayName,
    avatar,
    number: null,
    clue1: "",
    ready: false,
    orderIndex: 0,
    uid,
    lastSeen: FieldValue.serverTimestamp() as unknown as PlayerDoc["lastSeen"],
    joinedAt: FieldValue.serverTimestamp() as unknown as PlayerDoc["joinedAt"],
  };
  await playerRef.set(payload);
  return { joined: true, avatar };
}

export async function createRoom(params: CreateRoomParams): Promise<{ roomId: string; appVersion: string }> {
  const uid = await verifyToken(params.token);
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
  const uid = await verifyToken(params.token);
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
  const uid = await verifyToken(params.token);
  if (uid !== params.uid) {
    throw codedError("forbidden", "forbidden", "uid_mismatch");
  }

  await leaveRoomServer(params.roomId, uid, params.displayName ?? null);
  traceAction("room.leave.server", { roomId: params.roomId, uid });
}

export async function updateReady(params: UpdateReadyParams) {
  const uid = await verifyToken(params.token);
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
  const uid = await verifyToken(params.token);
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
} & WithAuth) {
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
  const doAutoDeal = params.autoDeal === true;

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
      const playersSnap = await roomRef.collection("players").get();
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

      // Idempotent: 同じ requestId で既に clue になっていれば成功扱いで何もしない
      if (room.startRequestId && room.startRequestId === requestId && room.status === "clue") {
        alreadyStarted = true;
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
        throw codedError("invalid_status", "invalid_status");
      }
      if (room.hostId && room.hostId !== uid) {
        throw codedError("forbidden", "forbidden", "host_only");
      }
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
        ui: { ...(room.ui ?? {}), recallOpen: false },
        startRequestId: requestId,
        dealRequestId: doAutoDeal && preparedDeal ? requestId : room.dealRequestId ?? null,
        lastCommandAt: FieldValue.serverTimestamp() as unknown as RoomDoc["lastCommandAt"],
        statusVersion: FieldValue.increment(1) as unknown as number,
      };

      if (doAutoDeal && preparedDeal) {
        payload.topic = preparedDeal.topic;
        payload.topicBox = preparedDeal.topicBox as RoomDoc["topicBox"] | null;
        payload.topicOptions = null;
        payload.deal = preparedDeal.dealPayload;
      }

      tx.update(roomRef, payload);
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
      return;
    }

    // reset players in a batch (autoDeal 時は配札も同時に反映)
    const playersSnap = await db.collection("rooms").doc(params.roomId).collection("players").get();
    const batch = db.batch();
    playersSnap.forEach((doc) => {
      const pid = doc.id;
      if (doAutoDeal && preparedDeal) {
        const seatIndex =
          typeof preparedDeal.dealPayload.seatHistory?.[pid] === "number"
            ? preparedDeal.dealPayload.seatHistory[pid]!
            : 0;
        batch.update(doc.ref, {
          number: preparedDeal.dealPayload.numbers[pid] ?? null,
          clue1: "",
          ready: false,
          orderIndex: seatIndex,
          lastSeen: FieldValue.serverTimestamp(),
        } satisfies Partial<PlayerDoc>);
      } else {
        batch.update(doc.ref, { number: null, clue1: "", ready: false, orderIndex: 0 });
      }
    });
    await batch.commit();

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

export async function resetRoomCommand(params: { roomId: string; recallSpectators?: boolean; requestId: string | null; sessionId?: string } & WithAuth) {
  const db = getAdminDb();
  const roomRef = db.collection("rooms").doc(params.roomId);
  const roomSnapForAuth = await roomRef.get();
  const roomForAuth = roomSnapForAuth.exists ? (roomSnapForAuth.data() as RoomDoc) : undefined;
  const uid = await verifyHostIdentity(roomForAuth, params.token, params.roomId, params.sessionId ?? undefined);
  const lockHolder = `reset:${params.requestId ?? "none"}`;
  const locked = await acquireRoomLock(params.roomId, lockHolder);
  if (!locked) {
    throw codedError("rate_limited", "rate_limited");
  }
  try {
    const snap = await roomRef.get();
    if (!snap.exists) {
      throw codedError("room_not_found", "room_not_found");
    }
    const room = snap.data() as RoomDoc | undefined;
    const prevStatus = room?.status ?? null;
    // Idempotent: 同じ requestId で既に waiting なら成功扱い
    if (params.requestId && room?.resetRequestId === params.requestId && room?.status === "waiting") {
      traceAction("room.reset.server.idempotent", { roomId: params.roomId, uid, requestId: params.requestId });
      void logRoomCommandAudit({
        roomId: params.roomId,
        uid,
        requestId: params.requestId,
        command: "reset",
        prevStatus,
        nextStatus: "waiting",
        note: "idempotent",
      });
      return;
    }
    const authorized =
      uid === room?.hostId || uid === room?.creatorId || (await getAdminAuth().verifyIdToken(params.token)).admin === true;
    if (!authorized) {
      throw codedError("forbidden", "forbidden", "host_only");
    }

    const resetPayload = composeWaitingResetPayload({
      recallOpen: params.recallSpectators ?? true,
      resetRound: true,
      clearTopic: true,
      closedAt: null,
      expiresAt: null,
    });
    if (params.requestId) {
      resetPayload.resetRequestId = params.requestId;
    }
    resetPayload.lastCommandAt = FieldValue.serverTimestamp() as unknown as RoomDoc["lastCommandAt"];
    resetPayload.statusVersion = FieldValue.increment(1) as unknown as number;
    await roomRef.update(resetPayload);

    // ルーム更新完了後、即座にログを出力（レスポンス前の最小限の処理）
    traceAction("room.reset.server", {
      roomId: params.roomId,
      uid,
      requestId: params.requestId ?? null,
      prevStatus: room?.status ?? null,
      nextStatus: "waiting",
    });
    void logRoomCommandAudit({
      roomId: params.roomId,
      uid,
      requestId: params.requestId,
      command: "reset",
      prevStatus,
      nextStatus: "waiting",
    });

    // Spectator pending cleanup を非同期で実行（ユーザーの体感速度を優先）
    // API レスポンスはここで返し、cleanup はバックグラウンドで継続
    void (async () => {
      try {
        const sessionsRef = db.collection("spectatorSessions");
        const pendingSnap = await sessionsRef
          .where("roomId", "==", params.roomId)
          .where("rejoinRequest.status", "==", "pending")
          .get();

        const watchingSnap = await sessionsRef
          .where("roomId", "==", params.roomId)
          .where("rejoinRequest", "==", null)
          .where("status", "==", "watching")
          .get();

        if (!pendingSnap.empty || !watchingSnap.empty) {
          const batch = db.batch();
          pendingSnap.forEach((doc) => {
            batch.update(doc.ref, {
              status: "watching",
              rejoinRequest: null,
              updatedAt: FieldValue.serverTimestamp(),
            });
          });

          watchingSnap.forEach((doc) => {
            batch.update(doc.ref, {
              rejoinRequest: {
                status: "pending",
                source: "auto",
                createdAt: FieldValue.serverTimestamp(),
              },
              updatedAt: FieldValue.serverTimestamp(),
            });
          });

          await batch.commit();
          safeTraceAction("room.reset.spectator.cleanup.done", {
            roomId: params.roomId,
            pending: pendingSnap.size,
            watching: watchingSnap.size,
          });
        }
      } catch (cleanupError) {
        traceError("room.reset.spectator.cleanup", cleanupError, { roomId: params.roomId });
      }
    })();
  } finally {
    await releaseLockSafely(params.roomId, lockHolder);
  }
}

export async function submitOrder(params: SubmitOrderParams) {
  const uid = await verifyToken(params.token);
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

const readProposal = (source: unknown): (string | null)[] => {
  if (!Array.isArray(source)) return [];
  return (source as (string | null | undefined)[]).map((v) =>
    typeof v === "string" && v.length > 0 ? v : null
  );
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export async function mutateProposal(params: {
  token: string;
  roomId: string;
  playerId: string;
  action: ProposalAction;
  targetIndex?: number | null;
}): Promise<"ok" | "noop" | "missing-deal"> {
  const uid = await verifyToken(params.token);

  const db = getAdminDb();
  const roomRef = db.collection("rooms").doc(params.roomId);
  const proposalRef = db.collection("roomProposals").doc(params.roomId);

  const targetIndex = typeof params.targetIndex === "number" ? params.targetIndex : -1;

  const result = await db.runTransaction(async (tx) => {
    const roomSnap = await tx.get(roomRef);
    if (!roomSnap.exists) throw codedError("room_not_found", "room_not_found");
    const room = roomSnap.data() as RoomDoc;
    if (room.status !== "clue") return "noop" as const;
    const resolveMode = (room?.options as { resolveMode?: string } | undefined)?.resolveMode;
    if (resolveMode && resolveMode !== "sort-submit") return "noop" as const;

    const roundPlayers = Array.isArray(room?.deal?.players)
      ? (room.deal!.players as string[]).filter((v) => typeof v === "string" && v.trim().length > 0)
      : [];
    if (roundPlayers.length === 0) return "missing-deal" as const;
    if (!roundPlayers.includes(params.playerId)) return "missing-deal" as const;
    const maxCount = roundPlayers.length;

    // 誰でも並び替えできる仕様。ただし現在のラウンド参加者 or ホスト/作成者に限定して悪用を防ぐ
    const actorIsParticipant = roundPlayers.includes(uid);
    const actorIsHost = !room.hostId || room.hostId === uid || room.creatorId === uid;
    if (!actorIsParticipant && !actorIsHost) {
      throw codedError("forbidden", "forbidden", "actor_not_participant");
    }

    const proposalSnap = await tx.get(proposalRef);
    const proposalData = proposalSnap.exists ? (proposalSnap.data() as { proposal?: unknown; seed?: unknown }) : null;
    const roomSeed = typeof room?.deal?.seed === "string" ? room.deal.seed : null;
    const docSeed = typeof proposalData?.seed === "string" ? (proposalData?.seed as string) : null;

    let current = readProposal(proposalData?.proposal ?? room?.order?.proposal);
    if (docSeed && roomSeed && docSeed !== roomSeed) {
      current = [];
    }
    const roundSet = new Set(roundPlayers);
    current = current.map((id) => (typeof id === "string" && roundSet.has(id) ? id : null));

    let normalized: (string | null)[] | null = null;

    if (params.action === "add") {
      const insert = prepareProposalInsert(current, params.playerId, maxCount, targetIndex);
      if (insert.status === "noop") return "noop" as const;
      normalized = insert.normalized;
    } else if (params.action === "remove") {
      const idx = current.findIndex((v) => v === params.playerId);
      if (idx < 0) return "noop" as const;
      current[idx] = null;
      normalized = normalizeProposal(current, maxCount);
    } else {
      const fromIdx = current.findIndex((v) => v === params.playerId);
      if (fromIdx < 0) return "noop" as const;
      const clamped = clamp(targetIndex, 0, Math.max(0, maxCount - 1));
      const target = current[clamped];
      if (typeof target === "string" && target !== params.playerId) {
        current[clamped] = params.playerId;
        current[fromIdx] = target;
      } else {
        current[fromIdx] = null;
        if (clamped >= current.length) current.length = clamped + 1;
        current[clamped] = params.playerId;
      }
      if (maxCount > 0 && current.length > maxCount) current.length = maxCount;
      normalized = normalizeProposal(current, maxCount);
    }

    const seedToUse = roomSeed ?? docSeed ?? null;
    tx.set(
      proposalRef,
      {
        proposal: normalized,
        seed: seedToUse,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    tx.update(roomRef, {
      "order.proposal": normalized,
      lastActiveAt: FieldValue.serverTimestamp(),
      statusVersion: FieldValue.increment(1) as unknown as number,
    });
    return "ok" as const;
  });

  return result ?? "noop";
}

export async function commitPlayFromClueCommand(params: { token: string; roomId: string; playerId: string }) {
  const uid = await verifyToken(params.token);
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

    const roundPlayers: string[] | null = Array.isArray(room?.deal?.players)
      ? (room.deal!.players as string[])
      : null;
    const roundTotal: number | null = roundPlayers ? roundPlayers.length : null;
    const decidedAtSource = (room?.order as { decidedAt?: unknown } | undefined)?.decidedAt ?? null;
    const decidedAtMs = toMillis(decidedAtSource as unknown as number | FirebaseFirestore.Timestamp | FieldValue | Date | null | undefined);
    const currentOrder: OrderState = {
      list: Array.isArray(room?.order?.list) ? [...room.order!.list] : [],
      lastNumber:
        typeof room?.order?.lastNumber === "number"
          ? room.order.lastNumber
          : null,
      failed: !!room?.order?.failed,
      failedAt:
        typeof room?.order?.failedAt === "number"
          ? room.order.failedAt
          : null,
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

export async function dealNumbersCommand(params: { token: string; roomId: string; skipPresence?: boolean; requestId: string; sessionId?: string; presenceUids?: string[] | null }): Promise<number> {
  const db = getAdminDb();
  const roomRef = db.collection("rooms").doc(params.roomId);
  const roomSnap = await roomRef.get();
  if (!roomSnap.exists) throw codedError("room_not_found", "room_not_found");
  const room = roomSnap.data() as RoomDoc | undefined;
  const uid = await verifyHostIdentity(room, params.token, params.roomId, params.sessionId ?? undefined);
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
  const existingDealCount =
    room?.deal?.players && Array.isArray(room.deal.players) ? room.deal.players.length : null;
  if (room?.dealRequestId && room.dealRequestId === params.requestId && existingDealCount !== null) {
    return existingDealCount;
  }

  // allow the very first deal right after start without waiting,
  // so quickStart/start -> deal のシーケンスが 700ms 未満でも失敗しない
  const existingNumbers =
    room && typeof room.deal === "object" && room.deal
      ? (room.deal as { numbers?: Record<string, unknown> | undefined }).numbers
      : undefined;
  const isFirstDeal = !existingNumbers || Object.keys(existingNumbers).length === 0;
  const canBypassRateLimit =
    isFirstDeal && (room?.status === "clue" || room?.status === "waiting");

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
    const presenceUids = params.presenceUids ?? (params.skipPresence ? null : await fetchPresenceUids(params.roomId));
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

    const playerIds = ordered.map((p) => p.id);
    const generatedNumbers = generateDeterministicNumbers(playerIds.length, min, max, seed);
    const dealPayload = buildDealPayload(playerIds, seed, min, max, generatedNumbers);

    await roomRef.update({
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

    try {
      const batch = db.batch();
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
      await batch.commit();
    } catch (error) {
      traceError("deal.resetPlayers", error, { roomId: params.roomId });
    }

    try {
      await db.collection("roomProposals").doc(params.roomId).set(
        {
          proposal: [],
          seed,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      traceError("proposal.reset", error, { roomId: params.roomId });
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

export async function continueAfterFailCommand(params: { token: string; roomId: string }) {
  const uid = await verifyToken(params.token);
  const db = getAdminDb();
  const roomRef = db.collection("rooms").doc(params.roomId);
  const snap = await roomRef.get();
  if (!snap.exists) throw codedError("room_not_found", "room_not_found");
  const room = snap.data() as RoomDoc | undefined;
  if (room?.hostId && room.hostId !== uid) {
    throw codedError("forbidden", "forbidden", "host_only");
  }
  if (room?.status !== "reveal" && room?.status !== "finished") {
    throw codedError("invalid_status", "invalid_status");
  }

  await roomRef.update({
    status: "waiting",
    result: null,
    order: null,
    deal: null,
    mvpVotes: {},
    lastActiveAt: FieldValue.serverTimestamp(),
    statusVersion: FieldValue.increment(1) as unknown as number,
  });

  try {
    const playersSnap = await roomRef.collection("players").get();
    const batch = db.batch();
    playersSnap.forEach((d) => {
      batch.update(d.ref, { clue1: "", ready: false, number: null, orderIndex: 0 });
    });
    await batch.commit();
  } catch (error) {
    traceError("continueAfterFail.resetPlayers", error, { roomId: params.roomId });
  }
}

export async function setRevealPendingCommand(params: { token: string; roomId: string; pending: boolean }) {
  const uid = await verifyToken(params.token);
  const db = getAdminDb();
  const roomRef = db.collection("rooms").doc(params.roomId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists) throw codedError("room_not_found", "room_not_found");
    const room = snap.data() as RoomDoc;
    const isHost = !room?.hostId || room.hostId === uid || room?.creatorId === uid;
    if (!isHost) throw codedError("forbidden", "forbidden", "host_only");

    const updates: Record<string, unknown> = {
      "ui.revealPending": params.pending,
      lastActiveAt: FieldValue.serverTimestamp(),
    };
    if (params.pending) {
      updates["ui.revealBeginAt"] = FieldValue.serverTimestamp();
    } else {
      updates["ui.revealBeginAt"] = FieldValue.delete();
    }

    tx.update(roomRef, updates);
  });

  traceAction("ui.revealPending.set.server", {
    roomId: params.roomId,
    uid,
    pending: params.pending,
  });
}

export async function setRoundPreparingCommand(params: { token: string; roomId: string; active: boolean }) {
  const uid = await verifyToken(params.token);
  const db = getAdminDb();
  const roomRef = db.collection("rooms").doc(params.roomId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists) throw codedError("room_not_found", "room_not_found");
    const room = snap.data() as RoomDoc;
    const isHost = !room?.hostId || room.hostId === uid || room?.creatorId === uid;
    if (!isHost) throw codedError("forbidden", "forbidden", "host_only");
    tx.update(roomRef, {
      "ui.roundPreparing": params.active,
      lastActiveAt: FieldValue.serverTimestamp(),
    });
  });

  traceAction("ui.roundPreparing.set.server", { roomId: params.roomId, uid, active: params.active });
}

export async function finalizeRevealCommand(params: { token: string; roomId: string }) {
  const uid = await verifyToken(params.token);
  const db = getAdminDb();
  const roomRef = db.collection("rooms").doc(params.roomId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists) throw codedError("room_not_found", "room_not_found");
    const room = snap.data() as RoomDoc;
    const isHost = !room?.hostId || room.hostId === uid || room?.creatorId === uid;
    if (!isHost) throw codedError("forbidden", "forbidden", "host_only");
    if (room.status !== "reveal") return;
    tx.update(roomRef, {
      status: "finished",
      lastActiveAt: FieldValue.serverTimestamp(),
      statusVersion: FieldValue.increment(1) as unknown as number,
    });
  });

  traceAction("reveal.finalize.server", { roomId: params.roomId, uid });
}

export async function pruneProposalCommand(params: { token: string; roomId: string; eligibleIds: string[] }) {
  const uid = await verifyToken(params.token);
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

    const proposal = Array.isArray(room?.order?.proposal)
      ? (room.order!.proposal as (string | null)[])
      : [];
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

export async function updateRoomOptionsCommand(params: {
  token: string;
  roomId: string;
  resolveMode?: string | null;
  defaultTopicType?: string | null;
}) {
  const uid = await verifyToken(params.token);
  const db = getAdminDb();
  const roomRef = db.collection("rooms").doc(params.roomId);
  const snap = await roomRef.get();
  if (!snap.exists) throw codedError("room_not_found", "room_not_found");
  const room = snap.data() as RoomDoc | undefined;
  const isHost = !room?.hostId || room.hostId === uid || room?.creatorId === uid;
  if (!isHost) throw codedError("forbidden", "forbidden", "host_only");

  const updates: Record<string, unknown> = {
    lastActiveAt: FieldValue.serverTimestamp(),
  };
  if (params.resolveMode) {
    updates["options.resolveMode"] = params.resolveMode;
  }
  if (params.defaultTopicType) {
    updates["options.defaultTopicType"] = params.defaultTopicType;
  }

  await roomRef.update(updates);
  traceAction("room.options.update.server", {
    roomId: params.roomId,
    uid,
    resolveMode: params.resolveMode,
    defaultTopicType: params.defaultTopicType,
  });
}

export async function castMvpVoteCommand(params: { token: string; roomId: string; targetId: string | null }) {
  const uid = await verifyToken(params.token);
  const db = getAdminDb();
  const roomRef = db.collection("rooms").doc(params.roomId);
  const playerRef = roomRef.collection("players").doc(uid);
  const playerSnap = await playerRef.get();
  if (!playerSnap.exists) throw codedError("forbidden", "forbidden", "not_member");

  const fieldPath = `mvpVotes.${uid}`;
  const updates: Record<string, unknown> = {
    lastActiveAt: FieldValue.serverTimestamp(),
  };
  if (!params.targetId) {
    updates[fieldPath] = FieldValue.delete();
  } else {
    updates[fieldPath] = params.targetId;
  }

  await roomRef.update(updates);
  traceAction("mvp.vote.server", { roomId: params.roomId, uid, target: params.targetId ?? "" });
}

export async function updatePlayerProfileCommand(params: {
  token: string;
  roomId: string;
  playerId?: string | null;
  name?: string | null;
  avatar?: string | null;
}) {
  const uid = await verifyToken(params.token);
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
  const uid = await verifyToken(params.token);
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

type TopicAction =
  | { kind: "select"; type: TopicType }
  | { kind: "shuffle"; type: TopicType | null }
  | { kind: "custom"; text: string }
  | { kind: "reset" };

export async function topicCommand(params: { token: string; roomId: string; action: TopicAction }) {
  const uid = await verifyToken(params.token);
  const db = getAdminDb();
  const roomRef = db.collection("rooms").doc(params.roomId);
  const roomSnap = await roomRef.get();
  if (!roomSnap.exists) throw codedError("room_not_found", "room_not_found");
  const room = roomSnap.data() as RoomDoc | undefined;
  const isHost = !room?.hostId || room.hostId === uid || room?.creatorId === uid;
  if (!isHost) throw codedError("forbidden", "forbidden", "host_only");

  const sections = await loadTopicSectionsFromFs();
  const serverNow = FieldValue.serverTimestamp();

  if (params.action.kind === "reset") {
    if (room?.status === "clue" || room?.status === "reveal") {
      throw codedError("invalid_status", "invalid_status", "reset_forbidden");
    }
    const updates: Partial<RoomDoc> & Record<string, unknown> = {
      status: "waiting",
      result: null,
      deal: null,
      order: null,
      round: 0,
      topic: null,
      topicOptions: null,
      topicBox: null,
      closedAt: null,
      expiresAt: null,
      lastActiveAt: serverNow,
    };
    await roomRef.update(updates);

    try {
      const playersSnap = await roomRef.collection("players").get();
      const batch = db.batch();
      playersSnap.forEach((docSnap) => {
        batch.update(docSnap.ref, {
          clue1: "",
          ready: false,
        });
      });
      await batch.commit();
    } catch (error) {
      traceError("topic.reset.players", error, { roomId: params.roomId });
    }
    traceAction("topic.reset.server", { roomId: params.roomId, uid });
    return;
  }

  if (params.action.kind === "custom") {
    const topic = sanitizeTopicText(params.action.text);
    if (!topic) throw codedError("invalid_payload", "invalid_payload", "empty_topic");
    await roomRef.update({
      topic,
      topicBox: "カスタム",
      topicOptions: null,
      lastActiveAt: serverNow,
    });
    traceAction("topic.custom.server", { roomId: params.roomId, uid });
    return;
  }

  const type = params.action.kind === "select" ? params.action.type : params.action.type ?? null;
  const topicType = type && isTopicTypeValue(type) ? (type as TopicType) : null;
  const pool = topicType ? (topicType === "通常版" ? sections.normal : topicType === "レインボー版" ? sections.rainbow : sections.classic) : [];
  const picked = pickOne(pool) || null;

  if (params.action.kind === "select" && !topicType) {
    throw codedError("invalid_payload", "invalid_payload", "invalid_topic_type");
  }

  if (params.action.kind === "shuffle" && !topicType) {
    throw codedError("invalid_payload", "invalid_payload", "missing_topic_type");
  }

  await roomRef.update({
    topicBox: topicType ?? null,
    topicOptions: null,
    topic: picked,
    lastActiveAt: serverNow,
  });

  traceAction(params.action.kind === "select" ? "topic.select.server" : "topic.shuffle.server", {
    roomId: params.roomId,
    uid,
    topicBox: topicType,
    topic: picked ?? undefined,
  });
}

// ============================================================================
// nextRoundCommand: 「次のゲーム」専用 API
// ============================================================================
// reset + start + topic選択 + deal をアトミックに実行する。
// これにより、クライアント側のレース条件やリトライロジックが不要になる。
// ============================================================================

export type NextRoundParams = WithAuth & {
  roomId: string;
  topicType?: string | null;      // 省略時は room.options.defaultTopicType
  customTopic?: string | null;    // カスタムお題（topicType が "カスタム" の場合）
  requestId: string;
  sessionId?: string;
  presenceUids?: string[] | null;
};

export type NextRoundResult = {
  ok: true;
  round: number;
  playerCount: number;
  topic: string | null;
  topicType: string | null;
};

export async function nextRoundCommand(params: NextRoundParams): Promise<NextRoundResult> {
  const db = getAdminDb();
  const roomRef = db.collection("rooms").doc(params.roomId);
  const rateLimitMs = 700;
  const lockHolder = `next:${params.requestId}`;
  const locked = await acquireRoomLock(params.roomId, lockHolder);
  if (!locked) {
    traceAction("room.next.locked", {
      roomId: params.roomId,
      requestId: params.requestId,
      holder: lockHolder,
    });
    throw codedError("rate_limited", "rate_limited");
  }
  let roundPreparingActivated = false;
  let room: RoomDoc | undefined;
  try {
    // 1. room 取得 & 権限チェック
    const roomSnap = await roomRef.get();
    if (!roomSnap.exists) {
      throw codedError("room_not_found", "room_not_found");
    }
    room = roomSnap.data() as RoomDoc | undefined;
    const uid = await verifyHostIdentity(room, params.token, params.roomId, params.sessionId ?? undefined);

    // ホストまたは作成者のみ実行可能
    const isHost = !room?.hostId || room.hostId === uid || room?.creatorId === uid;
    if (!isHost) {
      throw codedError("forbidden", "forbidden", "host_only");
    }

    // 2. 許可されるステータスをチェック
    //    - 通常: reveal / finished / waiting から実行
    //    - clue は「直前の開始処理中」に限り許容するが、本来は next-round を押せる UI には出ない想定。
    //      （status が想定外でもサーバー側で安全に弾けるよう、allowedStatuses は少し広めに取る）
    const allowedStatuses: RoomDoc["status"][] = ["reveal", "finished", "waiting", "clue"];
    if (room?.status && !allowedStatuses.includes(room.status)) {
      throw codedError("invalid_status", "invalid_status", `status_is_${room.status}`);
    }

    // Idempotent: 直前と同じ requestId ですでに遷移済みならそのまま返す
    if (room?.nextRequestId && room.nextRequestId === params.requestId && room.status === "clue") {
      const playerCount = Array.isArray(room?.deal?.players) ? room.deal!.players!.length : 0;
      return {
        ok: true,
        round: typeof room?.round === "number" ? room.round : 0,
        playerCount,
        topic: room?.topic ?? null,
        topicType: (room?.topicBox as string | null | undefined) ?? null,
      };
    }

    // レートリミット（ルーム単位）
    const lastMs = room?.lastCommandAt ? toMillis(room.lastCommandAt) : null;
    if (lastMs !== null && Date.now() - lastMs < rateLimitMs) {
      throw codedError("rate_limited", "rate_limited");
    }

    // 次のゲーム開始はクライアントの round-preparing API に頼らず、
    // server-authoritative な next command 内で即座にUIを凍結する。
    try {
      await roomRef.update({
        "ui.roundPreparing": true,
        lastActiveAt: FieldValue.serverTimestamp(),
      });
      roundPreparingActivated = true;
    } catch (error) {
      traceError("ui.roundPreparing.next.begin", error, { roomId: params.roomId });
    }

    // 3. プレイヤー一覧を取得
    const playersSnap = await roomRef.collection("players").get();
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

    // 4. 配布対象プレイヤーを選定
    const target = selectDealTargetPlayers(candidates, presenceUids, now);
    let ordered = [...target].sort((a, b) => String(a.uid || a.id).localeCompare(String(b.uid || b.id)));

    // フォールバック: eligibleCount > 1 なのに ordered が 1 以下の場合
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

    // 5. topic を決定
    const sections = await loadTopicSectionsFromFs();
    const requestedTopicType = params.topicType ?? room?.options?.defaultTopicType ?? "通常版";
    const normalizedTopicType =
      typeof requestedTopicType === "string" && isTopicTypeValue(requestedTopicType)
        ? (requestedTopicType as TopicType)
        : ("通常版" as TopicType);

    let topic: string | null = null;
    let topicBox: string | null = room?.topicBox ?? normalizedTopicType;

    if (topicBox === "カスタム") {
      // カスタムお題の場合
      const customText = params.customTopic ? sanitizeTopicText(params.customTopic) : null;
      if (customText && customText.trim().length > 0) {
        topic = customText;
        topicBox = "カスタム";
      } else if (room?.topic && String(room.topicBox) === "カスタム") {
        // 前回のカスタムお題を引き継ぐ
        topic = room.topic;
        topicBox = "カスタム";
      } else {
        // カスタムお題がない場合は通常版にフォールバック
        const pool = sections.normal;
        topic = pickOne(pool) || null;
        topicBox = "通常版";
      }
    } else {
      // 標準お題の場合
      const pool = normalizedTopicType === "通常版"
        ? sections.normal
        : normalizedTopicType === "レインボー版"
          ? sections.rainbow
          : sections.classic;
      topic = pickOne(pool) || null;
    }

    // 6. numbers を生成
    const seed = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const min = 1;
    const max = 100;
    const playerIds = ordered.map((p) => p.id);
    const generatedNumbers = generateDeterministicNumbers(playerIds.length, min, max, seed);
    const dealPayload = buildDealPayload(playerIds, seed, min, max, generatedNumbers);

    // 7. 新しい round 番号
    const currentRound = typeof room?.round === "number" ? room.round : 0;
    const nextRound = currentRound + 1;

    // 8. room を更新（アトミックに全てを設定）
    const roomUpdate: Record<string, unknown> = {
      status: "clue",
      round: nextRound,
      topic,
      topicBox,
      topicOptions: null,
      deal: dealPayload,
      order: {
        list: [],
        lastNumber: null,
        failed: false,
        failedAt: null,
        total: ordered.length,
      } satisfies OrderState,
      result: null,
      mvpVotes: {},
      lastActiveAt: FieldValue.serverTimestamp(),
      startRequestId: params.requestId,
      nextRequestId: params.requestId,
      dealRequestId: params.requestId,
      lastCommandAt: FieldValue.serverTimestamp(),
      statusVersion: FieldValue.increment(1) as unknown as number,
      "ui.roundPreparing": false,
      "ui.recallOpen": false,
      "ui.revealPending": false,
    };
    await roomRef.update(roomUpdate);
    roundPreparingActivated = false;
    traceAction("room.nextRound.server", {
      roomId: params.roomId,
      uid,
      requestId: params.requestId,
      prevStatus: room?.status ?? null,
      nextStatus: "clue",
      playerCount: ordered.length,
      topicType: topicBox ?? null,
    });
    void logRoomCommandAudit({
      roomId: params.roomId,
      uid,
      requestId: params.requestId,
      command: "next",
      prevStatus: room?.status ?? null,
      nextStatus: "clue",
      note: `playerCount:${ordered.length}`,
    });

    // 9. players を更新（number, clue1, ready, orderIndex をリセット）
    try {
      const batch = db.batch();
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
      await batch.commit();
    } catch (error) {
      traceError("nextRound.resetPlayers", error, { roomId: params.roomId });
    }

    // 10. proposal をリセット
    try {
      await db.collection("roomProposals").doc(params.roomId).set(
        {
          proposal: [],
          seed,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      traceError("nextRound.resetProposal", error, { roomId: params.roomId });
    }

    // 11. ログ出力
    safeTraceAction("nextRound.server", {
      roomId: params.roomId,
      uid,
      round: nextRound,
      playerCount: ordered.length,
      topicType: topicBox,
      topic: topic ?? undefined,
    });

    return {
      ok: true,
      round: nextRound,
      playerCount: ordered.length,
      topic,
      topicType: topicBox,
    };
  } catch (error) {
    try {
      const failureSnap = await roomRef.get();
      const failureRoom = failureSnap.exists ? (failureSnap.data() as RoomDoc) : undefined;
      traceError("room.next.server.failure", error, {
        roomId: params.roomId,
        requestId: params.requestId,
        prevStatus: room?.status ?? null,
        status: failureRoom?.status ?? null,
        roundPreparing: failureRoom?.ui?.roundPreparing ?? null,
        nextRequestId: failureRoom?.nextRequestId ?? null,
        locked: locked ? "1" : "0",
      });
    } catch (detailError) {
      traceError("room.next.server.failure.detail", detailError, {
        roomId: params.roomId,
        requestId: params.requestId,
      });
    }
    throw error;
  } finally {
    if (roundPreparingActivated) {
      const cleared = await clearRoundPreparingWithRetry({
        roomRef,
        roomId: params.roomId,
        context: "nextRoundCommand",
      });
      if (cleared) {
        roundPreparingActivated = false;
      }
    }
    await releaseLockSafely(params.roomId, lockHolder);
  }
}
