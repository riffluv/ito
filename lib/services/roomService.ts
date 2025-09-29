import { db } from "@/lib/firebase/client";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { AVATAR_LIST, getAvatarByOrder } from "@/lib/utils";
import { logWarn } from "@/lib/utils/log";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

const AVATAR_CACHE_TTL_MS = 30_000;
type AvatarCacheEntry = {
  used: Set<string>;
  expiresAt: number;
};

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
  typeof value === "string" && ROOM_ERROR_CODES.includes(value as any);

export const getRoomServiceErrorCode = (
  error: unknown
): RoomServiceErrorCode | null => {
  if (error instanceof RoomServiceError) {
    return error.code;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    isRoomServiceErrorCode((error as any).code)
  ) {
    return (error as { code: RoomServiceErrorCode }).code;
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
    if (!isHost && status && status !== "waiting") {
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
    };
    await setDoc(meRef, p);
    registerAvatarUsage(roomId, selectedAvatar);
    return { joined: true } as const;
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
  const snap = await getDoc(roomRef);
  if (!snap.exists()) return;
  const data = snap.data() as RoomDoc & any;
  const deal = data?.deal || null;
  const playersArr: string[] = Array.isArray(deal?.players)
    ? (deal.players as string[])
    : [];
  if (!playersArr.includes(uid)) playersArr.push(uid);

  const patch: any = { deal: { ...(deal || {}), players: playersArr } };
  if (data?.status === "clue") {
    const total =
      typeof data?.order?.total === "number"
        ? data.order.total + 1
        : playersArr.length;
    patch.order = { ...(data?.order || {}), total };
  }
  await updateDoc(roomRef, patch);
}

export async function assignNumberIfNeeded(
  roomId: string,
  uid: string,
  roomFromState?: Partial<RoomDoc> | null
) {
  const roomRef = doc(db!, "rooms", roomId);
  const [roomData, meSnap] = await Promise.all([
    (async () => {
      if (roomFromState && (roomFromState as any).deal)
        return roomFromState as any;
      const s = await getDoc(roomRef);
      return s.exists() ? (s.data() as any) : null;
    })(),
    getDoc(doc(db!, "rooms", roomId, "players", uid)),
  ]);
  if (!roomData || !meSnap.exists()) return;
  const room: any = roomData;
  const me: any = meSnap.data();
  const deal = room?.deal || null;
  if (!deal) return;

  const min = deal.min || 1;
  const max = deal.max || 100;

  if (room.status === "clue") {
    if (!Array.isArray(deal.players)) return;
    const idx = (deal.players as string[]).indexOf(uid);
    if (idx < 0) return;
    // プレイヤー数とseedのみに依存する決定的な番号
    const { generateDeterministicNumbers } = await import("@/lib/game/random");
    const nums = generateDeterministicNumbers(
      deal.players.length,
      min,
      max,
      deal.seed
    );
    const myNum = nums[idx];
    if (me.number !== myNum) {
      await updateDoc(doc(db!, "rooms", roomId, "players", uid), {
        number: myNum,
        clue1: me.clue1 || "",
        ready: false,
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
  if ((created as any)?.reason === "inProgress") {
    throw new RoomServiceError("ROOM_IN_PROGRESS");
  }
  if (created.joined) {
    await addLateJoinerToDeal(roomId, uid).catch(() => void 0);
    await assignNumberIfNeeded(roomId, uid).catch(() => void 0);
    await updateLastActive(roomId).catch(() => void 0);
    if (notifyChat) {
      try {
        const { addDoc, collection, serverTimestamp } = await import(
          "firebase/firestore"
        );
        await addDoc(collection(db!, "rooms", roomId, "chat"), {
          sender: "system",
          text: `${displayName || "匿名"} さんが参加しました`,
          createdAt: serverTimestamp(),
        } as any);
      } catch {}
    }
  }
  await cleanupDuplicatePlayerDocs(roomId, uid).catch(() => void 0);
  return created;
}
