"use client";
import { notify } from "@/components/ui/notify";
import { handleFirebaseQuotaError, isFirebaseQuotaExceeded } from "@/lib/utils/errorHandling";
import {
  dealNumbers as dealNumbersRoom,
  type DealNumbersOptions,
} from "@/lib/game/room";
import { withPermissionRetry } from "@/lib/firebase/permissionGuard";
import {
  apiResetTopic,
  apiSelectTopicCategory,
  apiSetCustomTopic,
  apiShuffleTopic,
} from "@/lib/services/roomApiClient";
import { topicTypeLabels, type TopicType } from "@/lib/topics";
import { postCustomTopicToChat } from "@/lib/game/topicControls/chatPost";
import { broadcastNotify, getErrorMessage } from "@/lib/game/topicControls/helpers";

// お題関連の制御機能（API 経由）
export const topicControls = {
  async selectCategory(roomId: string, type: TopicType) {
    try {
      await withPermissionRetry(
        () => apiSelectTopicCategory(roomId, type),
        { context: "topic.select", toastContext: "お題選択" }
      );
      const label = topicTypeLabels[type as keyof typeof topicTypeLabels] ?? type;
      await broadcastNotify(
        roomId,
        "success",
        `カテゴリ「${label}」を選択しました`,
        undefined,
        `topic:select:${type}`
      );
    } catch (error) {
      notify({
        title: "カテゴリ選択に失敗",
        description: getErrorMessage(error),
        type: "error",
      });
    }
  },

  async setCustomTopic(roomId: string, text: string) {
    const value = (text || "").trim();
    if (!value) throw new Error("お題を入力してください");
    try {
      await withPermissionRetry(
        () => apiSetCustomTopic(roomId, value),
        { context: "topic.custom", toastContext: "お題設定" }
      );
      await broadcastNotify(
        roomId,
        "success",
        "お題を設定しました",
        `新しいお題: ${value}`,
        `topic:custom:${value}`
      );
      await postCustomTopicToChat(roomId, value);
    } catch (error) {
      if (isFirebaseQuotaExceeded(error)) {
        handleFirebaseQuotaError("カスタムお題設定");
        notify({
          title: "🚨 Firebase読み取り制限",
          description: "現在お題を設定できません。しばらくしてから再度お試しください。",
          type: "error",
        });
      } else {
        notify({
          title: "お題設定に失敗",
          description: getErrorMessage(error),
          type: "error",
        });
      }
    }
  },

  async resetTopic(roomId: string) {
    try {
      await withPermissionRetry(
        () => apiResetTopic(roomId),
        { context: "topic.reset", toastContext: "ゲームリセット" }
      );
      await broadcastNotify(roomId, "success", "ゲームをリセットしました", undefined, "topic:reset");
    } catch (error) {
      notify({
        title: "ゲームリセットに失敗",
        description: getErrorMessage(error),
        type: "error",
      });
    }
  },

  async shuffleTopic(roomId: string, currentCategory: TopicType | null) {
    if (!currentCategory) {
      notify({ title: "カテゴリが選択されていません", type: "warning" });
      return;
    }
    try {
      await withPermissionRetry(
        () => apiShuffleTopic(roomId, currentCategory),
        { context: "topic.shuffle", toastContext: "お題シャッフル" }
      );
      await broadcastNotify(
        roomId,
        "success",
        "お題をシャッフルしました",
        undefined,
        `topic:shuffle:${currentCategory}`
      );
    } catch (error) {
      notify({
        title: "シャッフル失敗",
        description: getErrorMessage(error),
        type: "error",
      });
    }
  },

  async dealNumbers(roomId: string, options?: DealNumbersOptions) {
    try {
      const assignedCount = await dealNumbersRoom(roomId, 0, {
        ...options,
        requestId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      });
      await broadcastNotify(
        roomId,
        "success",
        "数字を配りました",
        `対象プレイヤー: ${assignedCount}人`,
        `numbers:deal:${assignedCount}`
      );
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === "rate_limited") {
        notify({
          title: "順番待ちしています…",
          description: "短時間に複数の配布要求が重なりました。",
          type: "info",
          duration: 1800,
        });
      } else {
        notify({
          title: "数字の配布に失敗",
          description: getErrorMessage(error),
          type: "error",
        });
      }
    }
  },
};

export { topicTypeLabels };
export type { TopicType };


