import {
  FieldValue,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";

import { HostManager, buildHostPlayerInputsFromSnapshots } from "@/lib/host/HostManager";
import { applyOutcomeToRoomStats } from "@/lib/game/domain";
import { getAdminDb, getAdminRtdb } from "@/lib/server/firebaseAdmin";
import {
  resolveSystemPlayerName,
  systemMessageHostTransferred,
  systemMessagePlayerLeft,
} from "@/lib/server/systemMessages";
import type { PlayerDoc, PlayerSnapshot, RoomDoc } from "@/lib/types";
import { logDebug, logWarn } from "@/lib/utils/log";

import { fetchPresenceUids, forceDetachAll } from "./presence";
import { sendSystemMessage } from "./systemChat";
import { composeWaitingResetPayload } from "./waitingReset";
import {
  collectSnapshotReferenceIds,
  pruneLeaveDedupeEntries,
  retainOrderSnapshots,
} from "./leaveRoomAndTransfer/helpers";

type RoomUpdateMap = Record<string, unknown>;

type LeaveRoomClueContext = {
  room: RoomDoc | undefined;
  updates: RoomUpdateMap;
  filteredPlayers: string[];
  filteredList: string[];
  filteredProposal: (string | null)[];
  remainingCount: number;
};

const MAX_RETAINED_ORDER_SNAPSHOTS = 32;

function applyCluePhaseAdjustments({
  room,
  updates,
  filteredPlayers,
  filteredList,
  filteredProposal,
  remainingCount,
}: LeaveRoomClueContext) {
  if (room?.status !== "clue") return;

  if (filteredPlayers.length !== (room?.deal?.players?.length ?? 0)) {
    updates["deal.players"] = filteredPlayers;
    updates["order.total"] = filteredPlayers.length;
    const seatHistorySource = (room?.deal as Record<string, unknown>)?.seatHistory;
    const baseSeatHistory: Record<string, number> =
      seatHistorySource && typeof seatHistorySource === "object"
        ? { ...(seatHistorySource as Record<string, number>) }
        : {};
    const nextSeatHistory: Record<string, number> = { ...baseSeatHistory };
    filteredPlayers.forEach((pid, index) => {
      nextSeatHistory[pid] = index;
    });
    updates["deal.seatHistory"] = nextSeatHistory;
  }

  if (filteredList.length !== (room?.order?.list?.length ?? 0)) {
    updates["order.list"] = filteredList;
  }

  if (filteredProposal.length !== (room?.order?.proposal?.length ?? 0)) {
    updates["order.proposal"] = filteredProposal;
  }

  const allowContinue =
    typeof room?.options?.allowContinueAfterFail === "boolean"
      ? !!room.options.allowContinueAfterFail
      : true;

  const currentOrderTotal =
    typeof updates["order.total"] === "number"
      ? updates["order.total"]
      : typeof room?.order?.total === "number"
        ? room.order.total
        : null;

  const nextTotal =
    typeof currentOrderTotal === "number" && Number.isFinite(currentOrderTotal)
      ? currentOrderTotal
      : filteredPlayers.length;

  const nextFailed =
    typeof updates["order.failed"] === "boolean"
      ? !!updates["order.failed"]
      : !!room?.order?.failed;

  const nextListLength = filteredList.length;

  const shouldFinishByTotal =
    remainingCount > 0 &&
    typeof nextTotal === "number" &&
    Number.isFinite(nextTotal) &&
    nextTotal > 0 &&
    nextListLength >= nextTotal;

  const shouldFinishByFailure = remainingCount > 0 && nextFailed && !allowContinue;

  if (shouldFinishByTotal || shouldFinishByFailure) {
    const revealSuccess = !nextFailed;
    const serverNow = FieldValue.serverTimestamp();
    updates.status = "reveal";
    updates.result = {
      success: revealSuccess,
      failedAt:
        typeof updates["order.failedAt"] === "number"
          ? updates["order.failedAt"]
          : typeof room?.order?.failedAt === "number"
            ? room.order.failedAt
            : null,
      lastNumber:
        typeof updates["order.lastNumber"] === "number"
          ? updates["order.lastNumber"]
          : typeof room?.order?.lastNumber === "number"
            ? room.order.lastNumber
            : null,
      revealedAt: serverNow,
    };
    updates.stats = applyOutcomeToRoomStats(room?.stats, revealSuccess ? "success" : "failure");
    updates["order.decidedAt"] = serverNow;
    if (!("order.total" in updates) && typeof nextTotal === "number") {
      updates["order.total"] = nextTotal;
    }
    if (!("order.failed" in updates)) {
      updates["order.failed"] = nextFailed;
    }
    updates.lastActiveAt = serverNow;
  }
}

async function getPlayerName(roomId: string, playerId: string): Promise<string> {
  try {
    const snap = await getAdminDb()
      .collection("rooms")
      .doc(roomId)
      .collection("players")
      .doc(playerId)
      .get();
    const player = snap.data() as PlayerDoc | undefined;
    const name = player?.name;
    if (typeof name === "string" && name.trim()) return name.trim();
  } catch {}
  return playerId;
}

const LEAVE_DEDUPE_WINDOW_MS = 4_000;
const LEAVE_DEDUPE_PRUNE_MS = 60_000;

export async function leaveRoomServer(
  roomId: string,
  userId: string,
  displayName: string | null | undefined
) {
  const db = getAdminDb();
  const rtdb = getAdminRtdb();

  await forceDetachAll(roomId, userId, rtdb);

  const playersRef = db.collection("rooms").doc(roomId).collection("players");
  let recordedPlayerName: string | null = null;
  let hadPlayerSnapshot = false;
  let removedPlayerData: Partial<PlayerDoc> | null = null;

  try {
    const primarySnap = await playersRef.doc(userId).get();
    const duplicatesSnap = await playersRef.where("uid", "==", userId).get();
    const seenIds = new Set<string>();
    const batch = db.batch();

    const pushDoc = (doc: DocumentSnapshot) => {
      if (seenIds.has(doc.id)) return;
      seenIds.add(doc.id);
      const data = doc.data() as PlayerDoc | undefined;
      if (data && !removedPlayerData) {
        removedPlayerData = { ...data };
      }
      const value = data?.name;
      if (!recordedPlayerName && typeof value === "string" && value.trim()) {
        recordedPlayerName = value.trim();
      }
      batch.delete(doc.ref);
    };

    if (primarySnap.exists) {
      hadPlayerSnapshot = true;
      pushDoc(primarySnap);
    }

    duplicatesSnap.forEach((doc) => {
      hadPlayerSnapshot = true;
      pushDoc(doc);
    });

    if (!seenIds.has(userId)) {
      batch.delete(playersRef.doc(userId));
    }

    await batch.commit();
  } catch {}

  const presenceIds = new Set<string>();
  if (rtdb) {
    try {
      const currentOnline = await fetchPresenceUids(roomId, rtdb);
      for (const onlineUid of currentOnline) {
        if (typeof onlineUid !== "string") continue;
        const trimmed = onlineUid.trim();
        if (trimmed && trimmed !== userId) {
          presenceIds.add(trimmed);
        }
      }
    } catch {}
  }

  let transferredTo: string | null = null;
  let transferredToName: string | null = null;
  let remainingCount = 0;

  try {
    const roomRef = db.collection("rooms").doc(roomId);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists) return;
      const room = snap.data() as RoomDoc | undefined;
      const currentHostId =
        typeof room?.hostId === "string" && room.hostId.trim() ? room.hostId.trim() : null;

      const playersSnap = await tx.get(roomRef.collection("players"));
      const playerDocs = playersSnap.docs as QueryDocumentSnapshot<PlayerDoc>[];
      remainingCount = playerDocs.length;

      const origPlayers: string[] = Array.isArray(room?.deal?.players) ? [...room.deal.players] : [];
      const filteredPlayers = origPlayers.filter((id) => id !== userId);

      const origList: string[] = Array.isArray(room?.order?.list) ? [...room.order.list] : [];
      const filteredList = origList.filter((id) => id !== userId);

      const origProposal: (string | null)[] = Array.isArray(room?.order?.proposal)
        ? [...room.order.proposal]
        : [];
      const filteredProposal = origProposal.filter((id) => id !== userId);

      const updates: RoomUpdateMap = {};

      applyCluePhaseAdjustments({
        room,
        updates,
        filteredPlayers,
        filteredList,
        filteredProposal,
        remainingCount,
      });

      let snapshotWorkingMap: Record<string, PlayerSnapshot> | null =
        room?.order?.snapshots && typeof room.order.snapshots === "object"
          ? { ...(room.order.snapshots as Record<string, PlayerSnapshot>) }
          : null;

      const snapshotReferenceIds = collectSnapshotReferenceIds({
        list: room?.order?.list,
        proposal: room?.order?.proposal,
      });

      const shouldCaptureSnapshot =
        (room?.status === "reveal" || room?.status === "finished") &&
        remainingCount > 0 &&
        removedPlayerData;

      if (shouldCaptureSnapshot) {
        const snapshotPayload: PlayerSnapshot = {
          name:
            typeof removedPlayerData?.name === "string" && removedPlayerData.name.trim()
              ? removedPlayerData.name
              : "退室したプレイヤー",
          avatar:
            typeof removedPlayerData?.avatar === "string" && removedPlayerData.avatar.trim()
              ? removedPlayerData.avatar
              : "/avatars/knight1.webp",
          clue1: typeof removedPlayerData?.clue1 === "string" ? removedPlayerData.clue1 : "",
          number:
            typeof removedPlayerData?.number === "number" && Number.isFinite(removedPlayerData.number)
              ? removedPlayerData.number
              : null,
        };
        snapshotWorkingMap = snapshotWorkingMap ?? {};
        snapshotWorkingMap[userId] = snapshotPayload;
        snapshotReferenceIds.add(userId);
      }

      if (snapshotWorkingMap) {
        const retained = retainOrderSnapshots({
          snapshots: snapshotWorkingMap,
          referenceIds: snapshotReferenceIds,
          maxRetained: MAX_RETAINED_ORDER_SNAPSHOTS,
        });
        if (retained) {
          updates["order.snapshots"] = retained;
        } else if (room?.order?.snapshots) {
          updates["order.snapshots"] = FieldValue.delete();
        }
      }

      if (remainingCount === 0) {
        const serverNow = FieldValue.serverTimestamp();
        delete updates["deal.players"];
        delete updates["deal.seatHistory"];
        delete updates["order.total"];
        delete updates["order.list"];
        delete updates["order.proposal"];
        delete updates["order.failed"];
        delete updates["order.failedAt"];
        delete updates["order.decidedAt"];
        delete updates["order.snapshots"];
        Object.assign(updates, composeWaitingResetPayload({ recallOpen: true }));
        updates.lastActiveAt = serverNow;
        logDebug("rooms", "recall-open-reset", {
          roomId,
          reason: "empty-room-after-leave",
        });
      }

      const playerInputs = buildHostPlayerInputsFromSnapshots({
        docs: playerDocs,
        getJoinedAt: (doc) => (doc.createTime ? doc.createTime.toMillis() : null),
        getOrderIndex: (doc) => {
          const data = doc.data() as PlayerDoc;
          return typeof data?.orderIndex === "number" ? data.orderIndex : null;
        },
        getName: (doc) => {
          const data = doc.data() as PlayerDoc;
          return typeof data?.name === "string" ? data.name : null;
        },
        onlineIds: presenceIds,
      });

      const hostLeaving = currentHostId ? currentHostId === userId : false;
      const hostStillRegistered = currentHostId
        ? playerDocs.some((doc) => doc.id === currentHostId)
        : false;

      if (!hostLeaving && hostStillRegistered) {
        if (Object.keys(updates).length > 0) {
          tx.update(roomRef, updates);
        }
        return;
      }

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
        const trimmedName = meta?.name && typeof meta.name === "string" ? meta.name.trim() : "";
        transferredToName = trimmedName || null;
        updates.hostId = decision.hostId;
        updates.hostName = trimmedName ? trimmedName : FieldValue.delete();
      } else if (decision.action === "clear") {
        updates.hostId = "";
        updates.hostName = FieldValue.delete();
      }

      if (Object.keys(updates).length > 0) {
        tx.update(roomRef, updates);
      }
    });
  } catch (error) {
    logWarn("rooms", "leave-room-server-transaction-failed", error);
  }

  const resolvedDisplayName =
    resolveSystemPlayerName(displayName) ?? resolveSystemPlayerName(recordedPlayerName);

  let skipNotification = false;
  try {
    const db = getAdminDb();
    const dedupeRef = db.collection("rooms").doc(roomId).collection("meta").doc("leaveDedup");

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(dedupeRef);
      const now = Date.now();
      const data = (snap.data() as { entries?: Record<string, number> } | undefined) || {};
      const rawEntries =
        data && typeof data.entries === "object" && data.entries
          ? (data.entries as Record<string, number>)
          : {};
      const next = pruneLeaveDedupeEntries({
        rawEntries,
        now,
        pruneMs: LEAVE_DEDUPE_PRUNE_MS,
        windowMs: LEAVE_DEDUPE_WINDOW_MS,
        userId,
      });
      skipNotification = skipNotification || next.skipNotification;
      tx.set(dedupeRef, { entries: next.entries }, { merge: true });
    });
  } catch (error) {
    logWarn("rooms", "leave-room-dedupe-failed", error);
  }

  if (skipNotification) {
    logDebug("rooms", "leave-room-skip-duplicate-window", {
      roomId,
      userId,
    });
  } else if (!resolvedDisplayName && !hadPlayerSnapshot) {
    logDebug("rooms", "leave-room-skip-duplicate", {
      roomId,
      userId,
    });
  } else {
    await sendSystemMessage(roomId, systemMessagePlayerLeft(resolvedDisplayName));
  }

  if (transferredTo) {
    try {
      const nextHostName = transferredToName || (await getPlayerName(roomId, transferredTo));
      await sendSystemMessage(roomId, systemMessageHostTransferred(nextHostName));
    } catch {}
    logDebug("rooms", "host-leave transferred-direct", {
      roomId,
      leavingUid: userId,
      transferredTo,
    });
    return;
  }

  // 自動リセット機能を削除: 全員がpruneされた時に勝手にリセットすると混乱を招く
  // ホストが復帰すれば手動でリセットできる（以前は hostCleared && remainingCount === 0 で実行）
  // if (remainingCount === 0) {
  //   try {
  //     await resetRoomToWaiting(roomId);
  //     logDebug("rooms", "host-leave fallback-reset", {
  //       roomId,
  //       leavingUid: userId,
  //     });
  //   } catch (error) {
  //     logWarn("rooms", "leave-room-server-reset-failed", error);
  //   }
  // }
}

