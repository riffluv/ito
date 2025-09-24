import { FieldValue, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import type { Database } from "firebase-admin/database";
import { getAdminDb, getAdminRtdb } from "@/lib/server/firebaseAdmin";
import { logWarn } from "@/lib/utils/log";
import { shouldReassignHost } from "@/lib/host/hostRules";

const PRESENCE_STALE_MS = Number(
  process.env.NEXT_PUBLIC_PRESENCE_STALE_MS ||
    process.env.PRESENCE_STALE_MS ||
    45_000
);

const MAX_CLOCK_SKEW_MS = Number(
  process.env.NEXT_PUBLIC_PRESENCE_MAX_CLOCK_SKEW_MS ||
    process.env.PRESENCE_MAX_CLOCK_SKEW_MS ||
    30_000
);

function sanitizeServerText(input: unknown, maxLength = 500): string {
  if (typeof input !== "string") return "";
  const normalized = input
    .replace(/[\u0000-\u001F\u007F]/g, " ")
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

    const playersRef = roomRef.collection("players");
    const playersSnap = await tx.get(playersRef);
    if (playersSnap.empty) return;

    const playerDocs = playersSnap.docs;

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

    const candidateDocs = canonicalDocs.filter((doc) => onlineSet.has(doc.id));
    const effectiveDocs = candidateDocs.length > 0 ? candidateDocs : canonicalDocs;
    const remainingIds = effectiveDocs.map((doc) => doc.id);

    if (!shouldReassignHost({ currentHostId: currentHost, remainingIds })) {
      return;
    }

    const fallbackDoc = effectiveDocs.reduce(
      (best, doc) => {
        if (!best) return doc;
        const bestTime = best.createTime ? best.createTime.toMillis() : Number.MAX_SAFE_INTEGER;
        const docTime = doc.createTime ? doc.createTime.toMillis() : Number.MAX_SAFE_INTEGER;
        if (docTime !== bestTime) {
          return docTime < bestTime ? doc : best;
        }
        return doc.id < best.id ? doc : best;
      },
      null as QueryDocumentSnapshot | null
    );

    if (!fallbackDoc || fallbackDoc.id !== meDoc.id) return;

    const fallbackData = fallbackDoc.data() as any;
    const updates: Record<string, any> = { hostId: meDoc.id };
    const fallbackName =
      typeof fallbackData?.name === "string" && fallbackData.name.trim()
        ? fallbackData.name.trim()
        : null;
    if (fallbackName) {
      updates.hostName = fallbackName;
    }

    tx.update(roomRef, updates);
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

  try {
    const playersRef = db.collection("rooms").doc(roomId).collection("players");
    const dupSnap = await playersRef.where("uid", "==", userId).get();
    const batch = db.batch();
    dupSnap.forEach((doc) => batch.delete(doc.ref));
    batch.delete(playersRef.doc(userId));
    await batch.commit();
  } catch {}

  let transferredTo: string | null = null;

  try {
    const roomRef = db.collection("rooms").doc(roomId);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists) return;
      const room = snap.data() as any;

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

      if (room?.hostId === userId) {
        let nextHost: string | null = filteredPlayers.length > 0 ? filteredPlayers[0]! : null;
        if (nextHost && rtdb) {
          try {
            const online = await fetchPresenceUids(roomId, rtdb);
            const prefer = filteredPlayers.find((id) => online.includes(id));
            if (prefer) nextHost = prefer;
          } catch {}
        }
        if (nextHost) {
          updates.hostId = nextHost;
          transferredTo = nextHost;
        } else {
          updates.hostId = FieldValue.delete();
          transferredTo = null;
        }
      }

      if (Object.keys(updates).length > 0) {
        tx.update(roomRef, updates);
      }
    });
  } catch (error) {
    logWarn("rooms", "leave-room-server-transaction-failed", error);
  }

  await sendSystemMessage(
    roomId,
    `${displayName || "匿名"} さんが退出しました`
  );

  if (transferredTo) {
    try {
      const nextHostName = await getPlayerName(roomId, transferredTo);
      await sendSystemMessage(
        roomId,
        `👑 ホストが ${nextHostName} さんに委譲されました`
      );
    } catch {}
    return;
  }

  try {
    const playersSnap = await db
      .collection("rooms")
      .doc(roomId)
      .collection("players")
      .get();
    const others = playersSnap.docs.map((d) => d.id).filter((id) => id !== userId);

    let needsHost = true;
    try {
      const roomSnapshot = await db.collection("rooms").doc(roomId).get();
      if (roomSnapshot.exists) {
        console.info("[host-debug] fallback-check", { roomId, leavingUid: userId, currentHostId: roomSnapshot.data()?.hostId ?? null, rawRemaining: others });
        const data = roomSnapshot.data() as any;
        const currentHostId = typeof data?.hostId === "string" ? data.hostId.trim() : "";
        const remainingTrimmed = others.map((id) => id.trim()).filter((id) => id.length > 0);

        if (currentHostId && currentHostId !== userId && remainingTrimmed.includes(currentHostId)) {
          needsHost = false;
        } else {
          if (currentHostId && currentHostId !== userId && !remainingTrimmed.includes(currentHostId)) {
            console.warn("[host-maintain] host id missing from remaining players", { roomId, leavingUid: userId, currentHostId, remainingTrimmed, rawRemaining: others });
          }
          needsHost = shouldReassignHost({
            currentHostId,
            leavingUid: userId,
            remainingIds: remainingTrimmed,
          });
        }
      }
    } catch {}

    if (!needsHost) {
      return;
    }

    if (others.length > 0) {
      let nextHost = others[0]!;
      if (rtdb) {
        try {
          const online = await fetchPresenceUids(roomId, rtdb);
          const prefer = others.find((id) => online.includes(id));
          if (prefer) nextHost = prefer;
        } catch {}
      }
      await db.collection("rooms").doc(roomId).update({ hostId: nextHost });
      try {
        const nextHostName = await getPlayerName(roomId, nextHost);
        await sendSystemMessage(
          roomId,
          `👑 ホストが ${nextHostName} さんに委譲されました`
        );
      } catch {}
      return;
    }

    await resetRoomToWaiting(roomId);
    await sendSystemMessage(
      roomId,
      "🔄 部屋が空になったため、ゲーム状態をリセットしました"
    );
  } catch (error) {
    logWarn("rooms", "leave-room-server-fallback-failed", error);
  }
}



