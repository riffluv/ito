import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { leaveRoomServer } from '@/lib/server/roomActions';

// Initialize admin if not already
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const rtdb = admin.database ? admin.database() : (null as any);

// 緊急停止フラグ（READ 増加時の一時対策）
// 環境変数 EMERGENCY_READS_FREEZE=1 が有効のとき、
// 以降の定期ジョブ/トリガは早期 return して何もしない
const EMERGENCY_STOP = process.env.EMERGENCY_READS_FREEZE === '1';

const PRESENCE_STALE_THRESHOLD_MS = Number(
  process.env.NEXT_PUBLIC_PRESENCE_STALE_MS ||
    process.env.PRESENCE_STALE_MS ||
    90_000
);

const MAX_CLOCK_SKEW_MS = Number(
  process.env.NEXT_PUBLIC_PRESENCE_MAX_CLOCK_SKEW_MS ||
    process.env.PRESENCE_MAX_CLOCK_SKEW_MS ||
    30_000
);

/**
 * Recalculates playersCount and lastActive for a room.
 * Called after onCreate/onDelete/onUpdate of players docs.
 */
async function recalcRoomCounts(roomId: string) {
  if (!roomId) return;
  const playersColl = db.collection('rooms').doc(roomId).collection('players');

  // Count active players and compute lastSeen timestamp
  const snapshot = await playersColl.get();
  let count = 0;
  let lastSeen: admin.firestore.Timestamp | null = null;
  snapshot.forEach((doc) => {
    count += 1;
    const data = doc.data() as any;
    if (data.lastSeen && data.lastSeen.toDate) {
      const ts = data.lastSeen as admin.firestore.Timestamp;
      if (!lastSeen || ts.toMillis() > lastSeen.toMillis()) lastSeen = ts;
    }
  });

  const roomRef = db.collection('rooms').doc(roomId);
  const updates: any = { playersCount: count };
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
export const onPlayerUpdate = functions.firestore
  .document('rooms/{roomId}/players/{playerId}')
  .onUpdate(async (change, ctx) => {
    const roomId = ctx.params.roomId as string;
    const before = change.before.data() || {};
    const after = change.after.data() || {};
    // Only recalc when relevant fields change to reduce cost
    if (before.lastSeen?.toMillis?.() === after.lastSeen?.toMillis?.() &&
        before.lastActive === after.lastActive) {
      return;
    }
    try {
      await recalcRoomCounts(roomId);
    } catch (err) {
      console.error('onPlayerUpdate error', err);
    }
  });

function isPresenceConnActive(conn: any, now: number): boolean {
  if (!conn) return false;
  if (conn.online === false) return false;
  if (conn.online === true && typeof conn.ts !== 'number') return true;
  const ts = typeof conn.ts === 'number' ? conn.ts : 0;
  if (!ts) return false;
  if (ts - now > MAX_CLOCK_SKEW_MS) return false;
  return now - ts <= PRESENCE_STALE_THRESHOLD_MS;
}

export const onPresenceWrite = functions.database
  .ref('presence/{roomId}/{uid}/{connId}')
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
      const val = snap.val() as Record<string, any> | null;
      const stillActive = val
        ? Object.values(val).some((conn) => isPresenceConnActive(conn, now))
        : false;

      if (stillActive) {
        return null;
      }

      // 完全に切断されたのでノードを掃除し、部屋から退室させる
      await userRef.remove().catch((err) => {
        console.warn('presence-user-remove-failed', { roomId, uid, err });
      });

      try {
        await leaveRoomServer(roomId, uid, null);
      } catch (err) {
        console.error('presence-leaveRoomServer-failed', { roomId, uid, err });
      }
    } catch (err) {
      console.error('onPresenceWrite error', { roomId, uid, err });
    }
    return null;
  });

