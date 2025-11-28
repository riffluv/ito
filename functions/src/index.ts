import {
  MAX_CLOCK_SKEW_MS,
  PRESENCE_CLEANUP_INTERVAL_MS,
  PRESENCE_STALE_MS,
} from "@/lib/constants/presence";
import {
  leaveRoomServer,
  composeWaitingResetPayload,
} from "@/lib/server/roomActions";
import { systemMessagePlayerJoined } from "@/lib/server/systemMessages";
import type {
  PresenceConn,
  PresenceRoomMap,
  PresenceUserMap,
} from "@/lib/firebase/presence";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

const regionFunctions = functions.region("asia-northeast1");

// Initialize admin if not already
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const rtdb: admin.database.Database | null = admin.database
  ? admin.database()
  : null;

type FirestoreUpdateMap = Record<string, unknown>;

// 緊急停止フラグ（READ 増加時の一時対策）
// 環境変数 EMERGENCY_READS_FREEZE=1 が有効のとき、
// 以降の定期ジョブ/トリガは早期 return して何もしない
const EMERGENCY_STOP = process.env.EMERGENCY_READS_FREEZE === "1";

const PRESENCE_STALE_THRESHOLD_MS = PRESENCE_STALE_MS;
const REJOIN_GRACE_MS = Math.min(PRESENCE_STALE_THRESHOLD_MS, 20_000);
const FAST_REJOIN_GRACE_MS = Math.min(REJOIN_GRACE_MS, 2_000);

const DEBUG_LOGGING_ENABLED =
  process.env.ENABLE_FUNCTIONS_DEBUG_LOGS === "1" ||
  process.env.NODE_ENV !== "production";

const logDebug: (...args: Parameters<typeof functions.logger.debug>) => void =
  DEBUG_LOGGING_ENABLED ? (...args) => functions.logger.debug(...args) : () => {};
function toMillis(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { toMillis?: () => number }).toMillis === "function"
  ) {
    try {
      return (value as { toMillis: () => number }).toMillis();
    } catch {
      return 0;
    }
  }
  return 0;
}

/**
 * Recalculates playersCount and lastActive for a room.
 * Called after onCreate/onDelete/onUpdate of players docs.
 */
async function recalcRoomCounts(roomId: string) {
  if (!roomId) return;
  const playersColl = db.collection("rooms").doc(roomId).collection("players");

  // Count active players and compute lastSeen timestamp
  const snapshot = await playersColl.get();
  let count = 0;
  let lastSeen: admin.firestore.Timestamp | null = null;
  snapshot.forEach((doc) => {
    count += 1;
    const data = doc.data() as PlayerDoc;
    const lastSeenValue = data?.lastSeen;
    if (
      lastSeenValue &&
      typeof (lastSeenValue as admin.firestore.Timestamp).toMillis === "function"
    ) {
      const ts = lastSeenValue as admin.firestore.Timestamp;
      if (!lastSeen || ts.toMillis() > lastSeen.toMillis()) lastSeen = ts;
    }
  });

  const roomRef = db.collection("rooms").doc(roomId);
  const updates: FirestoreUpdateMap = { playersCount: count };
  if (lastSeen) updates.playersLastActive = lastSeen;

  // Use transaction for safety (ensure we don't stomp other concurrent updates)
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists) return;
    tx.update(roomRef, updates);
  });
}

// 旧 onPlayerCreate / onPlayerDelete は onPlayerCreated / onPlayerDeleted に統合

// Trigger on player update (e.g., lastSeen updates)
export const onPlayerUpdate = regionFunctions.firestore
  .document("rooms/{roomId}/players/{playerId}")
  .onUpdate(async (change, ctx) => {
    const roomId = ctx.params.roomId as string;
    const before = change.before.data() || {};
    const after = change.after.data() || {};
    // Only recalc when relevant fields change to reduce cost
    if (
      before.lastSeen?.toMillis?.() === after.lastSeen?.toMillis?.() &&
      before.lastActive === after.lastActive
    ) {
      return;
    }
    try {
      await recalcRoomCounts(roomId);
    } catch (err) {
      console.error(
        "Failed to refresh room statistics after player update",
        err
      );
    }
  });

