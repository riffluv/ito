/*
  管理スクリプト: Firestore 側で無人ルーム（players=0）を初期化/削除
  - lastActiveAt が古い / players が空のルームを waiting に戻し、expiresAt を短く設定
  実行方法:
    GOOGLE_APPLICATION_CREDENTIALS を設定し、ts-node または node で実行
*/
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";

if (!getApps().length)
  initializeApp({ credential: applicationDefault() } as any);

async function main() {
  const db = getFirestore();
  const cutoff = Timestamp.fromDate(new Date(Date.now() - 60 * 60 * 1000)); // 1h
  console.log("[reset-orphans] scanning rooms...");
  const snap = await db
    .collection("rooms")
    .where("lastActiveAt", "<", cutoff)
    .limit(200)
    .get();
  let touched = 0;
  for (const doc of snap.docs) {
    const roomRef = doc.ref;
    const players = await roomRef.collection("players").limit(1).get();
    if (!players.empty) continue;
    const expires = new Date(Date.now() + 30 * 60 * 1000); // 30m
    await roomRef.set(
      {
        status: "waiting",
        result: null,
        deal: null,
        order: null,
        round: 0,
        topic: null,
        topicOptions: null,
        topicBox: null,
        closedAt: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromDate(expires),
        lastActiveAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    touched++;
  }
  console.log(`[reset-orphans] done. touched=${touched}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
