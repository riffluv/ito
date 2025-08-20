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
