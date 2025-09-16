import { Box, Text } from "@chakra-ui/react";
import { UI_TOKENS } from "@/theme/layout";
import { gsap } from "gsap";
import { useEffect, useRef } from "react";

interface GameResultOverlayProps {
  failed?: boolean;
  mode?: "overlay" | "inline"; // overlay: 中央に被せる, inline: 帯として表示
}

export function GameResultOverlay({
  failed,
  mode = "overlay",
}: GameResultOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<any>(null);

  // 豪華なGSAPアニメーション（CSS版より遥かに派手で美しい）
  useEffect(() => {
    if (mode !== "overlay" || !overlayRef.current || !textRef.current) return;

    const overlay = overlayRef.current;
    const text = textRef.current;

    // ユーザーのアクセシビリティ設定を尊重
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
    if (prefersReduced) {
      // 減らす運動が要請されている場合は最小限の視覚変化にして即時表示
      gsap.set(overlay, {
        scale: 1,
        opacity: 1,
        rotationY: 0,
        rotationX: 0,
        filter: "none",
      });
      gsap.set(text, {
        scale: 1,
        y: 0,
        opacity: 1,
        rotationZ: 0,
        filter: "none",
      });
    } else if (failed) {
      // 失敗アニメーション: ドラマチックで絶望的な演出
      const tl = gsap.timeline();
      tlRef.current = tl;

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
        .to(
          text,
          {
            scale: 1.1,
            y: 0,
            opacity: 1,
            rotationZ: 0,
            filter: "blur(0px)",
            duration: 0.4,
            ease: "elastic.out(1.2, 0.3)",
          },
          "-=0.3"
        )
        // サイズを正常に戻しつつ色彩効果
        .to(overlay, {
          scale: 1,
          duration: 0.2,
          ease: "power2.out",
        })
        .to(
          text,
          {
            scale: 1,
            duration: 0.2,
            ease: "power2.out",
          },
          "-=0.2"
        )
        // 失敗の絶望を表現する激しい振動（より派手に）
        .to(overlay, {
          x: () => gsap.utils.random(-15, 15),
          y: () => gsap.utils.random(-8, 8),
          rotation: () => gsap.utils.random(-5, 5),
          scale: () => gsap.utils.random(0.98, 1.02),
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
          ease: "elastic.out(1, 0.8)",
        })
        // 最後に重苦しい呼吸のような動き
        .to(overlay, {
          scale: 1.02,
          duration: 1.5,
          ease: "power1.inOut",
          yoyo: true,
          repeat: -1,
        });
    } else {
      // 成功アニメーション: 圧倒的な喜びと勝利の演出
      const tl = gsap.timeline();
      tlRef.current = tl;

      // 勝利の光が差すような華々しい登場
      tl.to(overlay, {
        scale: 1.3,
        opacity: 1,
        rotationY: 0,
        rotationX: 0,
        filter: "blur(0px)",
        duration: 0.5,
        ease: "back.out(3)",
      })
        // 勝利テキストの華麗な登場
        .to(
          text,
          {
            scale: 1.2,
            y: 0,
            opacity: 1,
            rotationZ: 0,
            filter: "blur(0px)",
            duration: 0.4,
            ease: "elastic.out(1.5, 0.4)",
          },
          "-=0.3"
        )
        // 勝利の余韻：ゆったりとしたサイズ調整
        .to(overlay, {
          scale: 1.1,
          duration: 0.3,
          ease: "power2.out",
        })
        .to(
          text,
          {
            scale: 1,
            duration: 0.3,
            ease: "power2.out",
          },
          "-=0.3"
        )
        // 喜びの弾み（より豪華に）
        .to(overlay, {
          scale: 1.15,
          y: -10,
          duration: 0.2,
          ease: "power3.out",
        })
        .to(overlay, {
          scale: 1.05,
          y: 0,
          duration: 0.3,
          ease: "bounce.out",
        })
        // 勝利を称える華やかな脈動
        .to(overlay, {
          scale: 1.08,
          duration: 0.8,
          ease: "sine.inOut",
          yoyo: true,
          repeat: 2,
        })
        // 永続的な勝利の浮遊感（より美しく）
        .to(overlay, {
          y: -5,
          rotationZ: 1,
          duration: 2,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        })
        // テキストにも微細な動きを追加
        .to(
          text,
          {
            y: -2,
            duration: 2.5,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
          },
          "-=2"
        );
    }

    return () => {
      // timeline があれば確実に破棄
      try {
        if (tlRef.current) {
          tlRef.current.kill();
          tlRef.current = null;
        }
      } catch {}

      // すべての tweens を停止
      try {
        gsap.killTweensOf(overlay);
        gsap.killTweensOf(text);
      } catch {}

      // inline style が残らないようにクリア
      try {
        gsap.set(overlay, {
          clearProps: "transform,opacity,filter,x,y,rotation,scale",
        });
        gsap.set(text, {
          clearProps: "transform,opacity,filter,x,y,rotation,scale",
        });
      } catch {}
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
          textShadow={UI_TOKENS.TEXT_SHADOWS.soft}
          bg={UI_TOKENS.COLORS.panelBg80}
          border={`2px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
          borderRadius={0} // 角ばったデザイン
        >
          ▲ しっぱい
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
        textShadow={UI_TOKENS.TEXT_SHADOWS.soft}
        bg={UI_TOKENS.COLORS.panelBg80}
        border={`2px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
        borderRadius={0} // 角ばったデザイン
      >
        ◆ クリア!
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
        borderRadius={0}
        fontWeight={800}
        fontSize={{ base: "23px", md: "29px" }}
        color="white" // ドラクエ風統一白文字
        letterSpacing={1} // やや控えめに
        // ドラクエ風ボーダー統一
        border="3px solid"
        borderColor={UI_TOKENS.COLORS.whiteAlpha90}
        css={{
          // ドラクエ風統一リッチブラック背景
          background: UI_TOKENS.COLORS.panelBg,
          // ドラクエ風統一シャドウ
          boxShadow: "3px 3px 0 rgba(0,0,0,0.8), 6px 6px 0 rgba(0,0,0,0.6), inset 1px 1px 0 rgba(255,255,255,0.1)",
          // ガラス効果除去 - ドラクエ風
        }}
      >
        <Box ref={textRef} textAlign="center">
          {failed ? "▲ しっぱい!" : "◆ クリア! ◆"} {/* ドラクエ風日本語 */}
          <Text
            fontSize={{ base: "15px", md: "17px" }}
            mt={2}
            opacity={0.9}
            fontFamily="monospace" // ドラクエ風フォント統一
            fontWeight={500}
            letterSpacing="0.5px"
            textShadow="1px 1px 0px #000" // ドラクエ風テキストシャドウ
          >
            {failed
              ? "もういちど ちょうせんしよう!"
              : "みごとな じゅんばんでした!"}{" "}
            {/* ドラクエ風メッセージ */}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
