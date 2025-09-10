import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize admin if not already
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

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

// Trigger on player created
export const onPlayerCreate = functions.firestore
  .document('rooms/{roomId}/players/{playerId}')
  .onCreate(async (snap, ctx) => {
    const roomId = ctx.params.roomId as string;
    try {
      await recalcRoomCounts(roomId);
    } catch (err) {
      console.error('onPlayerCreate error', err);
    }
  });

// Trigger on player deleted
export const onPlayerDelete = functions.firestore
  .document('rooms/{roomId}/players/{playerId}')
  .onDelete(async (snap, ctx) => {
    const roomId = ctx.params.roomId as string;
    try {
      await recalcRoomCounts(roomId);
    } catch (err) {
      console.error('onPlayerDelete error', err);
    }
  });

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
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

// 初期化: 環境に応じて設定
if (!admin.apps.length) {
  admin.initializeApp();
}

// 緊急停止フラグ（READ 増加時の一時対策）
// 環境変数 EMERGENCY_READS_FREEZE=1 が有効のとき、
// 以降の定期ジョブ/トリガは早期 return して何もしない
const EMERGENCY_STOP = process.env.EMERGENCY_READS_FREEZE === "1";

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
    } catch {}
    return null;
  });