function isPresenceConnActive(
  conn: PresenceConn | Record<string, unknown> | null | undefined,
  now: number
): boolean {
  if (!conn) return false;
  const record = conn as PresenceConn;
  if (record.online === false) return false;
  if (record.online === true && typeof record.ts !== "number") return true;
  const ts = typeof record.ts === "number" ? record.ts : 0;
  if (!ts) return false;
  if (ts - now > MAX_CLOCK_SKEW_MS) return false;
  return now - ts <= PRESENCE_STALE_THRESHOLD_MS;
}

export const onPresenceWrite = regionFunctions.database
  .ref("presence/{roomId}/{uid}/{connId}")
  .onWrite(async (change, ctx) => {
    if (EMERGENCY_STOP) return null;
    const { roomId, uid } = ctx.params as { roomId: string; uid: string };
    try {
      const after = change.after.val();
      const before = change.before.val();

      const now = Date.now();

      const afterActive = change.after.exists()
        ? isPresenceConnActive(after, now)
        : false;
      const beforeActive = change.before.exists()
        ? isPresenceConnActive(before, now)
        : false;

      if (afterActive) {
        // まだオンライン扱いなので何もしない
        return null;
      }

      // 変化がなく単純に stale な書き込みでなければスキップ
      const wentOffline = beforeActive && !afterActive;
      const removed = change.after.exists() === false && change.before.exists();
      const markedOffline = change.after.exists() && after?.online === false;

      if (!wentOffline && !removed && !markedOffline) {
        return null;
      }

      const dbi = admin.database();
      const userRef = dbi.ref(`presence/${roomId}/${uid}`);
      const snap = await userRef.get();
      const val = snap.val() as PresenceUserMap | null;
      const stillActive = val
        ? Object.values(val).some((conn) => isPresenceConnActive(conn, now))
        : false;

      if (stillActive) {
        return null;
      }

      const graceDelayMs = FAST_REJOIN_GRACE_MS;
      if (graceDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, graceDelayMs));
      }

      const recheckSnap = await userRef.get();
      const nowAfterDelay = Date.now();
      const recheckVal = recheckSnap.val() as PresenceUserMap | null;
      const activeAfterDelay = recheckVal
        ? Object.values(recheckVal).some((conn) =>
            isPresenceConnActive(conn, nowAfterDelay)
          )
        : false;

      if (activeAfterDelay) {
        logDebug("presence", "skip-leave-reconnected", {
          roomId,
          uid,
          delay: graceDelayMs,
        });
        return null;
      }

      // 完全に切断されたのでノードを掃除し、部屋から退室させる
      await userRef.remove().catch((err) => {
        console.warn("Failed to remove user from room presence", {
          roomId,
          uid,
          err,
        });
      });

      const rejoinWindowMs = Math.max(graceDelayMs, 750);

      try {
        const playerDoc = await db
          .collection("rooms")
          .doc(roomId)
          .collection("players")
          .doc(uid)
          .get();
        if (!playerDoc.exists) {
          return null;
        }

        const playerData = playerDoc.data() as PlayerDoc | undefined;
        const lastSeenMs = toMillis(playerData?.lastSeen);
        if (lastSeenMs && nowAfterDelay - lastSeenMs <= rejoinWindowMs) {
          const remaining = rejoinWindowMs - (nowAfterDelay - lastSeenMs) + 500;
          if (remaining > 0) {
            await new Promise((resolve) =>
              setTimeout(resolve, Math.min(remaining, 5_000))
            );
          }
          const postDelaySnap = await db
            .collection("rooms")
            .doc(roomId)
            .collection("players")
            .doc(uid)
            .get();
          const postDelayNow = Date.now();
          if (!postDelaySnap.exists) {
            return null;
          }
          const postData = postDelaySnap.data() as PlayerDoc | undefined;
          const postLastSeenMs = toMillis(postData?.lastSeen);
          if (
            postLastSeenMs &&
            postDelayNow - postLastSeenMs <= rejoinWindowMs
          ) {
            logDebug("presence", "skip-leave-grace", {
              roomId,
              uid,
              lastSeenMs: postLastSeenMs,
              now: postDelayNow,
              grace: rejoinWindowMs,
            });
            return null;
          }
        }

        logDebug("leaveRoomServer cleanup invoked", {
          roomId,
          uid,
          flags: { wentOffline, removed, markedOffline },
          waitedMs: graceDelayMs,
        });
        await leaveRoomServer(roomId, uid, null);
        logDebug("leaveRoomServer cleanup succeeded", { roomId, uid });
      } catch (err) {
        console.error("leaveRoomServer cleanup failed", { roomId, uid, err });
      }
    } catch (err) {
      console.error("Presence write handler failed", { roomId, uid, err });
    }
    return null;
  });

