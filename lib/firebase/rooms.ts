import { sendSystemMessage } from "@/lib/firebase/chat";
import { auth, db } from "@/lib/firebase/client";
import { presenceSupported } from "@/lib/firebase/presence";
import { logWarn } from "@/lib/utils/log";
import { acquireLeaveLock, releaseLeaveLock } from "@/lib/utils/leaveManager";
import type { PlayerDoc, RoomOptions } from "@/lib/types";
import {
  collection,
  deleteField,
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
  const currentUser = auth?.currentUser;
  if (!currentUser) {
    throw new Error("認証に失敗しました。ログインしなおしてください。");
  }

  const obtainToken = async (forceRefresh: boolean): Promise<string | null> => {
    try {
      const raw = await currentUser.getIdToken(forceRefresh);
      return raw ?? null;
    } catch (error) {
      logWarn(
        "rooms",
        forceRefresh
          ? "transfer-host-token-refresh-failed"
          : "transfer-host-token-fetch-failed",
        error
      );
      return null;
    }
  };

  let token = await obtainToken(false);
  if (!token) {
    token = await obtainToken(true);
  }

  if (!token) {
    throw new Error("認証に失敗しました。ログインしなおしてください。");
  }

  type TransferResult = { ok: true } | { ok: false; code: string };

  const postTransfer = async (tok: string): Promise<TransferResult> => {
    const response = await fetch(`/api/rooms/${roomId}/transfer-host`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUid: newHostId, token: tok }),
      keepalive: true,
    });

    if (response.ok) {
      return { ok: true };
    }

    let detail: any = null;
    try {
      detail = await response.json();
    } catch {}
    const code = detail?.error ? String(detail.error) : "transfer_failed";
    return { ok: false, code };
  };

  let result = await postTransfer(token);
  if (!result.ok && result.code.startsWith("auth/")) {
    const refreshed = await obtainToken(true);
    if (refreshed) {
      result = await postTransfer(refreshed);
    }
  }

  if (!result.ok) {
    throw new Error(result.code);
  }
}

async function applyClientSideLeaveFallback(roomId: string, userId: string) {
  if (!db) return;
  const roomRef = doc(db, "rooms", roomId);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) return;
      const data = snap.data() as any;
      const updates: Record<string, any> = {};

      let dealPlayersChanged = false;
      if (data?.deal && Array.isArray(data.deal.players)) {
        const filteredPlayers = (data.deal.players as string[]).filter(
          (pid) => pid !== userId
        );
        if (filteredPlayers.length !== data.deal.players.length) {
          updates.deal = { ...data.deal, players: filteredPlayers };
          dealPlayersChanged = true;
        }
      }

      if (data?.order) {
        const nextOrder: Record<string, any> = { ...data.order };
        let orderChanged = false;

        if (Array.isArray(data.order.list)) {
          const filteredList = (data.order.list as string[]).filter(
            (pid) => pid !== userId
          );
          if (filteredList.length !== data.order.list.length) {
            nextOrder.list = filteredList;
            orderChanged = true;
          }
        }

        if (Array.isArray(data.order.proposal)) {
          const filteredProposal = (data.order.proposal as (string | null)[]).filter(
            (pid) => pid !== userId
          );
          if (filteredProposal.length !== data.order.proposal.length) {
            nextOrder.proposal = filteredProposal;
            orderChanged = true;
          }
        }

        if (
          dealPlayersChanged &&
          updates.deal &&
          Array.isArray((updates.deal as any).players)
        ) {
          nextOrder.total = (updates.deal as any).players.length;
          orderChanged = true;
        }

        if (orderChanged) {
          updates.order = nextOrder;
        }
      } else if (
        dealPlayersChanged &&
        updates.deal &&
        Array.isArray((updates.deal as any).players)
      ) {
        // order が存在しない場合でも total を揃えておく（古いクライアント向け）
        updates.order = {
          list: [],
          proposal: [],
          total: (updates.deal as any).players.length,
        };
      }

      if (data?.hostId === userId) {
        updates.hostId = "";
        updates.hostName = deleteField();
      }

      if (Object.keys(updates).length > 0) {
        updates.lastActiveAt = serverTimestamp();
        tx.update(roomRef, updates);
      }
    });
  } catch (error) {
    logWarn("rooms", "leave-room-fallback-failed", { roomId, userId, error });
  }
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

    let serverHandled = false;

    if (token) {
      try {
        const response = await fetch(`/api/rooms/${roomId}/leave`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid: userId, token, displayName }),
          keepalive: true,
        });
        serverHandled = response.ok;
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
    } else {
      logWarn("rooms", "leave-room-missing-token", { roomId, userId });
    }

    if (!serverHandled) {
      await applyClientSideLeaveFallback(roomId, userId);
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
  opts?: { notifyChat?: boolean; recallSpectators?: boolean }
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
      "ui.spectatorRecall": opts?.recallSpectators === true,
      "ui.spectatorRecallAt":
        opts?.recallSpectators === true ? serverTimestamp() : deleteField(),
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

