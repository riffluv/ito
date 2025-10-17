import { FieldValue } from "firebase-admin/firestore";
import type { Database } from "firebase-admin/database";
import {
  MAX_CLOCK_SKEW_MS,
  PRESENCE_STALE_MS,
} from "@/lib/constants/presence";
import { getAdminDb, getAdminRtdb } from "@/lib/server/firebaseAdmin";
import { logWarn, logDebug } from "@/lib/utils/log";
import {
  HostManager,
  buildHostPlayerInputsFromSnapshots,
} from "@/lib/host/HostManager";
import {
  resolveSystemPlayerName,
  systemMessageHostTransferred,
  systemMessagePlayerLeft,
} from "@/lib/server/systemMessages";

function sanitizeServerText(input: unknown, maxLength = 500): string {
  if (typeof input !== "string") return "";
  // eslint-disable-next-line no-control-regex -- 制御文字を明示的に除去するためのパターン
  const controlCharsPattern = /[\u0000-\u001F\u007F]/g;
  const normalized = input
    .replace(controlCharsPattern, " ")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.slice(0, Math.max(maxLength, 0));
}

function isConnectionActive(conn: any, now: number): boolean {
  if (conn?.online === false) return false;
  if (conn?.online === true && typeof conn?.ts !== "number") return true;
  const ts = typeof conn?.ts === "number" ? conn.ts : 0;
  if (!ts) return false;
  if (ts - now > MAX_CLOCK_SKEW_MS) return false;
  return now - ts <= PRESENCE_STALE_MS;
}

async function fetchPresenceUids(roomId: string, db: Database): Promise<string[]> {
  try {
    const snap = await db.ref(`presence/${roomId}`).get();
    const val = (snap.val() || {}) as Record<string, Record<string, any>>;
    const now = Date.now();
    return Object.keys(val).filter((uid) => {
      const conns = val[uid] || {};
      return Object.values(conns).some((c) => isConnectionActive(c, now));
    });
  } catch {
    return [];
  }
}

async function forceDetachAll(roomId: string, uid: string, db: Database | null) {
  if (!db) return;
  try {
    const baseRef = db.ref(`presence/${roomId}/${uid}`);
    const snap = await baseRef.get();
    const val = snap.val() as Record<string, any> | null;
    if (!val) return;
    await Promise.all(
      Object.keys(val).map((connId) =>
        baseRef
          .child(connId)
          .remove()
          .catch(() => void 0)
      )
    );
    await baseRef.remove().catch(() => void 0);
  } catch {}
}


async function sendSystemMessage(roomId: string, text: string) {
  const clean = sanitizeServerText(text);
  if (!clean) return;
  const db = getAdminDb();
  await db
    .collection("rooms")
    .doc(roomId)
    .collection("chat")
    .add({
      sender: "system",
      uid: "system",
      text: clean,
      createdAt: FieldValue.serverTimestamp(),
    })
    .catch(() => void 0);
}

const LEAVE_DEDUPE_WINDOW_MS = 4_000;
const LEAVE_DEDUPE_PRUNE_MS = 60_000;

async function resetRoomToWaiting(roomId: string) {
  const db = getAdminDb();
  const roomRef = db.collection("rooms").doc(roomId);
  const snap = await roomRef.get();
  if (!snap.exists) return;
  await roomRef
    .update({
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
    })
    .catch(() => void 0);

  try {
    const playersSnap = await roomRef.collection("players").get();
    if (playersSnap.empty) return;
    const batch = db.batch();
    playersSnap.forEach((doc) => {
      batch.update(doc.ref, {
        number: null,
        clue1: "",
        ready: false,
        orderIndex: 0,
      });
    });
    await batch.commit();
  } catch (error) {
    logWarn("rooms", "reset-room-server-failed", error);
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
    const name = (snap.data() as any)?.name;
    if (typeof name === "string" && name.trim()) return name.trim();
  } catch {}
  return playerId;
}