export async function transferHostServer(
  roomId: string,
  currentUid: string,
  targetUid: string,
  opts: { isAdmin?: boolean } = {}
) {
  const db = getAdminDb();

  let targetName: string | null = null;

  await db.runTransaction(async (tx) => {
    const roomRef = db.collection("rooms").doc(roomId);
    const roomSnap = await tx.get(roomRef);
    if (!roomSnap.exists) {
      throw new Error("room-not-found");
    }
    const room = roomSnap.data() as RoomDoc | undefined;
    const currentHostId = typeof room?.hostId === "string" ? room.hostId.trim() : "";

    if (!opts.isAdmin && (!currentHostId || currentHostId !== currentUid)) {
      throw new Error("not-host");
    }

    const targetRef = roomRef.collection("players").doc(targetUid);
    const targetSnap = await tx.get(targetRef);
    if (!targetSnap.exists) {
      throw new Error("target-not-found");
    }

    const targetData = targetSnap.data() as PlayerDoc | undefined;
    const rawName = typeof targetData?.name === "string" ? targetData.name : null;
    const trimmed = rawName && rawName.trim().length > 0 ? rawName.trim() : "";
    targetName = rawName;

    tx.update(roomRef, {
      hostId: targetUid,
      hostName: trimmed ? trimmed : FieldValue.delete(),
    });
  });

  await sendSystemMessage(roomId, systemMessageHostTransferred(resolveSystemPlayerName(targetName)));
}
