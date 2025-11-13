import { db } from "@/lib/firebase/client";
import { ensureAuthSession } from "@/lib/firebase/authSession";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { AVATAR_LIST, getAvatarByOrder } from "@/lib/utils";
import { logWarn } from "@/lib/utils/log";
import { traceAction } from "@/lib/utils/trace";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type FirestoreError,
  where,
} from "firebase/firestore";

const AVATAR_CACHE_TTL_MS = 30_000;
type AvatarCacheEntry = {
  used: Set<string>;
  expiresAt: number;
};

type DealState = NonNullable<RoomDoc["deal"]>;
type OrderState = NonNullable<RoomDoc["order"]>;

const avatarCache = new Map<string, AvatarCacheEntry>();

function getAvatarCache(roomId: string): AvatarCacheEntry | null {
  const entry = avatarCache.get(roomId);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    avatarCache.delete(roomId);
    return null;
  }
  return entry;
}

function setAvatarCache(roomId: string, avatars: Iterable<string>) {
  avatarCache.set(roomId, {
    used: new Set(avatars),
    expiresAt: Date.now() + AVATAR_CACHE_TTL_MS,
  });
}

function registerAvatarUsage(roomId: string, avatar: string) {
  const entry = getAvatarCache(roomId);
  if (!entry) {
    setAvatarCache(roomId, [avatar]);
    return;
  }
  entry.used.add(avatar);
  entry.expiresAt = Date.now() + AVATAR_CACHE_TTL_MS;
}

function invalidateAvatarCache(roomId: string) {
  avatarCache.delete(roomId);
}

export type RoomServiceErrorCode = "ROOM_NOT_FOUND" | "ROOM_IN_PROGRESS";

const ROOM_ERROR_MESSAGES: Record<RoomServiceErrorCode, string> = {
  ROOM_NOT_FOUND: "部屋が見つかりませんでした。",
  ROOM_IN_PROGRESS: "ゲーム進行中のため席に戻れません。",
};

export class RoomServiceError extends Error {
  readonly code: RoomServiceErrorCode;

