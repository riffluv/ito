"use client";
import { gsap } from "gsap";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";
import { Box } from "@chakra-ui/react";

interface RPGPageTransitionProps {
  children: React.ReactNode;
}

interface TransitionState {
  isTransitioning: boolean;
  direction: "in" | "out";
  targetPath?: string;
}

export function RPGPageTransition({ children }: RPGPageTransitionProps) {
  const router = useRouter();
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [transitionState, setTransitionState] = useState<TransitionState>({
    isTransitioning: false,
    direction: "in",
  });

  // シンプルなフェードトランジション
  const executeTransition = useCallback(async (targetPath: string) => {
    if (!containerRef.current || !overlayRef.current) return;

    const container = containerRef.current;
    const overlay = overlayRef.current;

    setTransitionState({ isTransitioning: true, direction: "out", targetPath });

    // 1. シンプルなフェードアウト
    gsap.set(overlay, {
      opacity: 0,
      backgroundColor: "rgba(8,9,15,0.95)",
      display: "block",
    });

    // 同時にフェード
    await Promise.all([
      gsap.to(overlay, { opacity: 1, duration: 0.3, ease: "power2.out" }).then(),
      gsap.to(container, { opacity: 0, duration: 0.3, ease: "power2.out" }).then(),
    ]);

    // ナビゲーション実行
    router.push(targetPath);
  }, [router]);

  // パス変更を検知してイントランジション実行
  useEffect(() => {
    // トランジション中でない場合、またはアウト方向でない場合はスキップ
    if (!transitionState.isTransitioning || transitionState.direction !== "out") {
      return;
    }

    // シンプルなフェードイン
    const executeInTransition = async () => {
      if (!containerRef.current || !overlayRef.current) return;

      const container = containerRef.current;
      const overlay = overlayRef.current;

      // 短い待機でページロードを確実にする
      await new Promise(resolve => setTimeout(resolve, 100));

      // 2. シンプルなフェードイン
      gsap.set(container, { opacity: 0 });

      // 同時にフェード
      await Promise.all([
        gsap.to(container, { opacity: 1, duration: 0.3, ease: "power2.out" }).then(),
        gsap.to(overlay, { opacity: 0, duration: 0.3, ease: "power2.out" }).then(),
      ]);

      // オーバーレイを非表示にして状態リセット
      gsap.set(overlay, { display: "none" });
      setTransitionState({ isTransitioning: false, direction: "in" });
    };

    executeInTransition();
  }, [pathname]); // pathnameが変わったときのみ実行

  // グローバル遷移関数をwindowに設定
  useEffect(() => {
    (window as any).__rpgNavigate = executeTransition;
    return () => {
      delete (window as any).__rpgNavigate;
    };
  }, [executeTransition]);

  return (
    <Box position="relative" minH="100vh">
      {/* メインコンテンツ */}
      <Box ref={containerRef}>
        {children}
      </Box>
      
      {/* トランジションオーバーレイ */}
      <Box
        ref={overlayRef}
        position="fixed"
        top="0"
        left="0"
        right="0"
        bottom="0"
        zIndex={9999}
        display="none"
        pointerEvents="none"
      />
    </Box>
  );
}

// RPG風ナビゲーションヘルパー関数
export const rpgNavigate = (path: string) => {
  const navigate = (window as any).__rpgNavigate;
  if (navigate && typeof navigate === "function") {
    navigate(path);
  } else {
    // フォールバック: 通常のナビゲーション
    window.location.href = path;
  }
};