"use client";
import { notify } from "@/components/ui/notify";
import { db } from "@/lib/firebase/client";
import { handleFirebaseQuotaError, isFirebaseQuotaExceeded } from "@/lib/utils/errorHandling";
import { dealNumbers as dealNumbersRoom } from "@/lib/game/room";
import { sendSystemMessage } from "@/lib/firebase/chat";
import { sendNotifyEvent } from "@/lib/firebase/events";
import { emergencyResetPlayerStates, verifyPlayerStatesCleared } from "@/lib/utils/emergencyRecovery";
import { logWarn } from "@/lib/utils/log";
import {
  getTopicSectionsCached,
  getTopicsByType,
  pickOne,
  topicTypeLabels,
  type TopicType,
} from "@/lib/topics";
import { doc, updateDoc } from "firebase/firestore";

const PLAYER_RESET_BATCH_SIZE = 400;

function chunkArray<T>(items: readonly T[], size: number): T[][] {
  if (!items.length || size <= 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function broadcastNotify(
  roomId: string,
  type: "info" | "warning" | "success" | "error",
  title: string,
  description?: string,
  contextKey?: string
) {
  try {
    await sendNotifyEvent(roomId, { type, title, description, dedupeKey: contextKey });
  } catch {
    // ignore broadcast failure
  }
}

// お題関連の制御機能
export const topicControls = {
  // カテゴリを選択してお題をランダム決定
  async selectCategory(roomId: string, type: TopicType) {
    try {
      const sections = await getTopicSectionsCached();
      const pool = getTopicsByType(sections, type);
      const picked = pickOne(pool) || null;
      await updateDoc(doc(db!, "rooms", roomId), {
        topicBox: type,
        topicOptions: null,
        topic: picked,
      });
      const label = topicTypeLabels[type as keyof typeof topicTypeLabels] ?? type;
      await broadcastNotify(
        roomId,
        "success",
        `カテゴリ「${label}」を選択しました`,
        picked ? `お題: ${picked}` : undefined,
        `topic:select:${type}:${picked ?? "none"}`
      );
    } catch (error: any) {
      if (isFirebaseQuotaExceeded(error)) {
        handleFirebaseQuotaError("お題選択");
        notify({
          title: "🚨 Firebase読み取り制限",
          description: "現在お題を選択できません。24時間後に再度お試しください。",
          type: "error",
        });
      } else {
        notify({
          title: "カテゴリ選択に失敗",
          description: error?.message || String(error),
          type: "error",
        });
      }
    }
  },

  // カスタムお題を設定
  async setCustomTopic(roomId: string, text: string) {
    const value = (text || "").trim();
    if (!value) throw new Error("お題を入力してください");
    try {
      await updateDoc(doc(db!, "rooms", roomId), {
        topic: value,
        topicBox: "カスタム",
        topicOptions: null,
      });
      await broadcastNotify(
        roomId,
        "success",
        "お題を更新しました",
        `新しいお題: ${value}`,
        `topic:custom:${value}`
      );
      try {
        await sendSystemMessage(roomId, `📝 お題を変更: ${value}`);
      } catch {}
    } catch (error: any) {
      if (isFirebaseQuotaExceeded(error)) {
        handleFirebaseQuotaError("カスタムお題設定");
        notify({
          title: "🚨 Firebase読み取り制限",
          description: "現在お題を設定できません。しばらくしてから再度お試しください。",
          type: "error",
        });
      } else {
        notify({ title: "お題設定に失敗", description: error?.message || String(error), type: "error" });
      }
    }
  },

  // お題をクリア（カテゴリ/お題の選び直し）
  async resetTopic(roomId: string) {
    try {
      const { collection, getDocs, writeBatch, doc, getDoc } = await import("firebase/firestore");
      // 進行中にはリセット禁止（誤操作防止）
      const roomRef = doc(db!, "rooms", roomId);
      const snap = await getDoc(roomRef);
      if (snap.exists()) {
        const status = (snap.data() as any)?.status;
        if (status === "clue" || status === "reveal") {
          throw new Error("進行中はリセットできません");
        }
      }

      // 1. roomドキュメントをリセット
      await updateDoc(roomRef, {
        status: "waiting", // ★ ロビー状態に戻す
        result: null,
        deal: null,
        order: null,
        round: 0,
        topic: null,
        topicOptions: null,
        topicBox: null,
        closedAt: null,
        expiresAt: null,
      });

      // 2. すべてのplayerドキュメントのclue1をクリア（バッチ分割）
      const playersRef = collection(db!, "rooms", roomId, "players");
      const playersSnapshot = await getDocs(playersRef);
      const playerDocs = playersSnapshot.docs;

      const chunks = chunkArray(playerDocs, PLAYER_RESET_BATCH_SIZE);
      for (const chunk of chunks) {
        const batch = writeBatch(db!);
        chunk.forEach((playerDoc) => {
          batch.update(playerDoc.ref, {
            clue1: "",
            ready: false,
          });
        });
        try {
          await batch.commit();
        } catch (commitError) {
          logWarn("topicControls", "reset-topic-batch-commit-failed", {
            roomId,
            size: chunk.length,
            error: commitError,
          });
          await emergencyResetPlayerStates(roomId);
          throw commitError;
        }
      }

      let verified = true;
      try {
        verified = await verifyPlayerStatesCleared(roomId);
      } catch (verifyError) {
        logWarn("topicControls", "reset-topic-verify-failed", verifyError);
        verified = false;
      }
      if (!verified) {
        await emergencyResetPlayerStates(roomId);
        throw new Error("プレイヤー状態を安全に再初期化しました。もう一度お試しください。");
      }

      await broadcastNotify(roomId, "success", "ゲームをリセットしました", undefined, "topic:reset");
    } catch (error: any) {
      if (isFirebaseQuotaExceeded(error)) {
        handleFirebaseQuotaError("ゲームリセット");
        notify({
          title: "🚨 Firebase読み取り制限",
          description: "現在ゲームをリセットできません。24時間後に再度お試しください。",
          type: "error",
        });
      } else {
        notify({ title: "ゲームリセットに失敗", description: error?.message || String(error), type: "error" });
      }
    }
  },

  // 現在のカテゴリでお題をシャッフル
  async shuffleTopic(roomId: string, currentCategory: string | null) {
    if (!currentCategory) {
      notify({ title: "カテゴリが選択されていません", type: "warning" });
      return;
    }
    try {
      const sections = await getTopicSectionsCached();
      const pool = getTopicsByType(sections, currentCategory as TopicType);
      const picked = pickOne(pool) || null;
      await updateDoc(doc(db!, "rooms", roomId), { topic: picked });
      await broadcastNotify(
        roomId,
        "success",
        "お題をシャッフルしました",
        picked ? `新しいお題: ${picked}` : undefined,
        `topic:shuffle:${currentCategory}:${picked ?? "none"}`
      );
    } catch (error: any) {
      notify({
        title: "シャッフル失敗",
        description: error?.message || String(error),
        type: "error",
      });
    }
  },

  // 数字を配布
  async dealNumbers(roomId: string) {
    try {
      const assignedCount = await dealNumbersRoom(roomId);
      await broadcastNotify(
        roomId,
        "success",
        "数字を配りました",
        `対象プレイヤー: ${assignedCount}人`,
        `numbers:deal:${assignedCount}`
      );
    } catch (error: any) {
      notify({
        title: "数字の配布に失敗",
        description: error?.message || String(error),
        type: "error",
      });
    }
  },
};

// TopicType配列をエクスポート
export { topicTypeLabels };
export type { TopicType };


