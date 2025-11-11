/*
  管理スクリプト: RTDB の /presence 以下に残ったゴースト接続を削除する
  実行方法:
    - サービスアカウント JSON を用意し、環境変数 GOOGLE_APPLICATION_CREDENTIALS に設定
    - ts-node で実行（または tsc でビルドして node で実行）

  環境変数:
    PRESENCE_ROOT (省略可) 例: presence
*/
/* eslint-disable no-console */
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

type PresenceValue = {
  ts?: number;
};

type PresenceConnections = Record<string, PresenceValue>;
type PresenceUsers = Record<string, PresenceConnections>;
type PresenceRooms = Record<string, PresenceUsers>;

// 初期化
if (!getApps().length) {
  initializeApp({
    credential: applicationDefault(),
    // databaseURL は自プロジェクトの RTDB URL に置き換えても良い
    // Functions 上で実行する場合は省略可
  });
}

async function main() {
  const db = getDatabase();
  const root = process.env.PRESENCE_ROOT || "presence";
  const now = Date.now();
  const STALE_MS = 15_000; // useLobbyCounts と揃える

  console.log(`[purge-presence] scanning /${root} ...`);
  const snap = await db.ref(root).get();
  if (!snap.exists()) {
    console.log("no presence root. done");
    return;
  }
  const rooms = (snap.val() ?? {}) as PresenceRooms;
  let purged = 0;
  for (const [roomId, users] of Object.entries(rooms)) {
    for (const [uid, conns] of Object.entries(users)) {
      for (const [connId, val] of Object.entries(conns)) {
        const ts = typeof val.ts === "number" ? val.ts : 0;
        if (!ts || now - ts > STALE_MS) {
          console.log(`- remove stale ${roomId}/${uid}/${connId} ts=${ts}`);
          await db.ref(`${root}/${roomId}/${uid}/${connId}`).remove();
          purged++;
        }
      }
      // uid ノードが空になったら削除
      const left = await db.ref(`${root}/${roomId}/${uid}`).get();
      if (!left.exists() || Object.keys(left.val() ?? {}).length === 0) {
        await db.ref(`${root}/${roomId}/${uid}`).remove();
      }
    }
    // room ノードが空になったら削除
    const leftRoom = await db.ref(`${root}/${roomId}`).get();
    if (!leftRoom.exists() || Object.keys(leftRoom.val() ?? {}).length === 0) {
      await db.ref(`${root}/${roomId}`).remove();
    }
  }
  console.log(`[purge-presence] done. purged=${purged}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
