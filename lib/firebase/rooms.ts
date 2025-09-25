import { sendSystemMessage } from "@/lib/firebase/chat";
import { auth, db } from "@/lib/firebase/client";
import { presenceSupported } from "@/lib/firebase/presence";
import { logWarn } from "@/lib/utils/log";
import { acquireLeaveLock, releaseLeaveLock } from "@/lib/utils/leaveManager";
import type { PlayerDoc, RoomOptions } from "@/lib/types";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

const ROOM_TTL_MS = 60 * 60 * 1000; // 60分で自動削除（未使用時のTTL想定）

export async function setRoomOptions(roomId: string, options: RoomOptions) {
  await updateDoc(doc(db!, "rooms", roomId), { options });
}

export async function updateLastActive(roomId: string) {
  await updateDoc(doc(db!, "rooms", roomId), {
    lastActiveAt: serverTimestamp(),
  });
}

export async function transferHost(roomId: string, newHostId: string) {
  await updateDoc(doc(db!, "rooms", roomId), { hostId: newHostId });
}

export async function leaveRoom(
  roomId: string,
  userId: string,
  displayName: string | null | undefined
) {
  if (!acquireLeaveLock(roomId, userId)) {
    logWarn("rooms", "leave-room-duplicate-request", { roomId, userId });
    return;
  }

  try {
    try {
      if (presenceSupported()) {
        const { forceDetachAll } = await import("@/lib/firebase/presence");
        await forceDetachAll(roomId, userId);
      }
    } catch {}

    if (db) {
      try {
        await deleteDoc(doc(db, "rooms", roomId, "players", userId));
      } catch {}
    }

    let token: string | null = null;
    try {
      const rawToken = await auth?.currentUser?.getIdToken(true);
      token = rawToken ?? null;
    } catch (error) {
      logWarn("rooms", "leave-room-token-failed", error);
    }

    if (!token) {
      logWarn("rooms", "leave-room-missing-token", { roomId, userId });
      return;
    }

    try {
      const response = await fetch(`/api/rooms/${roomId}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: userId, token, displayName }),
        keepalive: true,
      });
      if (!response.ok) {
        logWarn("rooms", "leave-room-server-failed", {
          roomId,
          userId,
          status: response.status,
        });
      }
    } catch (error) {
      logWarn("rooms", "leave-room-server-error", error);
    }
  } finally {
    releaseLeaveLock(roomId, userId);
  }
}
export async function resetRoomToWaiting(roomId: string, opts?: { force?: boolean }) {
  const roomRef = doc(db!, "rooms", roomId);
  const snap = await getDoc(roomRef);
  if (!snap.exists()) return;
  const room: any = snap.data();
  const status = room?.status;
  // 進行中は原則禁止（誤タップや遅延UIからの誤操作防止）
  if (!opts?.force && (status === "clue" || status === "reveal")) {
    throw new Error("進行中はリセットできません");
  }
  await updateDoc(roomRef, {
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
  });

  // 参加者の一時状態も初期化（ホスト操作時に全員分を安全にクリア）
  try {
    const playersRef = collection(db!, "rooms", roomId, "players");
    const snap = await getDocs(playersRef);
    const batch = writeBatch(db!);
    snap.forEach((d) => {
      batch.update(d.ref, {
        number: null,
        clue1: "",
        ready: false,
        orderIndex: 0,
      });
    });
    await batch.commit();
  } catch (e) {
    // クリア失敗は致命的ではないためログのみに留める
    logWarn("rooms", "reset-room-reset-players-failed", e);
  }
}

// リセット＋在席者のみでやり直し（チャット告知オプション）
export async function resetRoomWithPrune(
  roomId: string,
  keepIds: string[] | null | undefined,
  opts?: { notifyChat?: boolean }
) {
  const roomRef = doc(db!, "rooms", roomId);
  let removedCount: number | null = null;
  let keptCount: number | null = null;
  let prevTotal: number | null = null;
  await runTransaction(db!, async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) return;
    const room: any = snap.data();
    const prevRound: string[] | null = Array.isArray(room?.deal?.players)
      ? (room.deal.players as string[])
      : null;
    const keepArr = Array.isArray(keepIds) ? keepIds : [];
    if (prevRound && prevRound.length > 0) {
      prevTotal = prevRound.length;
      const keep = new Set(keepArr);
      keptCount = prevRound.filter((id) => keep.has(id)).length;
      removedCount = prevTotal - keptCount;
    } else {
      // 前ラウンドが存在しない（waiting中など）の場合は、在席数のみを表示用に保持
      prevTotal = null;
      keptCount = keepArr.length;
      removedCount = null;
    }
    // リセット本体
    tx.update(roomRef, {
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
    });
  });

  // プレイヤーの連想ワードと状態もクリア（「リセット」ボタン用）
  try {
    const playersRef = collection(db!, "rooms", roomId, "players");
    const snap = await getDocs(playersRef);
    const batch = writeBatch(db!);
    let updateCount = 0;
    snap.forEach((d) => {
      batch.update(d.ref, {
        number: null,
        clue1: "", // 🚨 連想ワードをクリア
        ready: false,
        orderIndex: 0,
      });
      updateCount++;
    });
    await batch.commit();
  } catch (e) {
    console.error("❌ resetRoomWithPrune: プレイヤー状態クリア失敗", e);
    logWarn("rooms", "reset-room-with-prune-players-failed", e);
  }

  // 任意のチャット告知（軽量）
  // チャット告知は「だれかを除外した」ときのみ（連投で会話を圧迫しないため）
  if (opts?.notifyChat && removedCount != null && removedCount > 0) {
    try {
      const kept = keptCount ?? 0;
      const prev = prevTotal ?? kept + removedCount;
      await sendSystemMessage(
        roomId,
        `ホストが在席者だけでリセットしました：前回${prev}→今回${kept}（離脱${removedCount}）`
      );
    } catch {}
  }
}


