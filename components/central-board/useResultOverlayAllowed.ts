import { useEffect, useState } from "react";
import type { RoomDoc } from "@/lib/types";
import { FLIP_DURATION_MS, RESULT_INTRO_DELAY } from "@/lib/ui/motion";

export function useResultOverlayAllowed(params: {
  roomStatus: RoomDoc["status"];
  resultIntroReadyAt: number | null | undefined;
}): boolean {
  const { roomStatus, resultIntroReadyAt } = params;
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (roomStatus !== "finished") {
      setAllowed(false);
      return undefined;
    }

    const now = Date.now();
    // 最低でも「最後のフリップ完了 + RESULT_INTRO_DELAY」ぶん待つ。
    // resultIntroReadyAt が過去でも、ミニマムの余韻（FLIP_DURATION+RESULT_INTRO）を確保する。
    const minimalIntro = now + FLIP_DURATION_MS + RESULT_INTRO_DELAY; // ≈510ms
    const target = Math.max(resultIntroReadyAt ?? 0, minimalIntro);
    const delay = Math.max(0, target - now);

    setAllowed(false);
    const timer = window.setTimeout(() => setAllowed(true), delay);
    return () => window.clearTimeout(timer);
  }, [roomStatus, resultIntroReadyAt]);

  return allowed;
}

