import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomDoc } from "@/lib/types";
import {
  STREAK_BANNER_AUTOHIDE_MS,
  STREAK_BANNER_AUTOHIDE_REDUCED_MS,
  STREAK_BANNER_DELAY_MS,
} from "@/lib/constants/uiTimings";

export function useStreakBannerState(params: {
  roomStatus: RoomDoc["status"];
  failed: boolean;
  currentStreak: number;
  prefersReducedMotion: boolean;
}): { showStreakBanner: boolean; hideStreakBanner: () => void } {
  const { roomStatus, failed, currentStreak, prefersReducedMotion } = params;

  const [showStreakBanner, setShowStreakBanner] = useState(false);
  const streakTimerRef = useRef<number | null>(null);
  const streakAutoHideRef = useRef<number | null>(null);

  const hideStreakBanner = useCallback(() => {
    setShowStreakBanner(false);
  }, []);

  useEffect(() => {
    if (roomStatus === "finished" && !failed && currentStreak >= 2) {
      // GameResultOverlay のアニメーション完了を待つ
      // 勝利アニメーションは約2.5秒、0.3秒の間を置いて表示（タイミング短縮）
      streakTimerRef.current = window.setTimeout(() => {
        setShowStreakBanner(true);
      }, STREAK_BANNER_DELAY_MS);

      return () => {
        if (streakTimerRef.current) {
          clearTimeout(streakTimerRef.current);
          streakTimerRef.current = null;
        }
        if (streakAutoHideRef.current) {
          clearTimeout(streakAutoHideRef.current);
          streakAutoHideRef.current = null;
        }
      };
    }

    if (roomStatus !== "finished") {
      // 次のゲームが始まったらバナーを閉じる
      setShowStreakBanner(false);
    }

    return undefined;
  }, [roomStatus, failed, currentStreak]);

  // バナーが表示されたまま残るのを防ぐフォールバック
  useEffect(() => {
    if (!showStreakBanner) return undefined;
    const duration = prefersReducedMotion
      ? STREAK_BANNER_AUTOHIDE_REDUCED_MS
      : STREAK_BANNER_AUTOHIDE_MS; // アニメーション完了を十分にカバーするバッファ
    streakAutoHideRef.current = window.setTimeout(() => {
      hideStreakBanner();
    }, duration);
    return () => {
      if (streakAutoHideRef.current) {
        clearTimeout(streakAutoHideRef.current);
        streakAutoHideRef.current = null;
      }
    };
  }, [hideStreakBanner, prefersReducedMotion, showStreakBanner]);

  return { showStreakBanner, hideStreakBanner };
}

