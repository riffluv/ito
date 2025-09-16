import { db } from "@/lib/firebase/client";
import { logError, logInfo, logWarn } from "@/lib/utils/log";
import {
  collection,
  deleteDoc,
  getDocs,
  limit,
  query,
  Timestamp,
  where,
} from "firebase/firestore";

/**
 * 🚨 緊急修正: Firestore読み取り制限対策
 * ゲーム中でも5分で削除（読み取り量削減優先）
 * @param minutesOld 何分前の部屋を削除するか（デフォルト: 5分）
 */
export async function cleanupOldRooms(minutesOld: number = 5) {
  if (!db) {
    logWarn("cleanup", "firebase-not-initialized");
    return { success: false, error: "Firebase not initialized" };
  }

  try {
    const cutoffDate = new Date();
    cutoffDate.setMinutes(cutoffDate.getMinutes() - minutesOld);
    const cutoffTimestamp = Timestamp.fromDate(cutoffDate);

    // 🚨 最近活動がない部屋を検索（読み取り量削減）
    const roomsQuery = query(
      collection(db, "rooms"),
      where("lastActiveAt", "<", cutoffTimestamp),
      limit(10) // 読み取り量削減のため最大10件に制限
    );

    const snapshot = await getDocs(roomsQuery);
    let deletedCount = 0;

    for (const doc of snapshot.docs) {
      try {
        const roomData = doc.data();

        // 🚨 緊急対応: ゲーム中でも5分経過で削除（読み取り制限対策）
        // 通常時は保護するが、制限対策として一時的に緩和
        const status = roomData.status as string;

        // プレイヤー数をチェック（参加者がいる部屋のみ保護）
        const playersSnapshot = await getDocs(collection(doc.ref, "players"));
        if (playersSnapshot.size > 1) {
          // 2人以上の場合のみ保護
          if (process.env.NODE_ENV === "development") {
          logInfo("cleanup", "protecting-room", {
            id: doc.id,
            playerCount: playersSnapshot.size,
            status,
          });
        }
          continue;
        }

        // 5分経過した部屋は状態に関係なく削除
        await deleteDoc(doc.ref);
        deletedCount++;

        if (process.env.NODE_ENV === "development") {
          logInfo("cleanup", "deleted-room", {
            id: doc.id,
            status,
            name: roomData.name || doc.id,
          });
        }
      } catch (error) {
        logError("cleanup", `delete-room-failed: ${doc.id}`, error);
      }
    }

    return {
      success: true,
      deletedCount,
      message: `${deletedCount} old rooms deleted`,
    };
  } catch (error) {
    logError("cleanup", "cleanup-failed", error);
    return { success: false, error: error };
  }
}

/**
 * 🚨 緊急修正: ロビー表示時の読み取り頻度を大幅削減
 * 制限対策として最小限のクリーンアップのみ実行
 */
export async function autoCleanupOnLobbyLoad() {
  try {
    // 🚨 5分以上前の部屋を削除（読み取り制限対策）
    const result = await cleanupOldRooms(5);
    const deletedCount =
      typeof result?.deletedCount === "number" ? result.deletedCount : 0;
    if (
      result.success &&
      deletedCount > 0 &&
      process.env.NODE_ENV === "development"
    ) {
      logInfo("cleanup", "emergency-cleanup", { deletedCount });
    }
    return result;
  } catch (error) {
    logError("cleanup", "emergency-cleanup-failed", error);
    return null;
  }
}
