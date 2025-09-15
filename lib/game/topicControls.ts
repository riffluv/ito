"use client";
import { notify } from "@/components/ui/notify";
import { db } from "@/lib/firebase/client";
import { handleFirebaseQuotaError, isFirebaseQuotaExceeded } from "@/lib/utils/errorHandling";
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
      notify({ title: "お題を更新しました", type: "success" });
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

      // バッチ処理で効率的に更新
      const batch = writeBatch(db!);
      
      // 1. roomドキュメントをリセット
      batch.update(roomRef, {
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
      
      // 2. すべてのplayerドキュメントのclue1をクリア
      const playersRef = collection(db!, "rooms", roomId, "players");
      const playersSnapshot = await getDocs(playersRef);
      
      playersSnapshot.forEach((playerDoc) => {
        // clue1フィールドのみクリアして状態をリセット
        batch.update(playerDoc.ref, {
          clue1: "", // 🚨 連想ワードをクリアして紫マークを消す
          ready: false // readyフラグもリセット
        });
      });
      
      // バッチ実行
      await batch.commit();
      
      notify({ title: "ゲームをリセットしました", type: "success" });
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
