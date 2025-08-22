import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

// 初期化: 環境に応じて設定
if (!admin.apps.length) {
  admin.initializeApp();
}

// 定期実行: expiresAt を過ぎた rooms を削除（players/chat も含めて）
export const cleanupExpiredRooms = functions.pubsub
  .schedule("every 10 minutes")
  .onRun(async (context) => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    const q = db.collection("rooms").where("expiresAt", "<=", now).limit(50);
    const snap = await q.get();
    if (snap.empty) return null;

    const batch = db.batch();
    const deletes: Promise<any>[] = [];

    for (const docSnap of snap.docs) {
      const roomRef = docSnap.ref;
      // delete subcollections players/chat safely
      const playersSnap = await roomRef.collection("players").listDocuments();
      for (const p of playersSnap) batch.delete(p);
      const chatSnap = await roomRef.collection("chat").listDocuments();
      for (const c of chatSnap) batch.delete(c);
      batch.delete(roomRef);
    }

    await batch.commit();
    return null;
  });

// 定期実行: 古いチャットの削除（14日以上前を削除）
export const pruneOldChat = functions.pubsub
  .schedule("every 24 hours")
  .onRun(async () => {
    const db = admin.firestore();
    const roomsSnap = await db.collection("rooms").select().get();
    if (roomsSnap.empty) return null;
    const cutoff = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    );
    for (const room of roomsSnap.docs) {
      const chatCol = room.ref.collection("chat");
      const q = chatCol.where("createdAt", "<", cutoff).orderBy("createdAt", "asc").limit(500);
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
    const before = change.before.data() as any
    const after = change.after.data() as any
    if (!before || !after) return null
    const beforeRound = typeof before.round === "number" ? before.round : 0
    const afterRound = typeof after.round === "number" ? after.round : 0
    const statusChangedToClue = after.status === "clue" && before.status !== "clue"
    const roundIncreased = afterRound > beforeRound
    if (!(statusChangedToClue || roundIncreased)) return null
    try {
      const dbi = admin.firestore()
      const roomRef = dbi.collection("rooms").doc(ctx.params.roomId)
      const chatRefs = await roomRef.collection("chat").listDocuments()
      if (chatRefs.length === 0) return null
      const batch = dbi.batch()
      for (const d of chatRefs) batch.delete(d)
      await batch.commit()
    } catch {}
    return null
  })

// players ドキュメント削除時: lastActiveAt を更新し、最後の1人が抜けた場合はルームを初期化＋クローズ
export const onPlayerDeleted = functions.firestore
  .document("rooms/{roomId}/players/{playerId}")
  .onDelete(async (snap, ctx) => {
    const dbi = admin.firestore();
    const roomRef = dbi.collection("rooms").doc(ctx.params.roomId);
    // lastActiveAt を更新
    try {
      await roomRef.update({ lastActiveAt: admin.firestore.FieldValue.serverTimestamp() });
    } catch {}
    try {
      const players = await roomRef.collection("players").limit(1).get();
      if (players.empty) {
        // 最後の1人が抜けた → ルームを初期化し、クローズ＋有効期限を設定
        const expires = new Date(Date.now() + 60 * 60 * 1000); // 60分
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
  })
