"use client";

import { createContext, useContext, ReactNode } from "react";
import { usePageTransition } from "../../hooks/usePageTransition";
import { DragonQuestLoading } from "./DragonQuestLoading";
import { PageTransition } from "./PageTransition";

// 遷移コンテキスト
const TransitionContext = createContext<ReturnType<typeof usePageTransition> | null>(null);

interface TransitionProviderProps {
  children: ReactNode;
}

export function TransitionProvider({ children }: TransitionProviderProps) {
  const transition = usePageTransition();

  return (
    <TransitionContext.Provider value={transition}>
      {children}

      {/* ドラクエ風ローディング画面 */}
      <DragonQuestLoading
        isVisible={transition.isLoading}
        currentStep={transition.currentStep}
        progress={transition.progress}
        steps={transition.loadingSteps}
        onComplete={transition.completeLoading}
      />

      {/* ページ遷移アニメーション（ローディング使用時は無効化） */}
      {!transition.isLoading && (
        <PageTransition
          isTransitioning={transition.isTransitioning}
          direction={transition.direction as any}
          fromPage={transition.fromPage}
          toPage={transition.toPage}
          duration={transition.duration}
          onComplete={transition.completeTransition}
        />
      )}
    </TransitionContext.Provider>
  );
}

// フック
export function useTransition() {
  const context = useContext(TransitionContext);
  if (!context) {
    throw new Error("useTransition must be used within TransitionProvider");
  }
  return context;
}

// 使用例とヘルパー関数
export const TransitionHelpers = {
  // ルーム参加の完全な遷移
  joinRoom: async (
    transition: ReturnType<typeof usePageTransition>,
    roomId: string,
    displayName: string
  ) => {
    const { joinRoomFully } = await import("@/lib/services/roomService");
    const { useAuth } = await import("@/context/AuthContext");

    await transition.navigateToRoom(roomId, async () => {
      // Firebase ルーム参加処理をここで実行
      // 注意: この例では擬似的な実装です
      // 実際の実装では適切なユーザー情報を取得する必要があります

      // 1. Firebase接続
      await new Promise(resolve => setTimeout(resolve, 800));

      // 2. ルーム情報取得
      await new Promise(resolve => setTimeout(resolve, 1200));

      // 3. プレイヤー登録
      // await joinRoomFully({ roomId, uid: "user-id", displayName });
      await new Promise(resolve => setTimeout(resolve, 600));

      // 4. 準備完了
      await new Promise(resolve => setTimeout(resolve, 400));
    });
  },

  // 設定変更の遷移
  updateSettings: async (
    transition: ReturnType<typeof usePageTransition>,
    settingsData: any
  ) => {
    await transition.navigateWithTransition(
      "/settings",
      {
        direction: "slideUp",
        duration: 0.5,
        showLoading: true,
        loadingSteps: [
          { id: "save", message: "💾 設定保存中...", duration: 600 },
          { id: "apply", message: "⚙️ 設定適用中...", duration: 400 },
          { id: "complete", message: "✅ 完了", duration: 200 },
        ],
      },
      async () => {
        // 設定保存処理
        localStorage.setItem("gameSettings", JSON.stringify(settingsData));
        await new Promise(resolve => setTimeout(resolve, 400));
      }
    );
  },

  // エラー時の回復遷移
  handleError: (
    transition: ReturnType<typeof usePageTransition>,
    error: Error,
    fallbackPath: string = "/"
  ) => {
    console.error("遷移エラー:", error);

    // エラー発生時は簡単なフェード遷移でフォールバック
    transition.navigateWithTransition(fallbackPath, {
      direction: "fade",
      duration: 0.4,
    });
  },
};

export default TransitionProvider;
