import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Box, Text } from "@chakra-ui/react";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";

interface GameResultOverlayProps {
  failed?: boolean;
  failedAt?: number | null;
  mode?: "overlay" | "inline"; // overlay: 中央に被せる, inline: 帯として表示
}

export function GameResultOverlay({
  failed,
  failedAt,
  mode = "overlay",
}: GameResultOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  // 豪華なGSAPアニメーション（CSS版より遥かに派手で美しい）
  useEffect(() => {
    if (mode !== "overlay" || !overlayRef.current || !textRef.current) return;

    const overlay = overlayRef.current;
    const text = textRef.current;

    // 初期状態をリセット（より派手な初期設定）
    gsap.set(overlay, { 
      scale: 0.3, 
      opacity: 0, 
      rotationY: -180, 
      rotationX: 45,
      filter: "blur(10px)",
    });
    gsap.set(text, { 
      scale: 0.5, 
      y: 50, 
      opacity: 0,
      rotationZ: -15,
      filter: "blur(5px)",
    });

    if (failed) {
      // 失敗アニメーション: ドラマチックで絶望的な演出
      const tl = gsap.timeline();
      
      // 衝撃的な登場（画面全体が震えるような重厚感）
      tl.to(overlay, {
        scale: 1.2,
        opacity: 1,
        rotationY: 0,
        rotationX: 0,
        filter: "blur(0px)",
        duration: 0.6,
        ease: "power4.out",
      })
      // テキストの衝撃的登場
      .to(text, {
        scale: 1.1,
        y: 0,
        opacity: 1,
        rotationZ: 0,
        filter: "blur(0px)",
        duration: 0.4,
        ease: "elastic.out(1.2, 0.3)",
      }, "-=0.3")
      // サイズを正常に戻しつつ色彩効果
      .to(overlay, {
        scale: 1,
        duration: 0.2,
        ease: "power2.out"
      })
      .to(text, {
        scale: 1,
        duration: 0.2,
        ease: "power2.out"
      }, "-=0.2")
      // 失敗の絶望を表現する激しい振動（より派手に）
      .to(overlay, {
        x: "random(-15, 15)",
        y: "random(-8, 8)",
        rotation: "random(-5, 5)",
        scale: "random(0.98, 1.02)",
        repeat: 12,
        duration: 0.06,
        ease: "power2.inOut",
        yoyo: true,
      })
      // 振動から立ち直りつつ絶望感を演出
      .to(overlay, {
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1,
        duration: 0.4,
        ease: "elastic.out(1, 0.8)"
      })
      // 最後に重苦しい呼吸のような動き
      .to(overlay, {
        scale: 1.02,
        duration: 1.5,
        ease: "power1.inOut",
        yoyo: true,
        repeat: -1
      });
    } else {
      // 成功アニメーション: 圧倒的な喜びと勝利の演出
      const tl = gsap.timeline();
      
      // 勝利の光が差すような華々しい登場
      tl.to(overlay, {
        scale: 1.3,
        opacity: 1,
        rotationY: 0,
        rotationX: 0,
        filter: "blur(0px)",
        duration: 0.5,
        ease: "back.out(3)"
      })
      // 勝利テキストの華麗な登場
      .to(text, {
        scale: 1.2,
        y: 0,
        opacity: 1,
        rotationZ: 0,
        filter: "blur(0px)",
        duration: 0.4,
        ease: "elastic.out(1.5, 0.4)",
      }, "-=0.3")
      // 勝利の余韻：ゆったりとしたサイズ調整
      .to(overlay, {
        scale: 1.1,
        duration: 0.3,
        ease: "power2.out"
      })
      .to(text, {
        scale: 1,
        duration: 0.3,
        ease: "power2.out"
      }, "-=0.3")
      // 喜びの弾み（より豪華に）
      .to(overlay, {
        scale: 1.15,
        y: -10,
        duration: 0.2,
        ease: "power3.out"
      })
      .to(overlay, {
        scale: 1.05,
        y: 0,
        duration: 0.3,
        ease: "bounce.out"
      })
      // 勝利を称える華やかな脈動
      .to(overlay, {
        scale: 1.08,
        duration: 0.8,
        ease: "sine.inOut",
        yoyo: true,
        repeat: 2
      })
      // 永続的な勝利の浮遊感（より美しく）
      .to(overlay, {
        y: -5,
        rotationZ: 1,
        duration: 2,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1
      })
      // テキストにも微細な動きを追加
      .to(text, {
        y: -2,
        duration: 2.5,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1
      }, "-=2");
    }

    return () => {
      gsap.killTweensOf(overlay);
      gsap.killTweensOf(text);
    };
  }, [failed, mode]);
  
  // インライン表示: カードと被せず帯として表示
  if (mode === "inline") {
    if (failed) {
      return (
        <Box
          as="span"
          display="inline-block"
          px={2}
          py={1}
          fontWeight={700}
          fontSize={{ base: "sm", md: "sm" }}
          color="white" // ドラクエ風白文字統一
          letterSpacing={0.5}
          whiteSpace="nowrap"
          aria-live="polite"
          role="status"
          fontFamily="monospace" // ドラクエ風フォント
          textShadow="1px 1px 0px #000" // ドラクエ風テキストシャドウ
          bg="rgba(8,9,15,0.8)" // ドラクエ風リッチブラック背景
          border="2px solid rgba(255,255,255,0.9)" // ドラクエ風ボーダー
          borderRadius={0} // 角ばったデザイン
        >
          💥 しっぱい{typeof failedAt === "number" ? ` #${failedAt}` : ""}
        </Box>
      );
    }
    return (
      <Box
        as="span"
        display="inline-block"
        px={2}
        py={1}
        fontWeight={700}
        fontSize={{ base: "sm", md: "sm" }}
        color="white" // ドラクエ風白文字統一
        letterSpacing={0.5}
        whiteSpace="nowrap"
        aria-live="polite"
        role="status"
        fontFamily="monospace" // ドラクエ風フォント
        textShadow="1px 1px 0px #000" // ドラクエ風テキストシャドウ
        bg="rgba(8,9,15,0.8)" // ドラクエ風リッチブラック背景
        border="2px solid rgba(255,255,255,0.9)" // ドラクエ風ボーダー
        borderRadius={0} // 角ばったデザイン
      >
        ✨ クリア!
      </Box>
    );
  }

  return (
    <Box
      position="absolute"
      top="50%"
      left="50%"
      transform="translate(-50%, -50%)"
      zIndex={10}
    >
      <Box
        ref={overlayRef}
        px={8}
        py={5}
        rounded="2xl"
        fontWeight={800}
        fontSize={{ base: "2xl", md: "3xl" }}
        color="white" // ドラクエ風統一白文字
        letterSpacing={1} // やや控えめに
        // ドラクエ風ボーダー統一
        border="3px solid"
        borderColor="rgba(255,255,255,0.9)" // メインメニューと同じ白ボーダー
        borderRadius={0} // ドラクエ風角ばった
        css={{
          // ドラクエ風統一リッチブラック背景
          background: "rgba(8,9,15,0.95)", // メインメニューと同じ
          // ドラクエ風統一シャドウ
          boxShadow: "inset 0 3px 0 rgba(255,255,255,0.08), inset 0 -3px 0 rgba(0,0,0,0.4), 0 12px 24px rgba(0,0,0,0.5)", // メインメニューと同じ立体感
          backdropFilter: "blur(12px) saturate(1.2)", // メインメニューと同じ
        }}
      >
        <Box ref={textRef}>
          {failed ? "💥 しっぱい!" : "✨ クリア! ✨"} {/* ドラクエ風日本語 */}
          <Text
            fontSize={{ base: "md", md: "lg" }}
            mt={2}
            opacity={0.9}
            fontFamily="monospace" // ドラクエ風フォント統一
            fontWeight={500}
            letterSpacing="0.5px"
            textShadow="1px 1px 0px #000" // ドラクエ風テキストシャドウ
          >
            {failed ? "もういちど ちょうせんしよう!" : "みごとな じゅんばんでした!"} {/* ドラクエ風メッセージ */}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
