"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { useTransitionState } from "./transition/useTransitionState";
import type { TransitionLoadingStep, TransitionOptions } from "./transition/types";
import { notify } from "@/components/ui/notify";
import { traceError } from "@/lib/utils/trace";

const FAST_SECONDARY =
  (process.env.NEXT_PUBLIC_TRANSITION_FAST_SECONDARY || "")
    .toString()
    .toLowerCase() === "1";
const ROUTER_RATIO_BASE = 0.78; // was 0.8。速い回線で少しだけ短縮する。
const ROUTER_RATIO_FAST = FAST_SECONDARY ? 0.72 : ROUTER_RATIO_BASE;
const ROUTER_MIN_MS_BASE = 110;
const ROUTER_MIN_MS_FAST = FAST_SECONDARY ? 90 : ROUTER_MIN_MS_BASE;

export const DEFAULT_LOADING_STEPS: TransitionLoadingStep[] = [
  { id: "firebase", message: "せつぞく中です...", duration: 890, icon: "🔥" },
  {
    id: "room",
    message: "ルームの じょうほうを とくていしています...",
    duration: 1130,
    icon: "⚔️",
  },
  {
    id: "player",
    message: "プレイヤーを とうろくしています...",
    duration: 680,
    icon: "👥",
  },
  {
    id: "ready",
    message: "じゅんびが かんりょうしました！",
    duration: 310,
    icon: "🎮",
  },
];

export function usePageTransition() {
  const router = useRouter();
  const pathname = usePathname();
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

  const { state, transitionRef, actions } = useTransitionState(
    pathname ?? "",
    clearScheduledNavigation
  );
  const {
    isTransitioning,
    isLoading,
    currentStep,
    progress,
    fromPage,
    toPage,
    loadingSteps,
  } = state;
  const {
    configureTransition,
    resetPendingCompletion,
    startLoading,
    setCurrentStep: updateCurrentStep,
    setProgress: updateProgress,
    beginTransition,
    completeTransition: finalizeTransition,
    completeLoading: finalizeLoading,
    cancelTransition,
    clearLoadingArtifacts,
  } = actions;

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

      resetPendingCompletion();
      configureTransition({
        from: pathname || "",
        to: href,
        direction,
        duration,
      });

      try {
        // ローディング表示が有効な場合（Firebase操作の有無を問わず）
        if (showLoading) {
          const stepsToRun =
            loadingSteps && loadingSteps.length > 0
              ? loadingSteps
              : DEFAULT_LOADING_STEPS;

          startLoading(stepsToRun);

          // Firebase操作を並列実行（ローディングと同時進行）
          const firebasePromise = firebaseOperation
            ? firebaseOperation().catch((error) => {
                console.error("Firebase operation error:", error);
              })
            : Promise.resolve();

          // 総時間を計算
          const totalDuration = stepsToRun.reduce(
            (sum, step) => sum + Math.max(step.duration, 0),
            0
          );
          // env が有効なときのみ、Firebase 処理付き遷移をわずかに短縮
          const fastEnabled = FAST_SECONDARY && !!firebaseOperation;
          const routerRatio = fastEnabled ? ROUTER_RATIO_FAST : ROUTER_RATIO_BASE;
          const routerMin = fastEnabled ? ROUTER_MIN_MS_FAST : ROUTER_MIN_MS_BASE;
          const routerPushDelay =
            totalDuration > 0
              ? Math.max(
                  Math.min(totalDuration - 260, totalDuration * routerRatio),
                  routerMin
                )
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
            updateCurrentStep(step.id);

            // ステップ間の待機時間
            const waitTime = Math.max(step.duration, 0);
            await new Promise((resolve) => setTimeout(resolve, waitTime));

            // ステップ完了時にプログレスを更新
            elapsedTime += waitTime;
            const progress = Math.min(
              totalDuration > 0
                ? (elapsedTime / totalDuration) * 100
                : ((i + 1) / stepsToRun.length) * 100,
              100
            );
            updateProgress(progress);
          }

          // Firebase操作の完了を待つ
          await firebasePromise;

          // 最終的に100%を確実に設定
          updateProgress(100);

          // ローディング完了 - DragonQuestLoadingのonCompleteでcompleteLoading()が呼ばれる
          // この時点では既に目的のページに遷移済み

          return; // 追加の遷移処理をスキップ
        } else if (firebaseOperation) {
          // ローディング表示なしでFirebase操作実行
          await firebaseOperation();
          clearLoadingArtifacts();
        }

        // Firebase操作なし、またはローディング表示なしの場合のみ遷移アニメーション
        clearLoadingArtifacts();
        beginTransition();

        // 暗転の中間でナビゲーション実行
        const delay = Math.max(duration * 400, 120);
        clearScheduledNavigation();
        pushTimeoutRef.current = window.setTimeout(() => {
          router.push(href);
          pushTimeoutRef.current = null;
        }, delay);
      } catch (error) {
        traceError("navigation.error", error, { from: pathname, to: href });
        notify({
          title: "ページ遷移に失敗しました",
          description: "ネットワークを確認して、もう一度お試しください。",
          type: "error",
        });
        cancelTransition();
      }
    },
    [
      router,
      pathname,
      isTransitioning,
      isLoading,
      clearScheduledNavigation,
      resetPendingCompletion,
      configureTransition,
      startLoading,
      updateCurrentStep,
      updateProgress,
      clearLoadingArtifacts,
      beginTransition,
      cancelTransition,
    ]
  );

  // ルーム参加専用の遷移
  const navigateToRoom = useCallback(
    async (roomId: string, joinRoomOperation: () => Promise<void>) => {
      const loadingSteps = [
        {
          id: "firebase",
          message: "🔥 Firebase接続中...",
          duration: 890,
          icon: "🔥",
        },
        {
          id: "room",
          message: "⚔️ ルーム情報取得中...",
          duration: 1130,
          icon: "⚔️",
        },
        {
          id: "player",
          message: "👥 プレイヤー登録中...",
          duration: 680,
          icon: "👥",
        },
        {
          id: "ready",
          message: "🎮 ゲーム準備完了！",
          duration: 310,
          icon: "🎮",
        },
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
    finalizeTransition();
  }, [finalizeTransition]);

  // ローディング完了時のクリーンアップ
  const completeLoading = useCallback(() => {
    finalizeLoading();
  }, [finalizeLoading]);

  return {
    // 状態
    isTransitioning,
    isLoading,
    currentStep,
    progress,
    fromPage,
    toPage,
    loadingSteps,
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
  enterRoom: {
    direction: "slideLeft" as const,
    duration: 0.8,
    showLoading: true,
  },
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
export type { TransitionLoadingStep, TransitionOptions } from "./transition/types";
