import { auth, db } from "@/lib/firebase/client";
import { presenceSupported } from "@/lib/firebase/presence";
import { APP_VERSION } from "@/lib/constants/appVersion";
import { logWarn } from "@/lib/utils/log";
import { traceAction, traceError } from "@/lib/utils/trace";
import { acquireLeaveLock, releaseLeaveLock } from "@/lib/utils/leaveManager";
import type { RoomDoc } from "@/lib/types";
import { deleteField, deleteDoc, doc, runTransaction, serverTimestamp } from "firebase/firestore";

type RoomUpdatePayload = Partial<RoomDoc> & Record<string, unknown>;
type RoomOrderState = NonNullable<RoomDoc["order"]>;
type OrderPatch = Pick<RoomOrderState, "list" | "proposal" | "total">;

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
      body: JSON.stringify({ targetUid: newHostId, token: tok, clientVersion: APP_VERSION }),
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
  // 🚨 API が失敗したときだけ使う非常用フォールバック。通常パスは /api/rooms/[id]/leave。
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

      const cloneOrder = (source?: RoomOrderState): OrderPatch => ({
        list: Array.isArray(source?.list) ? [...source.list] : [],
        proposal: Array.isArray(source?.proposal) ? [...source.proposal] : [],
        total:
          typeof source?.total === "number" && Number.isFinite(source.total)
            ? source.total
            : 0,
      });

      if (data.order) {
        const nextOrder = cloneOrder(data.order as RoomOrderState);
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
    traceAction("leave.fallback.tx", { roomId, userId });
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
          body: JSON.stringify({ uid: userId, token, displayName, clientVersion: APP_VERSION }),
          keepalive: true,
        });
        serverHandled = response.ok;
        if (!response.ok) {
          let detail: unknown = null;
          try {
            detail = await response.json();
          } catch {}
          const code =
            detail && typeof (detail as { error?: unknown }).error === "string"
              ? String((detail as { error: unknown }).error)
              : null;
          if (
            response.status === 409 &&
            (code === "room/join/version-mismatch" || code === "client_version_required")
          ) {
            // Version Contract: do not fallback to client-side Firestore writes on explicit version guards.
            serverHandled = true;
          }
          logWarn("rooms", "leave-room-server-failed", {
            roomId,
            userId,
            status: response.status,
            code: code ?? undefined,
          });
        }
      } catch (error) {
        logWarn("rooms", "leave-room-server-error", error);
      }
    } else {
      logWarn("rooms", "leave-room-missing-token", { roomId, userId });
    }

    if (!serverHandled) {
      traceAction("leave.fallback.triggered", { roomId, userId, reason: fallbackReason(token) });
      await applyClientSideLeaveFallback(roomId, userId);
      if (db) {
        try {
          await deleteDoc(doc(db, "rooms", roomId, "players", userId));
        } catch {}
      }
    }
  } finally {
    releaseLeaveLock(roomId, userId);
  }
}

function fallbackReason(token: string | null): string {
  if (!token) return "missing-token";
  return "api-failed";
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
        body: JSON.stringify({ token, clientVersion: APP_VERSION }),
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
