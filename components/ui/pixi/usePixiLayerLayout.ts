import { type Container } from "pixi.js";
import { useEffect, useRef } from "react";

export interface PixiLayerLayoutOptions {
  /**
   * レイアウト変更時に呼び出されるコールバック
   * width, height, x, y は画面座標系での値
   */
  onUpdate?: (layout: {
    width: number;
    height: number;
    x: number;
    y: number;
    dpr: number;
  }) => void;

  /**
   * 同期を無効化する場合はtrue
   */
  disabled?: boolean;
}

/**
 * DOMエレメントとPixiコンテナの位置・サイズを同期するカスタムフック
 *
 * - ResizeObserver でサイズ変化を監視
 * - requestAnimationFrame で getBoundingClientRect() の値を追跡
 * - DPR変更も考慮した同期処理
 *
 * @param targetRef - 監視対象のDOMエレメント
 * @param pixiContainer - 同期させるPixiコンテナ（nullの場合は何もしない）
 * @param options - オプション設定
 */
export function usePixiLayerLayout(
  targetRef: React.RefObject<HTMLElement>,
  pixiContainer: Container | null,
  options?: PixiLayerLayoutOptions
) {
  const disabled = options?.disabled ?? false;
  const onUpdate = options?.onUpdate;
  const rafRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const lastLayoutRef = useRef<DOMRect | null>(null);
  const dprRef = useRef(typeof window !== "undefined" ? window.devicePixelRatio : 1);
  const resizeTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const target = targetRef.current;
    const container = pixiContainer;

    // 無効化されている、またはコンテナが存在しない場合は何もしない
    if (disabled || !target || !container) {
      return undefined;
    }

    let active = true;

    // レイアウト更新処理
    const updateLayout = () => {
      if (!active || !target || !container) {
        rafRef.current = null;
        return;
      }

      const rect = target.getBoundingClientRect();
      const currentDpr = typeof window !== "undefined" ? window.devicePixelRatio : 1;

      // 前回と変化がない場合はスキップ（微小な変化を無視）
      const prev = lastLayoutRef.current;
      const hasChanged =
        !prev ||
        Math.abs(prev.x - rect.x) > 0.3 ||
        Math.abs(prev.y - rect.y) > 0.3 ||
        Math.abs(prev.width - rect.width) > 0.3 ||
        Math.abs(prev.height - rect.height) > 0.3 ||
        Math.abs(dprRef.current - currentDpr) > 0.01;

      if (hasChanged) {
        lastLayoutRef.current = rect;
        dprRef.current = currentDpr;

        // Pixiコンテナの位置は設定しない（Graphics側で設定する）
        // container.position.set(rect.x, rect.y);

        // コールバックを呼び出し
        onUpdate?.({
          width: rect.width,
          height: rect.height,
          x: rect.x,
          y: rect.y,
          dpr: currentDpr,
        });
      }

      // 次のフレームでも監視を続ける
      rafRef.current = requestAnimationFrame(updateLayout);
    };

    // ResizeObserver でサイズ変化を監視（debounce 付き）
    resizeObserverRef.current = new ResizeObserver(() => {
      // 頻繁なリサイズ時の負荷軽減（16ms = 1フレーム遅延）
      if (resizeTimeoutRef.current !== null) {
        clearTimeout(resizeTimeoutRef.current);
      }
      resizeTimeoutRef.current = window.setTimeout(() => {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
        }
        updateLayout();
      }, 16);
    });

    resizeObserverRef.current.observe(target);

    // 初回実行
    updateLayout();

    // クリーンアップ
    return () => {
      active = false;

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      if (resizeTimeoutRef.current !== null) {
        clearTimeout(resizeTimeoutRef.current);
        resizeTimeoutRef.current = null;
      }

      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }

      lastLayoutRef.current = null;
    };
  }, [targetRef, pixiContainer, disabled, onUpdate]);
}
