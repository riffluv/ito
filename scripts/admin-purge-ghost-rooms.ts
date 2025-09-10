/*
  管理スクリプト: ゴースト部屋を検出して削除する

  実行方法:
    - サービスアカウント JSON を用意し、環境変数 GOOGLE_APPLICATION_CREDENTIALS に設定
    - ts-node で実行（または tsc でビルドして node で実行）

  環境変数:
    PRESENCE_ROOT (省略可) 例: presence
    GHOST_THRESHOLD_MS (省略可) ミリ秒。デフォルト 10分
    DRY_RUN=1 で実際の削除を行わずログのみ
*/
import { getApps, initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { getFirestore } from "firebase-admin/firestore";

async function main() {
  if (!getApps().length) {
    // 管理者証明書は env の GOOGLE_APPLICATION_CREDENTIALS を使うので明示的な引数は不要
    initializeApp();
  }
  const db = getFirestore();
  const rtdb = getDatabase();

  const PRESENCE_ROOT = process.env.PRESENCE_ROOT || "presence";
  const GHOST_THRESHOLD_MS =
    Number(process.env.GHOST_THRESHOLD_MS) || 10 * 60 * 1000; // 10min
  const STALE_MS = Number(process.env.PRESENCE_STALE_MS) || 90_000; // 同期: client 側の定義に合わせる
  const DRY_RUN = !!process.env.DRY_RUN;

  console.log(
    `[purge-ghost-rooms] start: threshold=${GHOST_THRESHOLD_MS}ms, stale=${STALE_MS}ms, dryRun=${DRY_RUN}`
  );

  const roomsSnap = await db.collection("rooms").get();
  const now = Date.now();
  let deleted = 0;
  let candidates = 0;

  for (const roomDoc of roomsSnap.docs) {
    try {
      const room = roomDoc.data() as any;
      const roomId = roomDoc.id;

      // presence count from RTDB
      const presSnap = await rtdb.ref(`${PRESENCE_ROOT}/${roomId}`).get();
      let presenceCount = 0;
      if (presSnap.exists()) {
        const val = presSnap.val() as Record<string, any>;
        for (const uid of Object.keys(val)) {
          const conns = val[uid] || {};
          const nowLocal = Date.now();
          const online = Object.values(conns).some((c: any) => {
            const ts = typeof c?.ts === "number" ? c.ts : 0;
            if (!ts) return false;
            if (ts - nowLocal > STALE_MS) return false;
            return nowLocal - ts <= STALE_MS;
          });
          if (online) presenceCount++;
        }
      }

      // players subcollection count
      const playersSnap = await db
        .collection("rooms")
        .doc(roomId)
        .collection("players")
        .get();
      const playersCount = playersSnap.size;

      // newer timestamp
      const lastActive = room?.lastActiveAt;
      const createdAt = room?.createdAt;
      const lastActiveMs =
        lastActive && typeof lastActive.toMillis === "function"
          ? lastActive.toMillis()
          : lastActive instanceof Date
            ? lastActive.getTime()
            : typeof lastActive === "number"
              ? lastActive
              : 0;
      const createdMs =
        createdAt && typeof createdAt.toMillis === "function"
          ? createdAt.toMillis()
          : createdAt instanceof Date
            ? createdAt.getTime()
            : typeof createdAt === "number"
              ? createdAt
              : 0;
      const newerMs = Math.max(lastActiveMs || 0, createdMs || 0);

      // decide
      const ageMs = newerMs > 0 ? now - newerMs : Infinity;
      const isEmpty = presenceCount === 0 && playersCount === 0;
      const protectPlaying =
        room?.status &&
        room.status !== "waiting" &&
        room.status !== "completed";

      // only consider deletable rooms: not playing, empty, and older than threshold
      if (!protectPlaying && isEmpty && ageMs > GHOST_THRESHOLD_MS) {
        candidates++;
        console.log(
          `[candidate] room=${roomId} name=${room?.name || "-"} age=${Math.round(ageMs / 1000)}s presence=${presenceCount} players=${playersCount}`
        );
        if (!DRY_RUN) {
          try {
            await db.collection("rooms").doc(roomId).delete();
            // also remove any RTDB presence node just in case
            await rtdb
              .ref(`${PRESENCE_ROOT}/${roomId}`)
              .remove()
              .catch(() => {});
            deleted++;
            console.log(`  -> deleted`);
          } catch (err) {
            console.error(`  -> failed to delete: ${err}`);
          }
        }
      }
    } catch (err) {
      console.error(`error processing room ${roomDoc.id}:`, err);
    }
  }

  console.log(
    `[purge-ghost-rooms] done. candidates=${candidates} deleted=${deleted}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
