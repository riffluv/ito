import { sendSystemMessage } from "@/lib/firebase/chat";
import { db } from "@/lib/firebase/client";
import { fetchPresenceUids, presenceSupported } from "@/lib/firebase/presence";
import {
  HostManager,
  buildHostPlayerInputsFromSnapshots,
} from "@/lib/host/HostManager";
import { logWarn } from "@/lib/utils/log";
import { acquireLeaveLock, releaseLeaveLock } from "@/lib/utils/leaveManager";
import type { PlayerDoc, RoomOptions } from "@/lib/types";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  deleteField,
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

    try {
      const dupQ = query(
        collection(db!, "rooms", roomId, "players"),
        where("uid", "==", userId)
      );
      const dupSnap = await getDocs(dupQ);
      const ids = new Set<string>(dupSnap.docs.map((d) => d.id));
      ids.add(userId);
      await Promise.all(
        Array.from(ids).map(async (id) => {
          try {
            await deleteDoc(doc(db!, "rooms", roomId, "players", id));
          } catch {}
        })
      );
    } catch {
      try {
        await deleteDoc(doc(db!, "rooms", roomId, "players", userId));
      } catch {}
    }

    const presenceIds = new Set<string>();
    if (presenceSupported()) {
      try {
        const uids = await fetchPresenceUids(roomId);
        for (const id of uids) {
          if (typeof id !== "string") continue;
          const trimmed = id.trim();
          if (trimmed && trimmed !== userId) {
            presenceIds.add(trimmed);
          }
        }
      } catch {}
    }

    let transferredTo: string | null = null;
    let transferredToName: string | null = null;
    let hostCleared = false;
    let remainingCount = 0;

    try {
      const roomRef = doc(db!, "rooms", roomId);
      await runTransaction(db!, async (tx) => {
        const snap = await tx.get(roomRef);
        if (!snap.exists()) return;
        const roomData = snap.data() as any;
        const currentHostId =
          typeof roomData?.hostId === "string" && roomData.hostId.trim()
            ? roomData.hostId.trim()
            : null;

        const playersRef = collection(db!, "rooms", roomId, "players");
        const playersSnap = await tx.get(playersRef);
        const playerDocs = playersSnap.docs;
        remainingCount = playerDocs.length;

        const origPlayers: string[] = Array.isArray(roomData?.deal?.players)
          ? [...(roomData.deal.players as string[])]
          : [];
        const filteredPlayers = origPlayers.filter((id) => id !== userId);

        const origList: string[] = Array.isArray(roomData?.order?.list)
          ? [...(roomData.order.list as string[])]
          : [];
        const filteredList = origList.filter((id) => id !== userId);

        const origProposal: (string | null)[] = Array.isArray(roomData?.order?.proposal)
          ? [...(roomData.order.proposal as (string | null)[])]
          : [];
        const filteredProposal = origProposal.filter((id) => id !== userId);

        const updates: Record<string, any> = {};

        if (origPlayers.length !== filteredPlayers.length) {
          updates["deal.players"] = filteredPlayers;
          updates["order.total"] = filteredPlayers.length;
        }
        if (origList.length !== filteredList.length) {
          updates["order.list"] = filteredList;
        }
        if (origProposal.length !== filteredProposal.length) {
          updates["order.proposal"] = filteredProposal;
        }

        const playerInputs = buildHostPlayerInputsFromSnapshots({
          docs: playerDocs,
          getJoinedAt: (docSnap) => {
            const data = docSnap.data() as any;
            const raw = data?.joinedAt;
            if (raw && typeof raw.toMillis === "function") {
              try {
                return raw.toMillis();
              } catch {
                return null;
              }
            }
            return null;
          },
          getOrderIndex: (docSnap) => {
            const data = docSnap.data() as any;
            return typeof data?.orderIndex === "number" ? data.orderIndex : null;
          },
          getLastSeenAt: (docSnap) => {
            const data = docSnap.data() as any;
            const raw = data?.lastSeen;
            if (raw && typeof raw.toMillis === "function") {
              try {
                return raw.toMillis();
              } catch {
                return null;
              }
            }
            return null;
          },
          getName: (docSnap) => {
            const data = docSnap.data() as any;
            return typeof data?.name === "string" ? data.name : null;
          },
          onlineIds: presenceIds,
        });

        const manager = new HostManager({
          roomId,
          currentHostId,
          players: playerInputs,
          leavingUid: userId,
        });

        const decision = manager.evaluateAfterLeave();

        if (decision.action === "assign") {
          transferredTo = decision.hostId;
          const meta = manager.getPlayerMeta(decision.hostId);
          const trimmedName =
            meta?.name && typeof meta.name === "string" ? meta.name.trim() : "";
          transferredToName = trimmedName || null;
          updates.hostId = decision.hostId;
          updates.hostName = trimmedName ? trimmedName : deleteField();
        } else if (decision.action === "clear") {
          updates.hostId = "";
          updates.hostName = deleteField();
          hostCleared = true;
        }

        if (Object.keys(updates).length > 0) {
          tx.update(roomRef, updates);
        }
      });
    } catch (error) {
      logWarn("rooms", "leave-room-update-failed", error);
    }

    const safeDisplayName =
      typeof displayName === "string" && displayName.trim().length > 0
        ? displayName.trim()
        : "Player";
    await sendSystemMessage(
      roomId,
      `[system] ${safeDisplayName} left the room.`
    );

    if (transferredTo) {
      try {
        let nextHostName: string = transferredToName || transferredTo;
        if (!transferredToName) {
          try {
            const pSnap = await getDoc(
              doc(db!, "rooms", roomId, "players", transferredTo)
            );
            const nm = (pSnap.data() as any)?.name;
            if (typeof nm === "string" && nm.trim()) {
              nextHostName = nm.trim();
            }
          } catch {}
        }
        await sendSystemMessage(
          roomId,
          `[system] Host role moved to ${nextHostName}.`
        );
      } catch {}
      return;
    }

    if (hostCleared && remainingCount === 0) {
      try {
        await resetRoomToWaiting(roomId, { force: true });
        await sendSystemMessage(
          roomId,
          "[system] Room is empty. Resetting game state."
        );
      } catch (error) {
        logWarn("rooms", "auto-reset-empty-room-failed", error);
      }
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