  constructor(code: RoomServiceErrorCode) {
    super(ROOM_ERROR_MESSAGES[code]);
    this.name = "RoomServiceError";
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

const ROOM_ERROR_CODES: RoomServiceErrorCode[] = [
  "ROOM_NOT_FOUND",
  "ROOM_IN_PROGRESS",
];

const isRoomServiceErrorCode = (
  value: unknown
): value is RoomServiceErrorCode =>
  typeof value === "string" &&
  ROOM_ERROR_CODES.includes(value as RoomServiceErrorCode);

export const getRoomServiceErrorCode = (
  error: unknown
): RoomServiceErrorCode | null => {
  if (error instanceof RoomServiceError) {
    return error.code;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error
  ) {
    const codeValue = (error as { code?: unknown }).code;
    if (isRoomServiceErrorCode(codeValue)) {
      return codeValue;
    }
  }
  return null;
};

type EnsureMemberResult =
  | { joined: true }
  | { joined: false }
  | { joined: false; reason: "inProgress" };

export async function ensureMember({
  roomId,
  uid,
  displayName,
}: {
  roomId: string;
  uid: string;
  displayName: string | null | undefined;
}): Promise<EnsureMemberResult> {
  // まず重複チェック＆クリーンアップを実行（ベストプラクティス）
  await cleanupDuplicatePlayerDocs(roomId, uid);

  const meRef = doc(db!, "rooms", roomId, "players", uid);
  const meSnap = await getDoc(meRef);
  if (!meSnap.exists()) {
    const roomRef = doc(db!, "rooms", roomId);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) {
      throw new RoomServiceError("ROOM_NOT_FOUND");
    }
    const room = roomSnap.data() as RoomDoc &
      Partial<{ hostId: string; status: string }>;
    const status = room?.status;
    const isHost =
      typeof room?.hostId === "string" && room.hostId.trim() === uid;

    // Spectator V3: recallOpen で入席可否を制御
    // 互換性のため、undefined は "開放中" とみなす（初期waitingでの入席可）
    const recallOpen = room?.ui?.recallOpen ?? true;

    const dealPlayers: string[] = Array.isArray(room?.deal?.players)
      ? (room.deal.players as string[]).filter(
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0
        )
      : [];
    const seatHistoryRaw = room?.deal?.seatHistory;
    const seatHistoryHas = typeof seatHistoryRaw?.[uid] === "number";
    const orderList: string[] = Array.isArray(room?.order?.list)
      ? (room.order.list as string[]).filter(
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0
        )
      : [];
    const orderProposal: string[] = Array.isArray(room?.order?.proposal)
      ? (room.order.proposal as (string | null)[]).filter(
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0
        )
      : [];
    const wasSeatedBefore =
      dealPlayers.includes(uid) ||
      seatHistoryHas ||
      orderList.includes(uid) ||
      orderProposal.includes(uid);

    // ゲーム進行中は入席拒否（ホスト以外）
    if (!isHost && status && status !== "waiting" && !wasSeatedBefore) {
      logWarn("roomService", "ensureMember-blocked-in-progress", {
        roomId,
        uid,
        status,
      });
      traceAction("join.blocked", { roomId, uid, status, reason: "inProgress" });
      return { joined: false, reason: "inProgress" } as const;
    }

    // waiting でも recallOpen=false なら入席拒否（ホスト以外）
    if (!isHost && status === "waiting" && !recallOpen && !wasSeatedBefore) {
      logWarn("roomService", "ensureMember-blocked-recall-disabled", {
        roomId,
        uid,
        status,
        recallOpen,
      });
      traceAction("join.blocked", { roomId, uid, status, recallOpen });
      return { joined: false, reason: "inProgress" } as const;
    }

    // クリーンアップ後の正確なプレイヤー数を取得
    const playersCollectionRef = collection(db!, "rooms", roomId, "players");
    let usedAvatars: Set<string> | null = null;
    const cached = getAvatarCache(roomId);
    if (cached) {
      usedAvatars = new Set(cached.used);
      const perf =
        typeof window !== "undefined" &&
        typeof window.performance !== "undefined"
          ? window.performance
          : null;
      perf?.mark(`avatar_cache_hit:${roomId}`);
    } else {
      try {
        const snapshot = await getDocs(playersCollectionRef);
        usedAvatars = new Set<string>();
        snapshot.docs.forEach((playerDoc) => {
          const player = playerDoc.data();
          if (player?.avatar) {
            usedAvatars!.add(String(player.avatar));
          }
        });
        setAvatarCache(roomId, usedAvatars);
        const perf =
          typeof window !== "undefined" &&
          typeof window.performance !== "undefined"
            ? window.performance
            : null;
        perf?.mark(`avatar_cache_miss:${roomId}`);
      } catch (error) {
        usedAvatars = new Set<string>();
        invalidateAvatarCache(roomId);
        logWarn("roomService", "avatar-cache-fetch-failed", {
          roomId,
          error,
        });
      }
    }
    if (!usedAvatars) {
      usedAvatars = new Set<string>();
    }

    // 使用されていないアバターをランダムに選択
    const availableAvatars = AVATAR_LIST.filter(
      (avatar) => !usedAvatars.has(avatar)
    );
    let selectedAvatar = getAvatarByOrder(0); // フォールバック

    if (availableAvatars.length > 0) {
      // 利用可能なアバターからランダム選択
      const randomIndex = Math.floor(Math.random() * availableAvatars.length);
      selectedAvatar = availableAvatars[randomIndex];
    }

    const p: PlayerDoc = {
      name: displayName || "匿名",
      avatar: selectedAvatar,
      number: null,
      clue1: "",
      ready: false,
      orderIndex: 0,
      uid,
      lastSeen: serverTimestamp(),
      joinedAt: serverTimestamp(),
    };
    try {
      await setDoc(meRef, p);
    } catch (error) {
      logWarn("roomService", "ensureMember-create-player-failed", {
        roomId,
        uid,
        status,
        error,
      });
      await recoverFromPermissionDenied(error, "ensure-member-create");
      throw error;
    }
    logWarn("roomService", "ensureMember-created-player", {
      roomId,
      uid,
      status,
    });
    registerAvatarUsage(roomId, selectedAvatar);
    return { joined: true } as const;
  }
  const existing = meSnap.data() as Partial<PlayerDoc> | undefined;
  const normalizedName =
    typeof displayName === "string" ? displayName.trim() : "";
  const patch: Partial<PlayerDoc> & {
    lastSeen: ReturnType<typeof serverTimestamp>;
  } = { lastSeen: serverTimestamp() };
  if (!existing?.uid) {
    patch.uid = uid;
  }
  if (!existing?.joinedAt) {
    patch.joinedAt = serverTimestamp();
  }
  if (normalizedName && normalizedName.length > 0 && existing?.name !== normalizedName) {
    patch.name = normalizedName;
  }
  try {
    await updateDoc(meRef, patch);
    logWarn("roomService", "ensureMember-updated-existing", {
      roomId,
      uid,
      patchKeys: Object.keys(patch),
    });
  } catch (error) {
    logWarn("roomService", "ensure-member-update-existing-failed", {
      roomId,
      uid,
      error,
    });
    await recoverFromPermissionDenied(error, "ensure-member-update");
  }
  if (existing?.avatar) {
    registerAvatarUsage(roomId, String(existing.avatar));
  }
  return { joined: false } as const;
}

export async function cleanupDuplicatePlayerDocs(roomId: string, uid: string) {
  const dupQ = query(
    collection(db!, "rooms", roomId, "players"),
    where("uid", "==", uid)
  );
  const dupSnap = await getDocs(dupQ);
  for (const d of dupSnap.docs) {
    if (d.id !== uid) {
      try {
        await deleteDoc(doc(db!, "rooms", roomId, "players", d.id));
      } catch {}
    }
  }
  if (dupSnap.size > 1) {
    invalidateAvatarCache(roomId);
  }
}

export async function addLateJoinerToDeal(roomId: string, uid: string) {
  const roomRef = doc(db!, "rooms", roomId);
  await runTransaction(db!, async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) return;
    const data = snap.data() as RoomDoc;
    const deal = data?.deal || null;
    const playersSource: unknown = deal?.players;
    let players: string[] = Array.isArray(playersSource)
      ? (playersSource as string[]).filter(
          (value): value is string => typeof value === "string" && value.length > 0
        )
      : [];

    const seatHistorySource: unknown = deal?.seatHistory;
    const seatHistory: Record<string, number> =
      seatHistorySource && typeof seatHistorySource === "object"
        ? { ...(seatHistorySource as Record<string, number>) }
        : {};

    const alreadyPresent = players.includes(uid);

    if (!alreadyPresent) {
      let targetIndex: number | null = null;
      const recorded = seatHistory[uid];
      if (typeof recorded === "number" && recorded >= 0) {
        targetIndex = recorded;
      }
      if (targetIndex === null || targetIndex > players.length) {
        targetIndex = players.length;
      }
      players = players.filter((id) => id !== uid);
      players.splice(targetIndex, 0, uid);
    }

    const nextSeatHistory: Record<string, number> = { ...seatHistory };
    players.forEach((id, index) => {
      nextSeatHistory[id] = index;
    });

    const nextDeal = {
      ...(deal ?? {}),
      players,
      seatHistory: nextSeatHistory,
    } as DealState;

    const patch: Partial<RoomDoc> = {
      deal: nextDeal,
    };

    if (data?.order) {
      const nextOrder = {
        ...(data.order ?? {}),
        total: players.length,
      } as OrderState;
      patch.order = nextOrder;
    } else if (data?.status === "clue") {
      patch.order = { total: players.length } as OrderState;
    }

    tx.update(roomRef, patch);
  });
}

