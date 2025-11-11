"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePixiHudLayer } from "./PixiHudStage";
import { createSpaceGuide, createSubmitEGuide, type GuideButton } from "@/lib/pixi/GuideButton";

type GuideLayoutBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
};

const VIEWPORT_PADDING = {
  base: 12,
  desktop: 16,
} as const;

const FALLBACK_DOCK_BOTTOM = {
  base: 20,
  desktop: 24,
} as const;

const FALLBACK_DOCK_HEIGHT = {
  base: 58,
  desktop: 64,
} as const;

const SPACE_TARGET_GAP = 10;
const E_TARGET_GAP = -20; // 上に配置（マイナスでDockより上）
const E_HORIZONTAL_GAP = 40;
const E_DIAGONAL_OFFSET_Y = 42;
const E_RIGHT_INSET = {
  base: 80, // 左に大きく移動
  desktop: 120, // デスクトップでさらに左
} as const;

/**
 * 🎮 Pure PixiJS版ガイドボタンコンポーネント
 *
 * PixiHudStageレイヤー上にSpaceキー/Eキーガイドを表示。
 * 既存のSpaceKeyHint/SubmitEHintのPixiJS版置き換え。
 *
 * 使用例:
 * ```tsx
 * <PixiGuideButtons
 *   showSpace={currentPhase === 'associating'}
 *   showE={currentPhase === 'submitting'}
 * />
 * ```
 */

interface PixiGuideButtonsProps {
  /** Spaceキーガイドを表示するか */
  showSpace?: boolean;
  /** Eキー/ドラッグガイドを表示するか */
  showE?: boolean;
  /** 一時表示モード（ミリ秒指定で自動消滅） */
  temporaryDuration?: number;
  /** ガイド全体を無効化するか（観戦モードなど） */
  disabled?: boolean;
  /** プレイヤーがすでにカードを提出済みか */
  hasCardPlaced?: boolean;
}

