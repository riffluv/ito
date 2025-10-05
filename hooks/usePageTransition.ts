"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

export interface TransitionLoadingStep {
  id: string;
  message: string;
  duration: number;
  icon?: string;
  color?: string;
}

export const DEFAULT_LOADING_STEPS: TransitionLoadingStep[] = [
  { id: "firebase", message: "せつぞく中です...", duration: 700, icon: "🔥" },
  {
    id: "room",
    message: "ルームの じょうほうを とくていしています...",
    duration: 900,
    icon: "⚔️",
  },
  { id: "player", message: "プレイヤーを とうろくしています...", duration: 800, icon: "👥" },
  { id: "ready", message: "じゅんびが かんりょうしました！", duration: 500, icon: "🎮" },
];

interface TransitionOptions {
  direction?: "slideLeft" | "slideRight" | "slideUp" | "slideDown" | "fade" | "scale";
  duration?: number;
  showLoading?: boolean;
  loadingSteps?: TransitionLoadingStep[];
}

export function usePageTransition() {
  const router = useRouter();
  const pathname = usePathname();

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [fromPage, setFromPage] = useState("");
  const [toPage, setToPage] = useState("");
  const [loadingStepsState, setLoadingStepsState] = useState<TransitionLoadingStep[]>([]);
  const [pendingCompletion, setPendingCompletion] = useState(false);

  const transitionRef = useRef<{
    direction: string;
    duration: number;
  }>({
    direction: "slideLeft",
    duration: 0.6,
  });
  const pushTimeoutRef = useRef<number | null>(null);

  const clearScheduledNavigation = useCallback(() => {
    if (pushTimeoutRef.current !== null) {
      clearTimeout(pushTimeoutRef.current);
      pushTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearScheduledNavigation();
    };
  }, [clearScheduledNavigation]);

  const finalizeLoading = useCallback(() => {
    setIsLoading(false);
    setProgress(0);
    setCurrentStep("");
    setLoadingStepsState([]);
    setFromPage("");
    setToPage("");
    setPendingCompletion(false);
    clearScheduledNavigation();
  }, [clearScheduledNavigation]);

  useEffect(() => {
    if (!pendingCompletion) return;
    if (!toPage || pathname === toPage) {
      finalizeLoading();
    }
  }, [pendingCompletion, pathname, toPage, finalizeLoading]);

  // ページ遷移実行（Firebase処理含む）
  const navigateWithTransition = useCallback(
    async (
      href: string,
      options: TransitionOptions = {},
      firebaseOperation?: () => Promise<void>
    ) => {
      const {
        direction = "slideLeft",
        duration = 0.6,
        showLoading = false,
        loadingSteps = [],
      } = options;

      // 現在実行中なら無視
      if (isTransitioning || isLoading) return;

      setPendingCompletion(false);
      setFromPage(pathname || "");
      setToPage(href);
      transitionRef.current = { direction, duration };

      try {
        // ローディング表示が有効な場合（Firebase操作の有無を問わず）
        if (showLoading) {
          const stepsToRun =
            loadingSteps && loadingSteps.length > 0 ? loadingSteps : DEFAULT_LOADING_STEPS;

          setIsLoading(true);
          setProgress(0);
          setLoadingStepsState(stepsToRun);
          setCurrentStep(stepsToRun[0]?.id ?? "");

          // Firebase操作を並列実行（ローディングと同時進行）
          let firebaseCompleted = false;
          const firebasePromise = firebaseOperation ? firebaseOperation().then(() => {
            firebaseCompleted = true;
          }).catch((error) => {
            console.error("Firebase operation error:", error);
            firebaseCompleted = true; // エラーでも進行を続ける
          }) : Promise.resolve();

          // 総時間を計算
          const totalDuration = stepsToRun.reduce(
            (sum, step) => sum + Math.max(step.duration, 0),
            0
          );
          const routerPushDelay =
            totalDuration > 0
              ? Math.max(Math.min(totalDuration - 300, totalDuration * 0.8), 120)
              : 0;
          clearScheduledNavigation();
          pushTimeoutRef.current = window.setTimeout(() => {
            router.push(href);
            pushTimeoutRef.current = null;
          }, routerPushDelay);
          let elapsedTime = 0;

          // 段階的ローディング実行（Firebase操作と並列）
          for (let i = 0; i < stepsToRun.length; i++) {
            const step = stepsToRun[i];
            setCurrentStep(step.id);

            // ステップ間の待機時間
            const waitTime = Math.max(step.duration, 0);
            await new Promise(resolve => setTimeout(resolve, waitTime));

            // ステップ完了時にプログレスを更新
            elapsedTime += waitTime;
            const progress = Math.min(
              totalDuration > 0
                ? (elapsedTime / totalDuration) * 100
                : ((i + 1) / stepsToRun.length) * 100,
              100
            );
            setProgress(progress);
          }

          // Firebase操作の完了を待つ
          await firebasePromise;

          // 最終的に100%を確実に設定
          setProgress(100);

          // ローディング完了 - DragonQuestLoadingのonCompleteでcompleteLoading()が呼ばれる
          // この時点では既に目的のページに遷移済み

          return; // 追加の遷移処理をスキップ
        } else if (firebaseOperation) {
          // ローディング表示なしでFirebase操作実行
          await firebaseOperation();
          setLoadingStepsState([]);
          setCurrentStep("");
          setProgress(0);
        }

        // Firebase操作なし、またはローディング表示なしの場合のみ遷移アニメーション
        setLoadingStepsState([]);
        setCurrentStep("");
        setProgress(0);
        setIsTransitioning(true);

        // 暗転の中間でナビゲーション実行
        const delay = Math.max(duration * 400, 120);
        clearScheduledNavigation();
        pushTimeoutRef.current = window.setTimeout(() => {
          router.push(href);
          pushTimeoutRef.current = null;
        }, delay);

      } catch (error) {
        console.error("遷移エラー:", error);
        setIsLoading(false);
        setIsTransitioning(false);
        setLoadingStepsState([]);
        setCurrentStep("");
        setProgress(0);
        clearScheduledNavigation();

        // エラー時の回復アニメーション
        // TODO: エラー表示機能を追加
      }
    },
    [router, pathname, isTransitioning, isLoading, clearScheduledNavigation]
  );

  // ルーム参加専用の遷移
  const navigateToRoom = useCallback(
    async (roomId: string, joinRoomOperation: () => Promise<void>) => {
      const loadingSteps = [
        { id: "firebase", message: "🔥 Firebase接続中...", duration: 400, icon: "🔥" },
        { id: "room", message: "⚔️ ルーム情報取得中...", duration: 600, icon: "⚔️" },
        { id: "player", message: "👥 プレイヤー登録中...", duration: 300, icon: "👥" },
        { id: "ready", message: "🎮 ゲーム準備完了！", duration: 200, icon: "🎮" },
      ];

      await navigateWithTransition(
        `/rooms/${roomId}`,
        {
          direction: "slideLeft",
          duration: 0.8,
          showLoading: true,
          loadingSteps,
        },
        joinRoomOperation
      );
    },
    [navigateWithTransition]
  );

  // ロビーへの遷移
  const navigateToLobby = useCallback(() => {
    navigateWithTransition("/", {
      direction: "slideRight",
      duration: 0.6,
    });
  }, [navigateWithTransition]);

  // 設定画面への遷移
  const navigateToSettings = useCallback(() => {
    navigateWithTransition("/settings", {
      direction: "slideUp",
      duration: 0.5,
    });
  }, [navigateWithTransition]);

  // 遷移完了時のクリーンアップ
  const completeTransition = useCallback(() => {
    setIsTransitioning(false);
    setIsLoading(false); // ローディングも確実に終了
    setProgress(0);
    setCurrentStep("");
    setFromPage("");
    setToPage("");
    setLoadingStepsState([]);
    setPendingCompletion(false);
    clearScheduledNavigation();
  }, [clearScheduledNavigation]);

  // ローディング完了時のクリーンアップ
  const completeLoading = useCallback(() => {
    if (toPage && pathname !== toPage) {
      setPendingCompletion(true);
      return;
    }
    finalizeLoading();
  }, [finalizeLoading, pathname, toPage]);

  return {
    // 状態
    isTransitioning,
    isLoading,
    currentStep,
    progress,
    fromPage,
    toPage,
    loadingSteps: loadingStepsState,
    direction: transitionRef.current.direction,
    duration: transitionRef.current.duration,

    // アクション
    navigateWithTransition,
    navigateToRoom,
    navigateToLobby,
    navigateToSettings,
    completeTransition,
    completeLoading,
  };
}

// 使用例とプリセット
export const TRANSITION_PRESETS = {
  // 基本遷移
  forward: { direction: "slideLeft" as const, duration: 0.6 },
  back: { direction: "slideRight" as const, duration: 0.6 },
  modal: { direction: "scale" as const, duration: 0.4 },

  // ゲーム特有
  enterRoom: { direction: "slideLeft" as const, duration: 0.8, showLoading: true },
  exitRoom: { direction: "slideRight" as const, duration: 0.6 },
  settings: { direction: "slideUp" as const, duration: 0.5 },

  // Firebase関連
  withFirebase: {
    direction: "slideLeft" as const,
    duration: 1.0,
    showLoading: true,
    loadingSteps: [
      { id: "firebase", message: "🔥 Firebase接続中...", duration: 800 },
      { id: "operation", message: "⚡ 処理実行中...", duration: 600 },
      { id: "complete", message: "✅ 完了", duration: 400 },
    ],
  },
};

export default usePageTransition;