export async function assignNumberIfNeeded(
  roomId: string,
  uid: string,
  roomFromState?: Partial<RoomDoc> | null
) {
  const roomRef = doc(db!, "rooms", roomId);
  const [roomData, meSnap] = await Promise.all([
    (async () => {
      if (roomFromState?.deal) {
        return roomFromState;
      }
      const snapshot = await getDoc(roomRef);
      return snapshot.exists() ? (snapshot.data() as RoomDoc) : null;
    })(),
    getDoc(doc(db!, "rooms", roomId, "players", uid)),
  ]);
  if (!roomData || !meSnap.exists()) return;
  const room = roomData as RoomDoc | Partial<RoomDoc>;
  const me = meSnap.data() as PlayerDoc;
  const deal = room?.deal || null;
  if (!deal) return;
  const activeDeal = deal as DealState;

  const min = activeDeal.min || 1;
  const max = activeDeal.max || 100;

  if (room.status === "clue") {
    if (!Array.isArray(activeDeal.players)) return;
    const idx = activeDeal.players.indexOf(uid);
    if (idx < 0) return;
    // プレイヤー数とseedのみに依存する決定的な番号
    const { generateDeterministicNumbers } = await import("@/lib/game/random");
    const nums = generateDeterministicNumbers(
      activeDeal.players.length,
      min,
      max,
      activeDeal.seed
    );
    const myNum = nums[idx];
    if (me.number !== myNum) {
      const existingClue =
        typeof me.clue1 === "string" ? (me.clue1 as string) : "";
      const nextReady = existingClue.trim().length > 0;
      await updateDoc(doc(db!, "rooms", roomId, "players", uid), {
        number: myNum,
        clue1: existingClue,
        ready: nextReady,
        orderIndex: 0,
      });
    }
  }
}