// 定期実行: expiresAt を過ぎた rooms を削除（players/chat も含めて）
export const cleanupExpiredRooms = regionFunctions.pubsub
  .schedule("every 10 minutes")
  .onRun(async (_context) => {
    if (EMERGENCY_STOP) return null;
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    const q = db.collection("rooms").where("expiresAt", "<=", now).limit(50);
    const snap = await q.get();
    if (snap.empty) return null;

    // players/chat を削除した上で room を削除
    for (const docSnap of snap.docs) {
      const roomRef = docSnap.ref;
      const playersSnap = await roomRef.collection("players").listDocuments();
      // ベストプラクティス: 誰かが居る部屋は削除しない
      if (playersSnap.length > 0) {
        // 可能なら期限を延長/クリアして誤削除を避ける（任意）
        try {
          await roomRef.update({
            lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } catch {}
        continue;
      }
      const chatSnap = await roomRef.collection("chat").listDocuments();
      if (chatSnap.length) {
        const b = db.batch();
        for (const c of chatSnap) b.delete(c);
        await b.commit();
      }
      await roomRef.delete();
    }
    return null;
  });

// 定期実行: 古いチャットの削除（14日以上前を削除）
export const pruneOldChat = regionFunctions.pubsub
  .schedule("every 24 hours")
  .onRun(async () => {
    if (EMERGENCY_STOP) return null;
    const db = admin.firestore();
    const roomsSnap = await db.collection("rooms").select().get();
    if (roomsSnap.empty) return null;
    const cutoff = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    );
    for (const room of roomsSnap.docs) {
      const chatCol = room.ref.collection("chat");
      const q = chatCol
        .where("createdAt", "<", cutoff)
        .orderBy("createdAt", "asc")
        .limit(500);
      const snap = await q.get();
      if (snap.empty) continue;
      const batch = db.batch();
      for (const d of snap.docs) batch.delete(d.ref);
      await batch.commit();
    }
    return null;
  });

/**
 * Scheduled cleanup for "ghost rooms":
 * - No active RTDB presence AND
 * - No players with recent `lastSeen` AND
 * - Not in-progress (or in-progress but stale for long time)
 * Then delete players/chat and the room itself.
 */
export const cleanupGhostRooms = regionFunctions.pubsub
  .schedule("every 15 minutes")
  .onRun(async () => {
    if (EMERGENCY_STOP) return null;
    const dbi = admin.firestore();
    const rtdb = admin.database();

    // Tunables
    const NOW = Date.now();
    const STALE_LASTSEEN_MS =
      Number(process.env.GHOST_STALE_LASTSEEN_MS) || 10 * 60 * 1000; // 10min
    const ROOM_MIN_AGE_MS =
      Number(process.env.GHOST_ROOM_MIN_AGE_MS) || 30 * 60 * 1000; // 30min
    const stalePresenceMs = PRESENCE_STALE_THRESHOLD_MS;

    // Process in small chunks to limit costs
    const roomsSnap = await dbi.collection("rooms").select().limit(100).get();
    if (roomsSnap.empty) return null;

    for (const roomDoc of roomsSnap.docs) {
      try {
        const roomId = roomDoc.id;
        const room = roomDoc.data() as RoomDoc | undefined;

        // Quick age gate: only consider sufficiently old rooms
        const lastActive = room?.lastActiveAt;
        const createdAt = room?.createdAt;
        const newerMs = Math.max(toMillis(lastActive), toMillis(createdAt));
        const ageMs = newerMs ? NOW - newerMs : Number.POSITIVE_INFINITY;
        if (ageMs < ROOM_MIN_AGE_MS) continue;

        // Skip actively playing rooms (clue/reveal), unless clearly stale
        const isInProgress =
          room?.status &&
          room.status !== "waiting" &&
          room.status !== "finished";

        // Presence count from RTDB
        let presenceCount = 0;
        try {
          const presSnap = await rtdb.ref(`presence/${roomId}`).get();
          if (presSnap.exists()) {
            const val = presSnap.val() as PresenceRoomMap | null;
            const nowLocal = Date.now();
            if (val) {
              for (const uid of Object.keys(val)) {
                const conns = val[uid] ?? {};
                const online = Object.values(conns).some((conn) => {
                  if (conn?.online === false) return false;
                  if (conn?.online === true && typeof conn?.ts !== "number") {
                    return true;
                  }
                  const ts = typeof conn?.ts === "number" ? conn.ts : 0;
                  if (!ts) return false;
                  if (ts - nowLocal > stalePresenceMs) return false;
                  return nowLocal - ts <= stalePresenceMs;
                });
                if (online) presenceCount++;
              }
            }
          }
        } catch {}

        if (presenceCount > 0) continue; // someone is online; skip

        // Count "recent" players by lastSeen
        const playersCol = roomDoc.ref.collection("players");
        const playersSnap = await playersCol.get();
        const nowTs = Date.now();
        let recentPlayers = 0;
        for (const d of playersSnap.docs) {
          const playerData = d.data() as PlayerDoc;
          const ls = playerData?.lastSeen;
          const ms = toMillis(ls);
          if (ms && nowTs - ms <= STALE_LASTSEEN_MS) recentPlayers++;
        }

        // If any recent players exist, keep the room
        if (recentPlayers > 0) continue;

        // At this point, no presence and players are stale. If still marked in-progress, relax to waiting.
        if (isInProgress) {
          try {
            await roomDoc.ref.update({ status: "waiting" });
          } catch {}
        }

        // Delete chat docs first (best effort)
        try {
          const chatRefs = await roomDoc.ref.collection("chat").listDocuments();
          if (chatRefs.length) {
            const batch = dbi.batch();
            for (const c of chatRefs) batch.delete(c);
            await batch.commit();
          }
        } catch {}

        // Delete all players (best effort)
        try {
          const playerRefs = await roomDoc.ref
            .collection("players")
            .listDocuments();
          if (playerRefs.length) {
            const batch = dbi.batch();
            for (const p of playerRefs) batch.delete(p);
            await batch.commit();
          }
        } catch {}

        // Finally, delete the room itself
        try {
          await roomDoc.ref.delete();
        } catch {}
      } catch (err) {
        console.error("Failed to clean up ghost rooms", err);
      }
    }
    return null;
  });

export const presenceCleanup = regionFunctions.pubsub
  .schedule("every 1 minutes")
  .onRun(async () => {
    if (EMERGENCY_STOP) return null;
    if (!rtdb) return null;
    const now = Date.now();
    const maxRemovals = Math.max(
      200,
      Math.ceil(PRESENCE_CLEANUP_INTERVAL_MS / 1_000) * 10
    );
    const maxRooms = 200;
    const snapshot = await rtdb.ref("presence").get();
    if (!snapshot.exists()) return null;

    let removed = 0;
    let visitedRooms = 0;
    const removals: Promise<unknown>[] = [];

    snapshot.forEach((roomSnap: admin.database.DataSnapshot) => {
      if (removed >= maxRemovals || visitedRooms >= maxRooms) {
        return true;
      }
      visitedRooms += 1;
      const roomId = roomSnap.key;
      if (!roomId) return undefined;
      const roomVal = roomSnap.val() as PresenceRoomMap | null;
      Object.entries(roomVal || {}).forEach(([uid, conns]) => {
        if (removed >= maxRemovals) return;
        if (!conns || typeof conns !== "object") return;
        Object.entries(conns as PresenceUserMap).forEach(
          ([connId, payload]) => {
            if (removed >= maxRemovals) return;
            if (isPresenceConnActive(payload as PresenceConn, now)) return;
            removed += 1;
            removals.push(
              rtdb
                .ref(`presence/${roomId}/${uid}/${connId}`)
                .remove()
                .catch((error: unknown) =>
                  console.warn("presenceCleanup remove failed", {
                    roomId,
                    uid,
                    connId,
                    error,
                  })
                )
            );
          }
        );
      });
      return undefined;
    });

    if (removals.length > 0) {
      await Promise.all(removals);
      logDebug("presence", "cleanup-removed", {
        count: removals.length,
        visitedRooms,
      });
    }
    return null;
  });

export const pruneIdleRooms = regionFunctions.pubsub
  .schedule("every 5 minutes")
  .onRun(async () => {
    if (EMERGENCY_STOP) return null;

    const dbi = admin.firestore();
    const rt = admin.database ? admin.database() : null;

    const now = Date.now();
    const envThreshold = Number(process.env.IDLE_ROOM_THRESHOLD_MS);
    const idleThresholdMs =
      Number.isFinite(envThreshold) && envThreshold > 0
        ? envThreshold
        : 5 * 60 * 1000;

    const cutoffMs = now - idleThresholdMs;
    if (cutoffMs <= 0) return null;

    const cutoffTs = admin.firestore.Timestamp.fromMillis(cutoffMs);

    const roomQuery = await dbi
      .collection("rooms")
      .where("lastActiveAt", "<", cutoffTs)
      .limit(30)
      .get();

    if (roomQuery.empty) {
      return null;
    }

    let processedRooms = 0;
    let prunedPlayers = 0;

    for (const roomDoc of roomQuery.docs) {
      const roomId = roomDoc.id;
      const roomData =
        (roomDoc.data() as (RoomDoc & { playersCount?: number }) | undefined) ??
        null;

      const playersCount = Number.isFinite(roomData?.playersCount)
        ? Math.max(0, Number(roomData?.playersCount ?? 0))
        : 0;
      if (!playersCount) {
        continue;
      }

      // Presence check
      let presenceActive = false;
      if (rt) {
        try {
          const presSnap = await rt.ref(`presence/${roomId}`).get();
          if (presSnap.exists()) {
            const val = presSnap.val() as PresenceRoomMap | null;
            const nowLocal = Date.now();
            presenceActive = Object.values(val || {}).some((connMap) => {
              return Object.values(connMap || {}).some((conn) =>
                isPresenceConnActive(conn, nowLocal)
              );
            });
          }
        } catch (err) {
          console.warn("Failed to check presence activity for room", {
            roomId,
            err,
          });
        }
      }

      if (presenceActive) {
        continue;
      }

      // Skip if any player has been seen recently
      try {
        const recentSnap = await roomDoc.ref
          .collection("players")
          .where("lastSeen", ">=", cutoffTs)
          .limit(1)
          .get();
        if (!recentSnap.empty) {
          continue;
        }
      } catch (err) {
        console.warn("Failed to query recent players for room", {
          roomId,
          err,
        });
        continue;
      }

      let playersSnap;
      try {
        playersSnap = await roomDoc.ref.collection("players").get();
      } catch (err) {
        console.warn("Failed to read players while pruning idle room", {
          roomId,
          err,
        });
        continue;
      }

      if (playersSnap.empty) {
        continue;
      }

      const stalePlayerIds: string[] = [];
      let hasRecent = false;

      playersSnap.forEach((playerDoc) => {
        if (hasRecent) return;
        const data = playerDoc.data() as PlayerDoc;
        const lastSeenMs = toMillis(data?.lastSeen);
        if (lastSeenMs && now - lastSeenMs < idleThresholdMs) {
          hasRecent = true;
          return;
        }
        stalePlayerIds.push(playerDoc.id);
      });

      if (hasRecent || stalePlayerIds.length === 0) {
        continue;
      }

      processedRooms += 1;

      const cappedIds = stalePlayerIds.slice(0, 10);
      for (const playerId of cappedIds) {
        try {
          await leaveRoomServer(roomId, playerId, null);
          prunedPlayers += 1;
        } catch (err) {
          console.error("Failed to remove idle player during prune", {
            roomId,
            playerId,
            err,
          });
        }
      }
    }

    if (processedRooms || prunedPlayers) {
      logDebug("Idle room prune summary", {
        processedRooms,
        prunedPlayers,
        thresholdMs: idleThresholdMs,
      });
    }

    return null;
  });

// ルームが新ラウンド（status: clue に遷移し round が増加）になったら、その部屋のチャットをクリア
export const purgeChatOnRoundStart = regionFunctions.firestore
  .document("rooms/{roomId}")
  .onUpdate(async (change, ctx) => {
    if (EMERGENCY_STOP) return null;
    const before = change.before.data() as RoomDoc | undefined;
    const after = change.after.data() as RoomDoc | undefined;
    if (!before || !after) return null;
    const beforeRound = typeof before.round === "number" ? before.round : 0;
    const afterRound = typeof after.round === "number" ? after.round : 0;
    const statusChangedToClue =
      after.status === "clue" && before.status !== "clue";
    const roundIncreased = afterRound > beforeRound;
    if (!(statusChangedToClue || roundIncreased)) return null;
    const topicText =
      typeof after.topic === "string" && after.topic.trim()
        ? after.topic.trim()
        : typeof before.topic === "string" && before.topic.trim()
          ? before.topic.trim()
          : null;
    try {
      const dbi = admin.firestore();
      const roomRef = dbi.collection("rooms").doc(ctx.params.roomId);
      const chatSnap = await roomRef.collection("chat").get();
      const topicMessage = topicText ? `📝 お題: ${topicText}` : null;
      const deletable = chatSnap.docs.filter((doc) => {
        const data = doc.data() as { sender?: unknown; text?: unknown } | undefined;
        const text = typeof data?.text === "string" ? data.text : "";
        const isTopicMessage = text.startsWith("📝 お題");
        // お題メッセージ（誰が送ったかに関わらず）と system 投稿は残す
        if (isTopicMessage) return false;
        return (data?.sender as string | undefined) !== "system";
      });

      if (deletable.length > 0) {
        // Firestore のバッチ上限 500 件に合わせてチャンク処理
        const CHUNK_SIZE = 450;
        for (let i = 0; i < deletable.length; i += CHUNK_SIZE) {
          const batch = dbi.batch();
          deletable.slice(i, i + CHUNK_SIZE).forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
        }
      }

      // ラウンド開始直後に現在のお題を再掲して、直前のクリアで消えないようにする
      const topicAlreadyPresent =
        !!topicMessage &&
        chatSnap.docs.some((doc) => {
          const data = doc.data() as { sender?: unknown; text?: unknown };
          const text = typeof data?.text === "string" ? data.text : "";
          return text === topicMessage;
        });

      if (topicMessage && !topicAlreadyPresent) {
        await roomRef.collection("chat").add({
          sender: "system",
          uid: "system",
          text: topicMessage,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      functions.logger.info("purgeChatOnRoundStart executed", {
        roomId: ctx.params.roomId,
        deletedCount: deletable.length,
        topicReposted: !!(topicMessage && !topicAlreadyPresent),
        topicIncluded: !!topicMessage,
        statusChangedToClue,
        roundIncreased,
      });
    } catch (err) {
      functions.logger.error("purgeChatOnRoundStart failed", {
        roomId: ctx.params.roomId,
        error: err instanceof Error ? err.message : String(err ?? "unknown"),
      });
    }
    return null;
  });

// players ドキュメント削除時: lastActiveAt を更新し、最後の1人が抜けた場合はルームを初期化＋クローズ
export const onPlayerDeleted = regionFunctions.firestore
  .document("rooms/{roomId}/players/{playerId}")
  .onDelete(async (snap, ctx) => {
    if (EMERGENCY_STOP) return null;
    const dbi = admin.firestore();
    const roomRef = dbi.collection("rooms").doc(ctx.params.roomId);
    // lastActiveAt を更新
    try {
      await roomRef.update({
        lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch {}
    try {
      const players = await roomRef.collection("players").limit(1).get();
      if (players.empty) {
        // 最後の1人が抜けた → ルームを初期化し、クローズ＋有効期限を設定
        const expires = new Date(Date.now() + 3 * 60 * 1000); // 3分
        const serverNow = admin.firestore.FieldValue.serverTimestamp();
        // NOTE: /api/rooms/[roomId]/reset が正規ルート。Functions では自動解放の補助として同等の初期化を行う。
        const payload = composeWaitingResetPayload({
          recallOpen: true,
          resetRound: true,
          clearTopic: true,
          closedAt: serverNow,
          expiresAt: admin.firestore.Timestamp.fromDate(expires),
        });
        await roomRef.update({
          ...payload,
          lastActiveAt: serverNow,
        });
        functions.logger.debug("room recall reopened after purge", {
          roomId: ctx.params.roomId,
          reason: "empty-room",
        });
      } else {
        // ホストが消えた場合のフォールバック: 先頭の参加者をホストに
        const roomSnap = await roomRef.get();
        const room = roomSnap.data() as RoomDoc | undefined;
        const hostId = typeof room?.hostId === "string" ? room.hostId : undefined;
        if (!hostId) {
          const next = await roomRef.collection("players").limit(1).get();
          const nextId = next.empty ? null : next.docs[0].id;
          if (nextId) {
            console.warn("Promoted next player to host after host left", {
              roomId: ctx.params.roomId,
              nextId,
            });
            await roomRef.update({ hostId: nextId });
          }
        }
      }
    } catch {}
    try {
      await recalcRoomCounts(ctx.params.roomId as string);
    } catch (err) {
      console.error(
        "Failed to recalculate room counts after player deletion",
        err
      );
    }
    return null;
  });

// 定期実行: オーファン（無人）ルームの削除（最終活動が24h以上前かつplayers=0）
export const purgeOrphanRooms = regionFunctions.pubsub
  .schedule("every 60 minutes")
  .onRun(async () => {
    if (EMERGENCY_STOP) return null;
    const dbi = admin.firestore();
    const cutoff = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - 24 * 60 * 60 * 1000)
    );
    const q = dbi
      .collection("rooms")
      .where("lastActiveAt", "<", cutoff)
      .limit(50);
    const snap = await q.get();
    for (const docSnap of snap.docs) {
      const roomRef = docSnap.ref;
      const players = await roomRef.collection("players").limit(1).get();
      if (!players.empty) continue; // 誰かいるなら残す
      await roomRef.delete();
    }
    return null;
  });

// 参加者作成時: ルームをアクティブ扱いに（expiresAt解除 + lastActiveAt更新）
export const onPlayerCreated = regionFunctions.firestore
  .document("rooms/{roomId}/players/{playerId}")
  .onCreate(async (_snap, ctx) => {
    if (EMERGENCY_STOP) return null;
    try {
      const dbi = admin.firestore();
      const roomRef = dbi.collection("rooms").doc(ctx.params.roomId);
      await roomRef.update({
        expiresAt: null,
        lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await recalcRoomCounts(ctx.params.roomId as string);

      try {
        const data = _snap.data() as PlayerDoc;
        const rawName = typeof data?.name === "string" ? data.name : null;
        const rawUid = typeof data?.uid === "string" ? data.uid : null;

        const normalizedUid = rawUid ? rawUid.trim() : "";
        if (!normalizedUid || _snap.id !== normalizedUid) {
          return null;
        }

        await roomRef.collection("chat").add({
          sender: "system",
          uid: "system",
          text: systemMessagePlayerJoined(rawName),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (err) {
        console.warn("Could not send system join message", {
          roomId: ctx.params.roomId,
          playerId: ctx.params.playerId,
          err,
        });
      }
    } catch {}
    return null;
  });

// 定期実行: 古い events の削除（右上トースト用イベントの整理）
// 既定で 7 日より古いものを削除（環境変数 EVENT_RETENTION_DAYS で日数変更可能）
export const pruneOldEvents = regionFunctions.pubsub
  .schedule("every 24 hours")
  .onRun(async () => {
    if (EMERGENCY_STOP) return null;
    const dbi = admin.firestore();
    const days = Number(process.env.EVENT_RETENTION_DAYS || 7);
    const cutoff = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    );
    // ルームを分割して処理（コスト抑制のため上限あり）
    const roomsSnap = await dbi.collection("rooms").select().limit(100).get();
    if (roomsSnap.empty) return null;
    for (const room of roomsSnap.docs) {
      try {
        const eventsCol = room.ref.collection("events");
        // 期間外を削除
        const snap = await eventsCol
          .where("createdAt", "<", cutoff)
          .orderBy("createdAt", "asc")
          .limit(500)
          .get();
        if (snap.empty) continue;
        const batch = dbi.batch();
        for (const d of snap.docs) batch.delete(d.ref);
        await batch.commit();
      } catch (err) {
        console.error("Failed to prune old events", { roomId: room.id, err });
      }
    }
    return null;
  });

export {
  onRejoinRequestCreate,
  onRejoinRequestUpdate,
  onRoomWaitingProcessRejoins,
} from "./rejoin";

export { quickStart } from "./quickStart";
