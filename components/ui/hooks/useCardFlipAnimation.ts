import { gsap } from "gsap";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

type FlipPreset = "reveal" | "result";

type UseCardFlipAnimationOptions = {
  flipped: boolean;
  allow3d: boolean;
  preset: FlipPreset;
  durations: { default: number; result: number };
  onFlip?: () => void;
};

/**
 * カードの3Dフリップアニメーション制御をまとめたフック。
 * refとして返した要素に対して、GSAPでの回転と初期化を面倒みる。
 */
export function useCardFlipAnimation({
  flipped,
  allow3d,
  preset,
  durations,
  onFlip,
}: UseCardFlipAnimationOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastAttachedRef = useRef<HTMLDivElement | null>(null);
  const previousFlipRef = useRef<boolean>(flipped);
  const gsapInitialisedRef = useRef(false);
  const flipTweenRef = useRef<gsap.core.Tween | null>(null);
  const previousRotationRef = useRef<number | null>(null);

  const attachRef = useCallback((node: HTMLDivElement | null) => {
    const prev = lastAttachedRef.current;
    if (prev && prev !== node) {
      gsap.killTweensOf(prev);
    }
    if (node === null && prev) {
      gsap.killTweensOf(prev);
    }
    lastAttachedRef.current = node;
    containerRef.current = node;
    gsapInitialisedRef.current = false;
    previousRotationRef.current = null;
    if (flipTweenRef.current) {
      flipTweenRef.current.kill();
      flipTweenRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (flipTweenRef.current) {
        flipTweenRef.current.kill();
        flipTweenRef.current = null;
      }
      const el = lastAttachedRef.current;
      if (el) gsap.killTweensOf(el);
    };
  }, []);

  useEffect(() => {
    if (!allow3d) {
      previousFlipRef.current = flipped;
      return;
    }
    if (flipped !== previousFlipRef.current) {
      onFlip?.();
    }
    previousFlipRef.current = flipped;
  }, [allow3d, flipped, onFlip]);

  useLayoutEffect(() => {
    if (!allow3d) {
      gsapInitialisedRef.current = false;
      previousRotationRef.current = null;
      if (flipTweenRef.current) {
        flipTweenRef.current.kill();
        flipTweenRef.current = null;
      }
      return undefined;
    }

    const el = containerRef.current;
    if (!el) return undefined;

    el.style.transition = "";

    const targetRotation = flipped ? 180 : 0;

    if (!gsapInitialisedRef.current) {
      gsap.set(el, {
        rotateY: targetRotation,
        transformPerspective: 1000,
        transformOrigin: "center center",
      });
      gsapInitialisedRef.current = true;
      previousRotationRef.current = targetRotation;
      return undefined;
    }

    const previousRotation = previousRotationRef.current;
    if (previousRotation === targetRotation) {
      return undefined;
    }

    previousRotationRef.current = targetRotation;

    if (flipTweenRef.current) {
      flipTweenRef.current.kill();
      flipTweenRef.current = null;
    }

    const duration = preset === "result" ? durations.result : durations.default;
    // back.out(1.5) でオーバーシュートを入れ「生き生き感」を演出（参考: カード回転.md）
    // result は少し控えめの 1.35、reveal は 1.5 で弾性終端を強調
    const ease = preset === "result" ? "back.out(1.35)" : "back.out(1.5)";

    flipTweenRef.current = gsap.to(el, {
      duration,
      rotateY: targetRotation,
      ease,
      overwrite: "auto",
      transformPerspective: 1000,
      transformOrigin: "center center",
    });

    return () => {
      if (flipTweenRef.current) {
        flipTweenRef.current.kill();
        flipTweenRef.current = null;
      }
    };
  }, [allow3d, flipped, preset, durations.default, durations.result]);

  return attachRef;
}