// 定期実行: expiresAt を過ぎた rooms を削除（players/chat も含めて）
export const cleanupExpiredRooms = functions.pubsub
  .schedule("every 10 minutes")
  .onRun(async (context) => {
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
export const pruneOldChat = functions.pubsub
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
export const cleanupGhostRooms = functions.pubsub
  .schedule("every 15 minutes")
  .onRun(async () => {
    if (EMERGENCY_STOP) return null;
    const dbi = admin.firestore();
    const rtdb = admin.database();

    // Tunables
    const NOW = Date.now();
    const STALE_LASTSEEN_MS = Number(process.env.GHOST_STALE_LASTSEEN_MS) || 10 * 60 * 1000; // 10min
    const ROOM_MIN_AGE_MS = Number(process.env.GHOST_ROOM_MIN_AGE_MS) || 30 * 60 * 1000; // 30min
    const PRESENCE_STALE_MS = Number(process.env.PRESENCE_STALE_MS) || 90_000; // 90s

    // Process in small chunks to limit costs
    const roomsSnap = await dbi.collection("rooms").select().limit(100).get();
    if (roomsSnap.empty) return null;

    for (const roomDoc of roomsSnap.docs) {
      try {
        const roomId = roomDoc.id;
        const room = roomDoc.data() as any;

        // Quick age gate: only consider sufficiently old rooms
        const lastActive = room?.lastActiveAt;
        const createdAt = room?.createdAt;
        const toMillis = (v: any) =>
          v && typeof v.toMillis === 'function'
            ? v.toMillis()
            : v instanceof Date
              ? v.getTime()
              : typeof v === 'number'
                ? v
                : 0;
        const newerMs = Math.max(toMillis(lastActive), toMillis(createdAt));
        const ageMs = newerMs ? NOW - newerMs : Number.POSITIVE_INFINITY;
        if (ageMs < ROOM_MIN_AGE_MS) continue;

        // Skip actively playing rooms (clue/reveal), unless clearly stale
        const isInProgress = room?.status && room.status !== 'waiting' && room.status !== 'completed';

        // Presence count from RTDB
        let presenceCount = 0;
        try {
          const presSnap = await rtdb.ref(`presence/${roomId}`).get();
          if (presSnap.exists()) {
            const val = presSnap.val() as Record<string, any>;
            const nowLocal = Date.now();
            for (const uid of Object.keys(val)) {
              const conns = val[uid] || {};
              const online = Object.values(conns).some((c: any) => {
                if (c?.online === false) return false;
                if (c?.online === true && typeof c?.ts !== 'number') return true;
                const ts = typeof c?.ts === 'number' ? c.ts : 0;
                if (!ts) return false;
                if (ts - nowLocal > PRESENCE_STALE_MS) return false;
                return nowLocal - ts <= PRESENCE_STALE_MS;
              });
              if (online) presenceCount++;
            }
          }
        } catch {}

        if (presenceCount > 0) continue; // someone is online; skip

        // Count "recent" players by lastSeen
        const playersCol = roomDoc.ref.collection('players');
        const playersSnap = await playersCol.get();
        const nowTs = Date.now();
        let recentPlayers = 0;
        for (const d of playersSnap.docs) {
          const ls = (d.data() as any)?.lastSeen;
          const ms = toMillis(ls);
          if (ms && nowTs - ms <= STALE_LASTSEEN_MS) recentPlayers++;
        }

        // If any recent players exist, keep the room
        if (recentPlayers > 0) continue;

        // At this point, no presence and players are stale. If still marked in-progress, relax to waiting.
        if (isInProgress) {
          try {
            await roomDoc.ref.update({ status: 'waiting' });
          } catch {}
        }

        // Delete chat docs first (best effort)
        try {
          const chatRefs = await roomDoc.ref.collection('chat').listDocuments();
          if (chatRefs.length) {
            const batch = dbi.batch();
            for (const c of chatRefs) batch.delete(c);
            await batch.commit();
          }
        } catch {}

        // Delete all players (best effort)
        try {
          const playerRefs = await roomDoc.ref.collection('players').listDocuments();
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
        console.error('cleanupGhostRooms error', err);
      }
    }
    return null;
  });

// ルームが新ラウンド（status: clue に遷移し round が増加）になったら、その部屋のチャットをクリア
export const purgeChatOnRoundStart = functions.firestore
  .document("rooms/{roomId}")
  .onUpdate(async (change, ctx) => {
    if (EMERGENCY_STOP) return null;
    const before = change.before.data() as any;
    const after = change.after.data() as any;
    if (!before || !after) return null;
    const beforeRound = typeof before.round === "number" ? before.round : 0;
    const afterRound = typeof after.round === "number" ? after.round : 0;
    const statusChangedToClue =
      after.status === "clue" && before.status !== "clue";
    const roundIncreased = afterRound > beforeRound;
    if (!(statusChangedToClue || roundIncreased)) return null;
    try {
      const dbi = admin.firestore();
      const roomRef = dbi.collection("rooms").doc(ctx.params.roomId);
      const chatRefs = await roomRef.collection("chat").listDocuments();
      if (chatRefs.length === 0) return null;
      const batch = dbi.batch();
      for (const d of chatRefs) batch.delete(d);
      await batch.commit();
    } catch {}
    return null;
  });

// players ドキュメント削除時: lastActiveAt を更新し、最後の1人が抜けた場合はルームを初期化＋クローズ
export const onPlayerDeleted = functions.firestore
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
        await roomRef.update({
          status: "waiting",
          result: null,
          deal: null,
          order: null,
          round: 0,
          topic: null,
          topicOptions: null,
          topicBox: null,
          closedAt: admin.firestore.FieldValue.serverTimestamp(),
          expiresAt: admin.firestore.Timestamp.fromDate(expires),
          lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        // ホストが消えた場合のフォールバック: 先頭の参加者をホストに
        const roomSnap = await roomRef.get();
        const room = roomSnap.data() || {};
        const hostId = room.hostId as string | undefined;
        if (!hostId) {
          const next = await roomRef.collection("players").limit(1).get();
          const nextId = next.empty ? null : next.docs[0].id;
          if (nextId) await roomRef.update({ hostId: nextId });
        }
      }
    } catch {}
    try {
      await recalcRoomCounts(ctx.params.roomId as string);
    } catch (err) {
      console.error('onPlayerDeleted recalc error', err);
    }
    return null;
  });

// 定期実行: オーファン（無人）ルームの削除（最終活動が24h以上前かつplayers=0）
export const purgeOrphanRooms = functions.pubsub
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
export const onPlayerCreated = functions.firestore
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
    } catch {}
    return null;
  });

// 定期実行: 古い events の削除（右上トースト用イベントの整理）
// 既定で 7 日より古いものを削除（環境変数 EVENT_RETENTION_DAYS で日数変更可能）
export const pruneOldEvents = functions.pubsub
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
        console.error("pruneOldEvents error", room.id, err);
      }
    }
    return null;
  });