export function PixiGuideButtons({
  showSpace = false,
  showE = false,
  temporaryDuration,
  disabled = false,
  hasCardPlaced = false,
}: PixiGuideButtonsProps) {
  const layer = usePixiHudLayer("guide-buttons", { zIndex: 45 });
  const spaceGuideRef = useRef<GuideButton | null>(null);
  const eGuideRef = useRef<GuideButton | null>(null);
  const isInitializedRef = useRef(false);
  const updateScheduledRef = useRef(false);

  const updatePositions = useCallback(() => {
    const spaceGuide = spaceGuideRef.current;
    const eGuide = eGuideRef.current;
    if (!spaceGuide || !eGuide) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const isMobile = width < 768;
    const viewportPadding = isMobile
      ? VIEWPORT_PADDING.base
      : VIEWPORT_PADDING.desktop;

    const measureGuide = (guide: GuideButton): GuideLayoutBounds => {
      const bounds = guide.getLocalBounds();
      const left = bounds.x;
      const top = bounds.y;
      const right = bounds.x + bounds.width;
      const bottom = bounds.y + bounds.height;
      return {
        left,
        top,
        right,
        bottom,
        width: bounds.width,
        height: bounds.height,
      };
    };

    const clamp = (value: number, min: number, max: number) => {
      if (!Number.isFinite(value)) return min;
      if (max < min) return min;
      return Math.min(Math.max(value, min), max);
    };

    const clampX = (value: number, bounds: GuideLayoutBounds) => {
      const minX = viewportPadding - bounds.left;
      const maxX = width - viewportPadding - bounds.right;
      return clamp(value, minX, maxX);
    };

    const clampY = (value: number, bounds: GuideLayoutBounds) => {
      const minY = viewportPadding - bounds.top;
      const maxY = height - viewportPadding - bounds.bottom;
      return clamp(value, minY, maxY);
    };

    const getRect = (selector: string): DOMRect | null => {
      const element = document.querySelector<HTMLElement>(selector);
      return element ? element.getBoundingClientRect() : null;
    };

    const spaceBounds = measureGuide(spaceGuide);
    const eBounds = measureGuide(eGuide);

    const inputRect =
      getRect('[data-guide-target="association-input"]') ??
      getRect('input[aria-label="連想ワード"]');

    const dockRect = getRect('[data-guide-target="mini-hand-dock"]');

    const fallbackDockBottom = isMobile
      ? FALLBACK_DOCK_BOTTOM.base
      : FALLBACK_DOCK_BOTTOM.desktop;
    const fallbackDockHeight = isMobile
      ? FALLBACK_DOCK_HEIGHT.base
      : FALLBACK_DOCK_HEIGHT.desktop;

    let spaceArrowTargetY =
      height - fallbackDockBottom - fallbackDockHeight - SPACE_TARGET_GAP;
    let spaceX = clampX(width / 2 - spaceBounds.width / 2, spaceBounds);

    if (inputRect) {
      spaceArrowTargetY = inputRect.top - SPACE_TARGET_GAP;
      const spaceCenterX = inputRect.left + inputRect.width / 2;
      spaceX = clampX(spaceCenterX - spaceBounds.width / 2, spaceBounds);
    }

    const spaceY = clampY(
      spaceArrowTargetY - spaceBounds.bottom,
      spaceBounds
    );
    spaceGuide.position.set(spaceX, spaceY);

    const verticalLift = eBounds.height + spaceBounds.height + SPACE_TARGET_GAP;

    let eArrowTargetY = spaceArrowTargetY - E_DIAGONAL_OFFSET_Y - verticalLift;
    let eCenterX =
      spaceX + spaceBounds.width / 2 + E_HORIZONTAL_GAP + eBounds.width / 2;

    if (dockRect) {
      eArrowTargetY = dockRect.top + E_TARGET_GAP - verticalLift;
      const rightInset = isMobile
        ? E_RIGHT_INSET.base
        : E_RIGHT_INSET.desktop;
      eCenterX = dockRect.right - rightInset - eBounds.width / 2;
    } else if (inputRect) {
      eCenterX = inputRect.right + E_HORIZONTAL_GAP + eBounds.width / 2;
    }

    const eX = clampX(eCenterX - eBounds.width / 2, eBounds);
    const eY = clampY(eArrowTargetY - eBounds.top, eBounds);
    eGuide.position.set(eX, eY);
  }, []);

  const requestPositionUpdate = useCallback(() => {
    if (disabled) return;
    if (!showSpace && (!showE || hasCardPlaced)) return;
    if (updateScheduledRef.current) return;
    updateScheduledRef.current = true;
    window.requestAnimationFrame(() => {
      updateScheduledRef.current = false;
      updatePositions();
    });
  }, [disabled, showSpace, showE, hasCardPlaced, updatePositions]);

  // 初期化: ガイドボタンを作成してレイヤーに追加
  useEffect(() => {
    if (!layer || isInitializedRef.current) return undefined;

    if (disabled) {
      spaceGuideRef.current?.hide();
      eGuideRef.current?.hide();
      return undefined;
    }

    isInitializedRef.current = true;

    // Spaceガイド作成
    const spaceGuide = createSpaceGuide();
    spaceGuideRef.current = spaceGuide;

    // Eガイド作成
    const eGuide = createSubmitEGuide();
    eGuideRef.current = eGuide;

    // レイヤーに追加
    layer.addChild(spaceGuide);
    layer.addChild(eGuide);

    const observedElements = new Set<HTMLElement>();
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() =>
            requestPositionUpdate()
          )
        : null;

    const observeTargets = () => {
      if (!resizeObserver) return;
      const elements = document.querySelectorAll<HTMLElement>(
        '[data-guide-target="association-input"], [data-guide-target="mini-hand-dock"]'
      );
      let added = false;
      elements.forEach((el) => {
        if (!observedElements.has(el)) {
          observedElements.add(el);
          resizeObserver.observe(el);
          added = true;
        }
      });
      if (added) {
        requestPositionUpdate();
      }
    };

    observeTargets();

    const mutationObserver =
      typeof MutationObserver !== "undefined"
        ? new MutationObserver(() => observeTargets())
        : null;

    if (mutationObserver && document.body) {
      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class"],
      });
    }

    // 配置を更新
    requestPositionUpdate();

    // リサイズイベント
    const handleResize = () => requestPositionUpdate();
    window.addEventListener("resize", handleResize);

    // クリーンアップ
    return () => {
      window.removeEventListener("resize", handleResize);
      if (mutationObserver) {
        mutationObserver.disconnect();
      }
      if (resizeObserver) {
        observedElements.forEach((el) => resizeObserver.unobserve(el));
        observedElements.clear();
        resizeObserver.disconnect();
      } else {
        observedElements.clear();
      }
      if (spaceGuide.parent) {
        spaceGuide.parent.removeChild(spaceGuide);
      }
      if (!spaceGuide.destroyed) {
        spaceGuide.destroy({ children: true });
      }
      if (eGuide.parent) {
        eGuide.parent.removeChild(eGuide);
      }
      if (!eGuide.destroyed) {
        eGuide.destroy({ children: true });
      }
      spaceGuideRef.current = null;
      eGuideRef.current = null;
      isInitializedRef.current = false;
    };
  }, [layer, disabled, requestPositionUpdate]);

  useEffect(() => {
    requestPositionUpdate();
  }, [requestPositionUpdate]);

  // Spaceガイド表示制御
  useEffect(() => {
    const spaceGuide = spaceGuideRef.current;
    if (!spaceGuide) return;

    if (disabled) {
      spaceGuide.hide();
      return;
    }

    if (showSpace) {
      if (temporaryDuration) {
        spaceGuide.showTemporary(temporaryDuration);
      } else {
        spaceGuide.show();
      }
    } else {
      spaceGuide.hide();
    }
  }, [showSpace, temporaryDuration, disabled]);

  // Eガイド表示制御
  useEffect(() => {
    const eGuide = eGuideRef.current;
    if (!eGuide) return;

    if (disabled || hasCardPlaced) {
      eGuide.hide();
      return;
    }

    if (showE) {
      if (temporaryDuration) {
        eGuide.showTemporary(temporaryDuration);
      } else {
        eGuide.show();
      }
    } else {
      eGuide.hide();
    }
  }, [showE, temporaryDuration, disabled, hasCardPlaced]);

  // このコンポーネントはPixiだけで描画するのでDOMは返さない
  return null;
}

/**
 * ゲームフェーズに応じた自動表示コンポーネント
 *
 * 使用例:
 * ```tsx
 * <PixiGuideButtonsAuto currentPhase={phase} me={me} />
 * ```
 */
interface PixiGuideButtonsAutoProps {
  currentPhase?: string;
  me?: { ready?: boolean; clue1?: string } | null;
  disabled?: boolean;
  hasPlacedCard?: boolean;
}

export function PixiGuideButtonsAuto({
  currentPhase,
  me,
  disabled = false,
  hasPlacedCard = false,
}: PixiGuideButtonsAutoProps) {
  const showSpace = !disabled && currentPhase === "clue" && !me?.ready;
  const showE =
    !disabled &&
    !hasPlacedCard &&
    currentPhase === "clue" &&
    me?.ready &&
    !!me?.clue1?.trim();

  return (
    <PixiGuideButtons
      showSpace={showSpace}
      showE={showE}
      disabled={disabled}
      hasCardPlaced={hasPlacedCard}
    />
  );
}
