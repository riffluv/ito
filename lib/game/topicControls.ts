"use client";
import { notify } from "@/components/ui/notify";
import { db } from "@/lib/firebase/client";
import { dealNumbers } from "@/lib/game/room";
import {
  fetchTopicSections,
  getTopicsByType,
  pickOne,
  topicTypeLabels,
  type TopicType,
} from "@/lib/topics";
import { doc, updateDoc } from "firebase/firestore";

// お題関連の制御機能
export const topicControls = {
  // カテゴリを選択してお題をランダム決定
  async selectCategory(roomId: string, type: TopicType) {
    try {
      const sections = await fetchTopicSections();
      const pool = getTopicsByType(sections, type);
      const picked = pickOne(pool) || null;
      await updateDoc(doc(db!, "rooms", roomId), {
        topicBox: type,
        topicOptions: null,
        topic: picked,
      });
      notify({
        title: `カテゴリ「${type}」を選択しました`,
        description: picked ? `お題: ${picked}` : "お題の取得に失敗しました",
        type: "success",
      });
    } catch (error: any) {
      notify({
        title: "カテゴリ選択に失敗",
        description: error?.message || String(error),
        type: "error",
      });
    }
  },

  // お題をクリア（カテゴリ/お題の選び直し）
  async resetTopic(roomId: string) {
    try {
      await updateDoc(doc(db!, "rooms", roomId), {
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
      notify({ title: "ゲームをリセットしました", type: "success" });
    } catch (error: any) {
      notify({ title: "ゲームリセットに失敗", description: error?.message || String(error), type: "error" });
    }
  },

  // 現在のカテゴリでお題をシャッフル
  async shuffleTopic(roomId: string, currentCategory: string | null) {
    if (!currentCategory) {
      notify({ title: "カテゴリが選択されていません", type: "warning" });
      return;
    }
    try {
      const sections = await fetchTopicSections();
      const pool = getTopicsByType(sections, currentCategory as TopicType);
      const picked = pickOne(pool) || null;
      await updateDoc(doc(db!, "rooms", roomId), { topic: picked });
      notify({
        title: "お題をシャッフルしました",
        description: picked
          ? `新しいお題: ${picked}`
          : "お題の取得に失敗しました",
        type: "success",
      });
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
      await dealNumbers(roomId);
      notify({ title: "数字を配りました", type: "success" });
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
