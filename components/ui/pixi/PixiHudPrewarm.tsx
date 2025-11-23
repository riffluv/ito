"use client";

import { useEffect } from "react";
import { usePixiHudContext } from "@/components/ui/pixi/PixiHudStage";

/**
 * Pixi HUD をアプリ起動直後にウォームアップしておくための小さなユーティリティ。
 * - HUD が ready になるまで待機
 * - レンダラーが有効になるのを待機
 * - 1フレームだけ描画して WebGL コンテキストを確立
 *
 * 描画内容は HUD の背景プレースホルダーのみで、UI には影響しない。
 */
export function PixiHudPrewarm() {
  const pixi = usePixiHudContext();

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        await pixi?.waitForHudReady?.();
        await pixi?.waitForRendererReady?.();
        if (!cancelled) {
          await pixi?.renderOnce?.("hud.prewarm");
        }
      } catch {
        // ウォームアップ失敗は致命的ではないので握りつぶす
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [pixi]);

  return null;
}

export default PixiHudPrewarm;
