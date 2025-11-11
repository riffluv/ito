import { sendSystemMessage } from "@/lib/firebase/chat";
import { auth, db } from "@/lib/firebase/client";
import { presenceSupported } from "@/lib/firebase/presence";
import { logWarn } from "@/lib/utils/log";
import { traceAction, traceError } from "@/lib/utils/trace";
import { acquireLeaveLock, releaseLeaveLock } from "@/lib/utils/leaveManager";
import type { RoomDoc, RoomOptions } from "@/lib/types";
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

type RoomUpdatePayload = Partial<RoomDoc> & Record<string, unknown>;
type RoomOrderState = NonNullable<RoomDoc["order"]>;

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

    let detail: unknown = null;
    try {
      detail = await response.json();
    } catch {}
    const code =
      detail &&
      typeof (detail as { error?: unknown }).error === "string"
        ? String((detail as { error: unknown }).error)
        : "transfer_failed";
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
      const data = snap.data() as RoomDoc | undefined;
      if (!data) return;
      const updates: RoomUpdatePayload = {};

      let dealPlayersChanged = false;
      if (data.deal && Array.isArray(data.deal.players)) {
        const filteredPlayers = data.deal.players.filter((pid) => pid !== userId);
        if (filteredPlayers.length !== data.deal.players.length) {
          const seatHistorySource = data.deal.seatHistory;
          const baseSeatHistory: Record<string, number> =
            seatHistorySource && typeof seatHistorySource === "object"
              ? { ...seatHistorySource }
              : {};
          const nextSeatHistory: Record<string, number> = { ...baseSeatHistory };
          filteredPlayers.forEach((pid, index) => {
            nextSeatHistory[pid] = index;
          });

          updates.deal = {
            ...data.deal,
            players: filteredPlayers,
            seatHistory: nextSeatHistory,
          };
          dealPlayersChanged = true;
        }
      }

      if (data.order) {
        const nextOrder: RoomOrderState = { ...(data.order as RoomOrderState) };
        let orderChanged = false;

        if (Array.isArray(data.order.list)) {
          const filteredList = data.order.list.filter((pid) => pid !== userId);
          if (filteredList.length !== data.order.list.length) {
            nextOrder.list = filteredList;
            orderChanged = true;
          }
        }

        if (Array.isArray(data.order.proposal)) {
          const filteredProposal = data.order.proposal.filter((pid) => pid !== userId);
          if (filteredProposal.length !== data.order.proposal.length) {
            nextOrder.proposal = filteredProposal;
            orderChanged = true;
          }
        }

        if (dealPlayersChanged && Array.isArray(updates.deal?.players)) {
          nextOrder.total = updates.deal?.players?.length ?? nextOrder.total;
          orderChanged = true;
        }

        if (orderChanged) {
          updates.order = nextOrder;
        }
      } else if (dealPlayersChanged && Array.isArray(updates.deal?.players)) {
        // order が存在しない場合でも total を揃えておく（古いクライアント向け）
        updates.order = {
          list: [],
          proposal: [],
          total: updates.deal?.players?.length ?? 0,
          lastNumber: null,
          failed: false,
          failedAt: null,
        };
      }

      if (data?.hostId === userId) {
        updates.hostId = "";
        (updates as Record<string, unknown>)["hostName"] = deleteField();
        const dealPlayers = Array.isArray(data?.deal?.players)
          ? (data.deal.players as string[])
          : null;
        const orderList = Array.isArray(data?.order?.list)
          ? (data.order.list as string[])
          : null;
        const updatedPlayers = Array.isArray(updates.deal?.players)
          ? updates.deal?.players ?? null
          : null;
        const updatesDealPlayers = updatedPlayers ? updatedPlayers.length : null;
        const remainingDeal =
          updatesDealPlayers !== null
            ? updatesDealPlayers
            : dealPlayers
            ? dealPlayers.filter((pid) => pid !== userId).length
            : null;
        const remainingOrder = orderList
          ? orderList.filter((pid) => pid !== userId).length
          : null;
        const shouldUnlockRecall =
          remainingDeal === 0 ||
          (remainingDeal === null && remainingOrder === 0);
        if (shouldUnlockRecall) {
          updates["ui.recallOpen"] = true;
        }
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
  const room = snap.data() as RoomDoc | undefined;
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
  const recallSpectators =
    typeof opts?.recallSpectators === "boolean" ? opts.recallSpectators : true;
  const keepArr = Array.isArray(keepIds) ? keepIds : [];
  const keepSet = new Set(keepArr);
  const roomRef = doc(db!, "rooms", roomId);

  let removedCount: number | null = null;
  let keptCount: number | null = keepArr.length;
  let prevTotal: number | null = null;

  const deriveStats = (room: RoomDoc | undefined) => {
    removedCount = null;
    keptCount = keepArr.length;
    prevTotal = null;
    const prevRound: string[] | null = Array.isArray(room?.deal?.players)
      ? (room.deal.players as string[])
      : null;
    if (prevRound && prevRound.length > 0) {
      prevTotal = prevRound.length;
      keptCount = prevRound.filter((id) => keepSet.has(id)).length;
      const diff = prevTotal - keptCount;
      removedCount = diff >= 0 ? diff : 0;
    }
  };

  try {
    const initialSnap = await getDoc(roomRef);
    if (initialSnap.exists()) {
      deriveStats(initialSnap.data() as RoomDoc | undefined);
    }
  } catch {
    // 読み取り失敗時は fallback 後に再計算される
  }

  let apiSuccess = false;
  let fallbackReason: string | null = null;

  const markFallback = (reason: string) => {
    if (!fallbackReason) {
      fallbackReason = reason;
      traceAction("resetRoomWithPrune.fallback", { roomId, reason });
    }
  };

  const currentUser = auth?.currentUser ?? null;

  const obtainToken = async (forceRefresh: boolean): Promise<string | null> => {
    if (!currentUser) return null;
    try {
      const raw = await currentUser.getIdToken(forceRefresh);
      return raw ?? null;
    } catch (error) {
      logWarn(
        "rooms",
        forceRefresh
          ? "reset-room-token-refresh-failed"
          : "reset-room-token-fetch-failed",
        error
      );
      return null;
    }
  };

  const postReset = async (token: string): Promise<Response | null> => {
    try {
      return await fetch(`/api/rooms/${roomId}/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, recallSpectators }),
        keepalive: true,
      });
    } catch (error) {
      logWarn("rooms", "reset-room-api-network-failed", error);
      markFallback("network");
      return null;
    }
  };

  if (!currentUser) {
    markFallback("auth-missing");
  } else {
    let token = await obtainToken(false);
    if (!token) {
      token = await obtainToken(true);
    }
    if (!token) {
      markFallback("auth-token");
    } else {
      let response = await postReset(token);

      if (response && response.status === 401) {
        const refreshed = await obtainToken(true);
        if (refreshed) {
          token = refreshed;
          response = await postReset(refreshed);
        } else {
          markFallback("auth-token");
        }
      }

      if (response && response.ok) {
        apiSuccess = true;
      } else if (
        response &&
        (response.status === 401 || response.status === 403 || response.status === 404)
      ) {
        const failureReason =
          response.status === 401
            ? "auth-unauthorized"
            : response.status === 403
            ? "auth-forbidden"
            : "room-not-found";
        markFallback(failureReason);
        response = null;
      } else if (!response && fallbackReason) {
        // ネットワーク系は fallback へ移行
      } else if (response) {
        let detail: unknown = null;
        try {
          detail = await response.json();
        } catch {}
        const code =
          detail &&
          typeof (detail as { error?: unknown }).error === "string"
            ? String((detail as { error: unknown }).error)
            : "reset_failed";
        throw new Error(code);
      } else {
        markFallback("network");
      }
    }
  }

  if (!apiSuccess && fallbackReason) {
    try {
      await runTransaction(db!, async (tx) => {
        const snap = await tx.get(roomRef);
        if (!snap.exists()) return;
        const room = snap.data() as RoomDoc | undefined;
        deriveStats(room);
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
          "ui.recallOpen": recallSpectators,
        });
      });
    } catch (error) {
      logWarn("rooms", "reset-room-fallback-failed", { roomId, error });
      throw error;
    }
  }

  if (apiSuccess) {
    traceAction("ui.recallOpen.set", {
      roomId,
      value: recallSpectators ? "1" : "0",
      reason: "api.reset",
    });
  } else if (fallbackReason) {
    traceAction("ui.recallOpen.set", {
      roomId,
      value: recallSpectators ? "1" : "0",
      reason: "fallback.reset",
    });
  }

  // プレイヤーの連想ワードと状態もクリア（「リセット」ボタン用）
  try {
    const playersRef = collection(db!, "rooms", roomId, "players");
    const snap = await getDocs(playersRef);
    const batch = writeBatch(db!);
    snap.forEach((d) => {
      batch.update(d.ref, {
        number: null,
        clue1: "", // 🚨 連想ワードをクリア
        ready: false,
        orderIndex: 0,
      });
    });
    await batch.commit();
  } catch (e) {
    console.error("❌ resetRoomWithPrune: プレイヤー状態クリア失敗", e);
    logWarn("rooms", "reset-room-with-prune-players-failed", e);
  }

  // 任意のチャット告知（軽量）
  // チャット告知は「だれかを除外した」ときのみ（連投で会話を圧迫しないため）
  if (opts?.notifyChat && removedCount !== null && removedCount > 0) {
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

export async function requestSpectatorRecall(roomId: string): Promise<void> {
  const currentUser = auth?.currentUser;
  if (!currentUser) {
    throw new Error("観戦者を呼び戻すにはログインが必要です。");
  }

  traceAction("spectator.recall.initiated", { roomId });

  const obtainToken = async (forceRefresh: boolean): Promise<string | null> => {
    try {
      const raw = await currentUser.getIdToken(forceRefresh);
      return raw ?? null;
    } catch (error) {
      logWarn(
        "rooms",
        forceRefresh
          ? "spectator-recall-token-refresh-failed"
          : "spectator-recall-token-fetch-failed",
        error
      );
      return null;
    }
  };

  const sendRecall = async (token: string): Promise<Response | null> => {
    try {
      return await fetch(`/api/rooms/${roomId}/spectators/recall`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        keepalive: true,
      });
    } catch (error) {
      logWarn("rooms", "spectator-recall-api-network-failed", error);
      return null;
    }
  };

  let token = await obtainToken(false);
  if (!token) {
    token = await obtainToken(true);
  }
  if (!token) {
    traceError("spectator.recall", new Error("auth-token-unavailable"), {
      roomId,
      stage: "token",
    });
    throw new Error("認証に失敗しました。時間を置いて再度お試しください。");
  }

  let response = await sendRecall(token);
  if (response && response.status === 401) {
    const refreshed = await obtainToken(true);
    if (refreshed) {
      token = refreshed;
      response = await sendRecall(refreshed);
    }
  }

  if (!response) {
    traceError("spectator.recall", new Error("network"), { roomId });
    throw new Error("観戦者の呼び戻しに失敗しました。通信状態を確認してください。");
  }

  if (!response.ok) {
    let detail: unknown = null;
    try {
      detail = await response.json();
    } catch {}
    const code =
      detail &&
      typeof (detail as { error?: unknown }).error === "string"
        ? String((detail as { error: unknown }).error)
        : "recall_failed";
    traceError("spectator.recall", new Error(code), {
      roomId,
      status: response.status,
    });
    const resolveErrorMessage = (errorCode: string): string => {
      switch (errorCode) {
        case "forbidden":
          return "ホストのみが観戦者を呼び戻せます。";
        case "not_waiting":
          return "待機中のみ観戦者を呼び戻せます。";
        case "room_not_found":
          return "ルームが見つかりませんでした。";
        case "unauthorized":
        case "auth_required":
          return "認証に失敗しました。再度ログインしてください。";
        default:
          return "観戦者の呼び戻しに失敗しました。時間を置いて再度お試しください。";
      }
    };
    throw new Error(resolveErrorMessage(code));
  }

  traceAction("spectator.recall.success", { roomId });
}
