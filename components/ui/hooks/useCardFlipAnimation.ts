import { useEffect, useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";

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
  const previousFlipRef = useRef<boolean>(flipped);
  const gsapInitialisedRef = useRef(false);
  const flipTweenRef = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
    return () => {
      if (flipTweenRef.current) {
        flipTweenRef.current.kill();
        flipTweenRef.current = null;
      }
      const el = containerRef.current;
      if (el) {
        gsap.killTweensOf(el);
      }
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
    const el = containerRef.current;
    if (!el) return;

    const resetTween = () => {
      if (flipTweenRef.current) {
        flipTweenRef.current.kill();
        flipTweenRef.current = null;
      }
    };

    if (!allow3d) {
      resetTween();
      el.style.transform = "";
      el.style.transition = "";
      gsapInitialisedRef.current = false;
      return;
    }

    el.style.transition = "";

    if (!gsapInitialisedRef.current) {
      gsap.set(el, {
        rotateY: flipped ? 180 : 0,
        transformPerspective: 1000,
        transformOrigin: "center center",
      });
      gsapInitialisedRef.current = true;
    }

    resetTween();

    const duration = preset === "result" ? durations.result : durations.default;
    const ease = preset === "result" ? "back.out(1.65)" : "power2.out";

    flipTweenRef.current = gsap.to(el, {
      duration,
      rotateY: flipped ? 180 : 0,
      ease,
      overwrite: "auto",
      transformPerspective: 1000,
      transformOrigin: "center center",
    });

    return () => {
      resetTween();
    };
  }, [allow3d, flipped, preset, durations.default, durations.result]);

  return containerRef;
}