export async function updateLastActive(roomId: string) {
  await updateDoc(doc(db!, "rooms", roomId), {
    lastActiveAt: serverTimestamp(),
  });
}

export async function joinRoomFully({
  roomId,
  uid,
  displayName,
  notifyChat = true,
}: {
  roomId: string;
  uid: string;
  displayName: string | null | undefined;
  notifyChat?: boolean;
}): Promise<EnsureMemberResult> {
  const created = await ensureMember({ roomId, uid, displayName });
  const inProgress =
    "reason" in created && created.reason === "inProgress";
  if (inProgress) {
    logWarn("roomService", "joinRoomFully-blocked-in-progress", {
      roomId,
      uid,
    });
    throw new RoomServiceError("ROOM_IN_PROGRESS");
  }

  await addLateJoinerToDeal(roomId, uid).catch(() => void 0);
  await assignNumberIfNeeded(roomId, uid).catch(() => void 0);
  await updateLastActive(roomId).catch(() => void 0);

  if (notifyChat && created.joined) {
    try {
      const { addDoc, collection, serverTimestamp } = await import(
        "firebase/firestore"
      );
      await addDoc(collection(db!, "rooms", roomId, "chat"), {
        sender: "system",
        text: `${displayName || "匿名"} さんが参加しました`,
        createdAt: serverTimestamp(),
      });
    } catch {}
  }
  await cleanupDuplicatePlayerDocs(roomId, uid).catch(() => void 0);
  const { logInfo } = await import("@/lib/utils/log");
  logInfo("room-service", "joinRoomFully-complete", {
    roomId,
    uid,
    joined: created.joined,
    notifyChat,
  });
  return created;
}

async function recoverFromPermissionDenied(error: unknown, reason: string) {
  const code =
    (error as FirestoreError)?.code ??
    ((error as { code?: string })?.code ?? null);
  if (code === "permission-denied") {
    await ensureAuthSession(reason);
  }
}
