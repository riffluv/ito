import { gsap } from "gsap";
import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import type {
  StreakBannerConfig,
  StreakLevel,
} from "@/components/ui/streak-banner/streakBannerConfig";

type Params = {
  streak: number;
  isVisible: boolean;
  streakLevel: StreakLevel;
  config: StreakBannerConfig;
  prefersReduced: boolean;
  onComplete?: () => void;
  containerRef: RefObject<HTMLDivElement>;
  contentRef: RefObject<HTMLDivElement>;
  numberRef: RefObject<HTMLDivElement>;
  labelRef: RefObject<HTMLDivElement>;
  lineLeftRef: RefObject<HTMLDivElement>;
  lineRightRef: RefObject<HTMLDivElement>;
  glowRef: RefObject<HTMLDivElement>;
};

export function useStreakBannerAnimation({
  streak,
  isVisible,
  streakLevel,
  config,
  prefersReduced,
  onComplete,
  containerRef,
  contentRef,
  numberRef,
  labelRef,
  lineLeftRef,
  lineRightRef,
  glowRef,
}: Params) {
  const onCompleteRef = useRef(onComplete);
  const prevVisibleRef = useRef(false);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const runAnimation = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    const number = numberRef.current;
    const label = labelRef.current;
    const lineLeft = lineLeftRef.current;
    const lineRight = lineRightRef.current;
    const glow = glowRef.current;

    if (!container || !content || !number || !label || !lineLeft || !lineRight) {
      return null;
    }

    gsap.set([container, content, number, label, lineLeft, lineRight], {
      force3D: true,
    });

    const tl = gsap.timeline({
      onComplete: () => {
        onCompleteRef.current?.();
      },
    });

    if (prefersReduced) {
      gsap.set(container, { autoAlpha: 0 });
      gsap.set(content, { opacity: 1, scale: 1 });
      gsap.set([number, label], { opacity: 1 });
      gsap.set([lineLeft, lineRight], { scaleX: 1, opacity: 1 });

      tl.to(container, { autoAlpha: 1, duration: 0.3, ease: "power2.out" })
        .to({}, { duration: config.holdDuration })
        .to(container, { autoAlpha: 0, duration: 0.3, ease: "power2.in" });

      return tl;
    }

    // 初期状態: 完全に隠す
    gsap.set(container, { autoAlpha: 0 });
    gsap.set(content, { opacity: 0, scale: 0.6 });
    gsap.set(number, { opacity: 0, scale: 2.5, y: 30, rotationX: -40 });
    gsap.set(label, { opacity: 0, y: 20, letterSpacing: "0.8em" });
    gsap.set(lineLeft, { scaleX: 0, transformOrigin: "right center" });
    gsap.set(lineRight, { scaleX: 0, transformOrigin: "left center" });
    if (glow) gsap.set(glow, { opacity: 0, scale: 0.5 });

    // 据え置きゲーム風カットイン演出
    tl.set(container, { autoAlpha: 1 });

    // グロー出現
    if (glow) {
      tl.to(
        glow,
        {
          opacity: 1,
          scale: config.intensity,
          duration: 0.15,
          ease: "power2.out",
        },
        0
      );
    }

    // コンテンツ全体の登場
    tl.to(
      content,
      {
        opacity: 1,
        scale: 1,
        duration: 0.25,
        ease: "power3.out",
      },
      0.05
    );

    // 数字: 奥から手前にドン！と飛び出す
    tl.to(
      number,
      {
        opacity: 1,
        scale: config.intensity * 1.2,
        y: -5,
        rotationX: 0,
        duration: 0.32,
        ease: "back.out(2.5)",
      },
      0.08
    ).to(number, {
      scale: config.intensity,
      y: 0,
      duration: 0.18,
      ease: "power2.out",
    });

    // 左右のライン: 中央から外側へ走る
    tl.to(
      lineLeft,
      {
        scaleX: 1,
        duration: 0.35,
        ease: "power3.out",
      },
      0.15
    ).to(
      lineRight,
      {
        scaleX: 1,
        duration: 0.35,
        ease: "power3.out",
      },
      0.15
    );

    // ラベル: 字間が縮まりながら登場
    tl.to(
      label,
      {
        opacity: 1,
        y: 0,
        letterSpacing: "0.35em",
        duration: 0.4,
        ease: "power2.out",
      },
      0.25
    );

    // Phase 2: インパクト（数字のパルス＋シェイク）
    if (streakLevel === "legend" || streakLevel === "great") {
      tl.to(number, {
        scale: config.intensity * 1.15,
        duration: 0.12,
        ease: "power2.out",
      }).to(number, {
        scale: config.intensity,
        duration: 0.1,
        ease: "power2.in",
      });

      if (streakLevel === "legend") {
        tl.to(content, {
          x: 8,
          duration: 0.035,
          repeat: 5,
          yoyo: true,
          ease: "power1.inOut",
        }).to(content, {
          x: 0,
          duration: 0.1,
          ease: "power2.out",
        });
      }
    }

    // Phase 3: ホールド（軽い浮遊感）
    tl.to(
      content,
      {
        y: -3,
        duration: config.holdDuration * 0.45,
        ease: "sine.inOut",
        yoyo: true,
        repeat: 1,
      },
      "-=0.05"
    );

    // グローの呼吸
    if (glow) {
      tl.to(
        glow,
        {
          scale: config.intensity * 1.1,
          opacity: 0.8,
          duration: config.holdDuration * 0.5,
          ease: "sine.inOut",
          yoyo: true,
          repeat: 1,
        },
        `-=${config.holdDuration * 0.9}`
      );
    }

    // Phase 4: 退場（光に包まれて上へ消える）
    tl.addLabel("exit");

    tl.to(
      [lineLeft, lineRight],
      {
        scaleX: 0,
        duration: 0.25,
        ease: "power2.in",
      },
      "exit"
    );

    tl.fromTo(
      container,
      {
        y: 0,
        autoAlpha: 1,
        scale: 1,
        filter: "brightness(1)",
      },
      {
        y: -50,
        autoAlpha: 0,
        scale: 0.95,
        filter: "brightness(1.5)",
        duration: 0.45,
        ease: "power2.in",
      },
      "exit"
    );

    return tl;
  }, [
    config,
    prefersReduced,
    streakLevel,
    containerRef,
    contentRef,
    numberRef,
    labelRef,
    lineLeftRef,
    lineRightRef,
    glowRef,
  ]);

  // Keep initial visibility under GSAP control to avoid flicker.
  useLayoutEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    const glow = glowRef.current;

    if (!container || !content) {
      return () => {};
    }

    gsap.set(container, {
      autoAlpha: 0,
      y: 0,
      scale: 1,
      filter: "brightness(1)",
      willChange: "transform, opacity, filter",
    });
    gsap.set(content, { opacity: 0, scale: 0.6, y: 0 });
    if (glow) gsap.set(glow, { opacity: 0, scale: 0.5 });

    return () => {
      gsap.set(container, {
        clearProps: "opacity,visibility,transform,filter,willChange",
      });
      gsap.set(content, { clearProps: "opacity,transform" });
      if (glow) gsap.set(glow, { clearProps: "opacity,transform" });
    };
  }, [containerRef, contentRef, glowRef]);

  useEffect(() => {
    const wasVisible = prevVisibleRef.current;
    prevVisibleRef.current = isVisible;

    if (!isVisible || streak < 2) {
      return undefined;
    }

    if (wasVisible) {
      return undefined;
    }

    const tl = runAnimation();
    if (tl) {
      tlRef.current = tl;
    }

    return () => {
      tlRef.current?.kill();
      tlRef.current = null;
    };
  }, [isVisible, streak, runAnimation]);
}

