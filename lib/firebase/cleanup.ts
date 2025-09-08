import { db } from "@/lib/firebase/client";
import {
  collection,
  deleteDoc,
  getDocs,
  query,
  Timestamp,
  where,
} from "firebase/firestore";

/**
 * 古い部屋を自動削除する関数
 * @param daysOld 何日前の部屋を削除するか（デフォルト: 3日）
 */
export async function cleanupOldRooms(daysOld: number = 3) {
  if (!db) {
    console.warn("Firebase not initialized");
    return { success: false, error: "Firebase not initialized" };
  }

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    const cutoffTimestamp = Timestamp.fromDate(cutoffDate);

    // 古い部屋を検索
    const roomsQuery = query(
      collection(db, "rooms"),
      where("createdAt", "<", cutoffTimestamp)
    );

    const snapshot = await getDocs(roomsQuery);
    let deletedCount = 0;

    for (const doc of snapshot.docs) {
      try {
        // 部屋の状態をチェック（アクティブな部屋は削除しない）
        const roomData = doc.data();
        if (roomData.status === "playing" || roomData.status === "clue") {
          console.log(`Skipping active room: ${doc.id}`);
          continue;
        }

        // プレイヤー数をチェック（参加者がいる部屋は削除しない）
        const playersSnapshot = await getDocs(collection(doc.ref, "players"));
        if (playersSnapshot.size > 0) {
          console.log(`Skipping room with players: ${doc.id}`);
          continue;
        }

        // 部屋を削除
        await deleteDoc(doc.ref);
        deletedCount++;

        console.log(`Deleted old room: ${roomData.name || doc.id}`);
      } catch (error) {
        console.error(`Error deleting room ${doc.id}:`, error);
      }
    }

    return {
      success: true,
      deletedCount,
      message: `${deletedCount} old rooms deleted`,
    };
  } catch (error) {
    console.error("Error during cleanup:", error);
    return { success: false, error: error };
  }
}

/**
 * ロビー表示時に古い部屋のクリーンアップを実行
 * （管理者権限がある場合のみ）
 */
export async function autoCleanupOnLobbyLoad() {
  // 開発環境でのみ自動クリーンアップを実行
  if (process.env.NODE_ENV === "development") {
    try {
      const result = await cleanupOldRooms(7); // 7日以上前の部屋を削除
      if (
        result.success &&
        typeof result.deletedCount === "number" &&
        result.deletedCount > 0
      ) {
        console.log(
          `🧹 Auto cleanup: ${result.deletedCount} old rooms removed`
        );
      }
    } catch (error) {
      console.error("Auto cleanup failed:", error);
    }
  }
}