export async function ensureHostAssignedServer(roomId: string, uid: string) {
  const db = getAdminDb();
  const roomRef = db.collection("rooms").doc(roomId);
  await db.runTransaction(async (tx) => {
    const roomSnap = await tx.get(roomRef);
    if (!roomSnap.exists) return;

    const room = roomSnap.data() as any;
    const currentHost =
      typeof room?.hostId === "string" && room.hostId.trim() ? room.hostId.trim() : null;

    const existingCreatorId =
      typeof room?.creatorId === "string" && room.creatorId.trim() ? room.creatorId.trim() : null;
    const existingCreatorName =
      typeof room?.creatorName === "string" && room.creatorName.trim() ? room.creatorName.trim() : null;

    const baseUpdates: Record<string, any> = {};
    if (!existingCreatorId && currentHost) {
      baseUpdates.creatorId = currentHost;
      if (typeof room?.hostName === "string" && room.hostName.trim()) {
        baseUpdates.creatorName = room.hostName.trim();
      } else if (existingCreatorName === null) {
        baseUpdates.creatorName = FieldValue.delete();
      }
    }

    const playersRef = roomRef.collection("players");
    const playersSnap = await tx.get(playersRef);
    if (playersSnap.empty) return;

    const playerDocs = playersSnap.docs;

    const normalizedHostId = currentHost ? currentHost : null;
    if (normalizedHostId && normalizedHostId !== uid) {
      const hostStillRegistered = playerDocs.some((doc) => {
        if (doc.id === normalizedHostId) return true;
        const data = doc.data() as any;
        return typeof data?.uid === "string" && data.uid === normalizedHostId;
      });
      if (hostStillRegistered) {
        if (Object.keys(baseUpdates).length > 0) {
          tx.update(roomRef, baseUpdates);
        }
        return;
      }
    }

    const meDoc =
      playerDocs.find((doc) => doc.id === uid) ||
      playerDocs.find((doc) => {
        const data = doc.data() as any;
        return typeof data?.uid === "string" && data.uid === uid;
      });
    if (!meDoc) return;

    const canonicalDocs = playerDocs.filter((doc) => {
      if (doc.id === meDoc.id) return true;
      const data = doc.data() as any;
      const sameUid = typeof data?.uid === "string" && data.uid === uid;
      if (sameUid || doc.id === uid) {
        tx.delete(doc.ref);
        return false;
      }
      return true;
    });

    const rtdb = getAdminRtdb();
    const onlineSet = new Set<string>();
    onlineSet.add(meDoc.id);
    if (meDoc.id !== uid) onlineSet.add(uid);

    if (rtdb) {
      try {
        const online = await fetchPresenceUids(roomId, rtdb);
        for (const onlineUid of online) {
          onlineSet.add(onlineUid);
        }
      } catch {}
    }

  const playerInputs = buildHostPlayerInputsFromSnapshots({
      docs: canonicalDocs,
      getJoinedAt: (doc) => (doc.createTime ? doc.createTime.toMillis() : null),
      getOrderIndex: (doc) => {
        const data = doc.data() as any;
        return typeof data?.orderIndex === "number" ? data.orderIndex : null;
      },
      getName: (doc) => {
        const data = doc.data() as any;
        return typeof data?.name === "string" ? data.name : null;
      },
      onlineIds: onlineSet,
    });

    const manager = new HostManager({
      roomId,
      currentHostId: currentHost,
      players: playerInputs,
    });

    const decision = manager.evaluateClaim(uid);

    if (decision.action !== "assign") {
      if (Object.keys(baseUpdates).length > 0) {
        tx.update(roomRef, baseUpdates);
      }
      return;
    }

    const updates: Record<string, any> = { ...baseUpdates, hostId: decision.hostId };
    const meta = manager.getPlayerMeta(decision.hostId);
    const trimmedName = meta?.name && typeof meta.name === "string" ? meta.name.trim() : "";
    if (trimmedName) {
      updates.hostName = trimmedName;
    } else {
      updates.hostName = FieldValue.delete();
    }

    tx.update(roomRef, updates);
    logDebug("rooms", "host-claim assigned-server", {
      roomId,
      uid,
      hostId: decision.hostId,
      reason: decision.reason,
    });
  });
}

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

  try {
    const primarySnap = await playersRef.doc(userId).get();
    const duplicatesSnap = await playersRef.where("uid", "==", userId).get();
    const seenIds = new Set<string>();
    const batch = db.batch();

    const pushDoc = (doc: any) => {
      if (seenIds.has(doc.id)) return;
      seenIds.add(doc.id);
      const value = (doc.data() as any)?.name;
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
  let hostCleared = false;
  let remainingCount = 0;

  try {
    const roomRef = db.collection("rooms").doc(roomId);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists) return;
      const room = snap.data() as any;
      const currentHostId =
        typeof room?.hostId === "string" && room.hostId.trim()
          ? room.hostId.trim()
          : null;

      const playersSnap = await tx.get(roomRef.collection("players"));
      const playerDocs = playersSnap.docs;
      remainingCount = playerDocs.length;

      const origPlayers: string[] = Array.isArray(room?.deal?.players)
        ? [...(room.deal.players as string[])]
        : [];
      const filteredPlayers = origPlayers.filter((id) => id !== userId);

      const origList: string[] = Array.isArray(room?.order?.list)
        ? [...(room.order.list as string[])]
        : [];
      const filteredList = origList.filter((id) => id !== userId);

      const origProposal: (string | null)[] = Array.isArray(room?.order?.proposal)
        ? [...(room.order.proposal as (string | null)[])]
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
        getJoinedAt: (doc) => (doc.createTime ? doc.createTime.toMillis() : null),
        getOrderIndex: (doc) => {
          const data = doc.data() as any;
          return typeof data?.orderIndex === "number" ? data.orderIndex : null;
        },
        getName: (doc) => {
          const data = doc.data() as any;
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
        const trimmedName =
          meta?.name && typeof meta.name === "string" ? meta.name.trim() : "";
        transferredToName = trimmedName || null;
        updates.hostId = decision.hostId;
        updates.hostName = trimmedName ? trimmedName : FieldValue.delete();
      } else if (decision.action === "clear") {
        updates.hostId = "";
        updates.hostName = FieldValue.delete();
        hostCleared = true;
      }

      if (Object.keys(updates).length > 0) {
        tx.update(roomRef, updates);
      }
    });
  } catch (error) {
    logWarn("rooms", "leave-room-server-transaction-failed", error);
  }

  const resolvedDisplayName =
    resolveSystemPlayerName(displayName) ??
    resolveSystemPlayerName(recordedPlayerName);

  let skipNotification = false;
  try {
    const db = getAdminDb();
    const dedupeRef = db
      .collection("rooms")
      .doc(roomId)
      .collection("meta")
      .doc("leaveDedup");

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(dedupeRef);
      const now = Date.now();
      const data = (snap.data() as any) || {};
      const rawEntries =
        data && typeof data.entries === "object" && data.entries
          ? (data.entries as Record<string, number>)
          : {};
      const entries: Record<string, number> = {};

      for (const key of Object.keys(rawEntries)) {
        const ts = rawEntries[key];
        if (typeof ts === "number" && now - ts <= LEAVE_DEDUPE_PRUNE_MS) {
          entries[key] = ts;
        }
      }

      const lastTs = entries?.[userId];
      if (typeof lastTs === "number" && now - lastTs < LEAVE_DEDUPE_WINDOW_MS) {
        skipNotification = true;
      }

      entries[userId] = now;
      tx.set(dedupeRef, { entries }, { merge: true });
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
      const nextHostName =
        transferredToName || (await getPlayerName(roomId, transferredTo));
      await sendSystemMessage(
        roomId,
        systemMessageHostTransferred(nextHostName)
      );
    } catch {}
    logDebug("rooms", "host-leave transferred-direct", {
      roomId,
      leavingUid: userId,
      transferredTo,
    });
    return;
  }

  // 自動リセット機能を削除: 全員がpruneされた時に勝手にリセットすると混乱を招く
  // ホストが復帰すれば手動でリセットできる
  // if (hostCleared && remainingCount === 0) {
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
    const room = roomSnap.data() as any;
    const currentHostId = typeof room?.hostId === "string" ? room.hostId.trim() : "";

    if (!opts.isAdmin && (!currentHostId || currentHostId !== currentUid)) {
      throw new Error("not-host");
    }

    const targetRef = roomRef.collection("players").doc(targetUid);
    const targetSnap = await tx.get(targetRef);
    if (!targetSnap.exists) {
      throw new Error("target-not-found");
    }

    const targetData = targetSnap.data() as any;
    const rawName = typeof targetData?.name === "string" ? targetData.name : null;
    const trimmed = rawName && rawName.trim().length > 0 ? rawName.trim() : "";
    targetName = rawName;

    tx.update(roomRef, {
      hostId: targetUid,
      hostName: trimmed ? trimmed : FieldValue.delete(),
    });
  });

  await sendSystemMessage(
    roomId,
    systemMessageHostTransferred(resolveSystemPlayerName(targetName))
  );
}



