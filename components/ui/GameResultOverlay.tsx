import { Box, Text } from "@chakra-ui/react";
import { UI_TOKENS } from "@/theme/layout";
import { gsap } from "gsap";
import { useEffect, useRef } from "react";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { useSoundEffect } from "@/lib/audio/useSoundEffect";

const VICTORY_TITLE = "🏆 勝利！";
const FAILURE_TITLE = "💀 失敗…";
const VICTORY_SUBTEXT = "みんなの連携が実を結びました！";
const FAILURE_SUBTEXT = "もう一度チャレンジしてみましょう。";

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
  const particlesRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const linesRef = useRef<(HTMLDivElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const prefersReduced = useReducedMotionPreference();
  const playVictory = useSoundEffect("result_victory");
  const playFailure = useSoundEffect("result_failure");

  useEffect(() => {
    if (mode !== "overlay") return;
    if (failed) {
      playFailure();
    } else {
      playVictory();
    }
  }, [failed, mode, playFailure, playVictory]);

  useEffect(() => {
    if (mode !== "overlay") return;
    const overlay = overlayRef.current;
    const text = textRef.current;
    const container = containerRef.current;
    if (!overlay || !text || !container) return;

    // containerを初期状態で中央に固定
    gsap.set(container, {
      xPercent: -50,
      yPercent: -50,
      x: 0,
      y: 0,
      rotation: 0,
    });

    if (prefersReduced) {
      gsap.set(overlay, { opacity: 1, scale: 1, rotationX: 0, rotationY: 0 });
      gsap.set(text, { opacity: 1, y: 0, scale: 1 });
      return;
    }

    const tl = gsap.timeline();
    tlRef.current = tl;

    if (failed) {
      // ドラクエ風劇的失敗演出！

      // Phase 1: 衝撃的登場
      tl.fromTo(
        overlay,
        {
          opacity: 0,
          scale: 1.8,
          rotationX: 30,
          rotationZ: -10,
          filter: "blur(8px) brightness(0.5) saturate(0.4)",
          transformOrigin: "50% 50%"
        },
        {
          opacity: 1,
          scale: 0.7,
          rotationX: 0,
          rotationZ: 0,
          filter: "blur(0px) brightness(0.7) saturate(0.6)",
          duration: 0.4,
          ease: "power4.out",
        }
      )

      // Phase 2: 重苦しい膨張
      .to(overlay, {
        scale: 1.15,
        duration: 0.35,
        ease: "power2.out",
      })

      // Phase 3: テキスト重たい登場
      .fromTo(
        text,
        {
          opacity: 0,
          y: -30,
          scale: 1.4,
          rotationX: -20,
          filter: "blur(3px)"
        },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          rotationX: 0,
          filter: "blur(0px)",
          duration: 0.5,
          ease: "power3.out",
        },
        "-=0.2"
      )

      // Phase 4: 激しい振動（地震のような）
      .to(overlay, {
        x: () => gsap.utils.random(-15, 15),
        y: () => gsap.utils.random(-8, 8),
        rotation: () => gsap.utils.random(-2, 2),
        duration: 0.06,
        repeat: 20,
        yoyo: true,
        ease: "power2.inOut",
      })

      // Phase 5: 重力落下演出
      .to(overlay, {
        y: 15,
        scale: 1.05,
        duration: 0.6,
        ease: "bounce.out"
      })
      .to(text, {
        y: 5,
        duration: 0.6,
        ease: "bounce.out"
      }, "-=0.6")

      // Phase 6: 最終位置へ重たく安定（一定の暗さで固定）
      .to(overlay, {
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1,
        filter: "brightness(0.65) saturate(0.6)",
        boxShadow: "0 0 12px rgba(139,0,0,0.4), inset 0 0 8px rgba(0,0,0,0.6)",
        duration: 0.4,
        ease: "power3.out"
      })
      .to(text, {
        y: 0,
        duration: 0.4,
        ease: "power3.out"
      }, "-=0.4")

      // Phase 7: 自然な永続浮遊（明暗変化なし）
      .to(
        overlay,
        {
          y: 3,
          rotation: -0.3,
          duration: 3.5,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        },
        "-=0.1"
      )
      .to(
        text,
        {
          y: 1,
          duration: 3.5,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        },
        "-=3.5"
      )

      // Phase 8: 控えめな痙攣的な動き（失敗の余韻）
      .to(
        overlay,
        {
          x: () => gsap.utils.random(-2, 2),
          scale: () => gsap.utils.random(0.99, 1.01),
          duration: 0.12,
          ease: "power2.out",
          repeat: 1,
          yoyo: true,
          repeatDelay: 6, // 6秒ごとに控えめな痙攣
        },
        4 // 4秒後から開始
      )
      .to(
        text,
        {
          x: () => gsap.utils.random(-1, 1),
          duration: 0.12,
          ease: "power2.out",
          repeat: 1,
          yoyo: true,
          repeatDelay: 6,
        },
        4
      );
    } else {
      // ドラクエ風爆発演出！ + オクトパストラベラーBOOST風！

      // ====================================================
      // BOOST Phase 0: ホワイトフラッシュ（衝撃的開幕）
      // ====================================================
      tl.fromTo(
        flashRef.current,
        { opacity: 0 },
        {
          opacity: 1,
          duration: 0.05,
          ease: "power4.in",
        }
      )
      .to(flashRef.current, {
        opacity: 0,
        duration: 0.25,
        ease: "power2.out"
      });

      // ====================================================
      // BOOST Phase 0.5: 放射状ライン爆発（3段階！）
      // LEFT → RIGHT → CENTER！！
      // ====================================================

      // 【第1波】LEFT から爆発（0.05s）
      [0, 1, 7].forEach((index) => {
        const line = linesRef.current[index];
        if (!line) return;
        tl.fromTo(
          line,
          { scaleX: 0, opacity: 1 },
          {
            scaleX: 3.5,
            opacity: 0,
            duration: 0.6,
            ease: "power3.out",
          },
          0.05
        );
      });

      // 【第2波】RIGHT から爆発（0.15s）
      [3, 4, 5].forEach((index) => {
        const line = linesRef.current[index];
        if (!line) return;
        tl.fromTo(
          line,
          { scaleX: 0, opacity: 1 },
          {
            scaleX: 3.5,
            opacity: 0,
            duration: 0.6,
            ease: "power3.out",
          },
          0.15
        );
      });

      // 【第3波】CENTER（上下）から爆発（0.25s）
      [2, 6].forEach((index) => {
        const line = linesRef.current[index];
        if (!line) return;
        tl.fromTo(
          line,
          { scaleX: 0, opacity: 1 },
          {
            scaleX: 4,
            opacity: 0,
            duration: 0.8,
            ease: "power4.out",
          },
          0.25
        );
      });

      // ====================================================
      // BOOST Phase 0.7: コンテナシェイク（衝撃波）
      // ====================================================
      tl.to(
        container,
        {
          x: 8,
          duration: 0.04,
          repeat: 8,
          yoyo: true,
          ease: "power1.inOut",
        },
        0.1
      )
      // シェイク後、確実に中央に戻す（xPercent維持）
      .to(
        container,
        {
          x: 0,
          y: 0,
          rotation: 0,
          duration: 0.1,
          ease: "power2.out",
        }
      );

      // ====================================================
      // Phase 1: 画面左外から超高速で飛んでくる！！
      // ====================================================
      tl.fromTo(
        overlay,
        {
          x: -window.innerWidth - 500, // 画面左外
          opacity: 0,
          scale: 0.5,
          rotation: -25,
          filter: "blur(20px) brightness(5)", // 超明るくブレながら
        },
        {
          x: 0, // 中央に到着！
          opacity: 1,
          scale: 1.3,
          rotation: 5, // 少し回転しながら
          filter: "blur(0px) brightness(1.5)",
          duration: 0.4, // 0.5 → 0.4 に短縮！
          ease: "power3.out",
        },
        0.15 // ライン爆発と同時
      )
      // 到着時の反動（ビシッ！）
      .to(overlay, {
        scale: 1.1,
        rotation: 0,
        filter: "brightness(1.3)",
        duration: 0.15, // 0.2 → 0.15 に短縮！
        ease: "back.out(3)",
      })

      // Phase 2: 強烈なバウンス（ドラクエのレベルアップ感）
      .to(overlay, {
        scale: 0.8,
        duration: 0.12,
        ease: "power4.in"
      })
      .to(overlay, {
        scale: 1.4,
        rotation: 3,
        duration: 0.25,
        ease: "elastic.out(1.8, 0.3)"
      })
      .to(overlay, {
        scale: 0.95,
        rotation: -2,
        duration: 0.15,
        ease: "power3.in"
      })
      .to(overlay, {
        scale: 1.15,
        rotation: 1,
        duration: 0.2,
        ease: "back.out(2)",
        filter: "brightness(1.5) saturate(1.3)"
      })

      // Phase 3: テキスト躍動（枠とほぼ同時に登場！）
      .fromTo(
        text,
        {
          opacity: 0,
          y: 30,
          scale: 0.8,
          rotationX: 30,
          filter: "blur(8px) brightness(5)" // 明るくスタート
        },
        {
          opacity: 1,
          y: 0,
          scale: 1.1,
          rotationX: 0,
          filter: "blur(0px) brightness(1)",
          duration: 0.35, // 0.45 → 0.35 に短縮！
          ease: "back.out(2.5)",
        },
        0.5 // "-=0.4" → 0.5 に変更（枠到着とほぼ同時）
      )

      // Phase 4: 派手な跳ね演出 + 黄金演出の連動
      .to(text, {
        y: -12,
        scale: 1.25,
        rotation: -1,
        duration: 0.3,
        ease: "power2.out"
      })
      // 輝きの予兆（テキストが頂点に達した時）
      .to(overlay, {
        boxShadow: "0 0 8px rgba(255,255,255,0.4), inset 0 0 5px rgba(255,255,255,0.1)",
        duration: 0.15,
        ease: "power1.out"
      }, "-=0.15")

      .to(text, {
        y: 8,
        scale: 0.9,
        rotation: 1,
        duration: 0.2,
        ease: "power2.in"
      })
      // 薄い金色（テキストが下に弾む時）
      .to(overlay, {
        boxShadow: "0 0 15px rgba(255,235,100,0.6), 0 0 30px rgba(255,235,100,0.3), inset 0 0 8px rgba(255,255,255,0.2)",
        duration: 0.2,
        ease: "power2.out"
      }, "-=0.2")

      .to(text, {
        y: -5,
        scale: 1.05,
        rotation: 0,
        duration: 0.35,
        ease: "elastic.out(1.5, 0.4)"
      })
      // 濃い黄金（テキストがエラスティックで弾む時）
      .to(overlay, {
        boxShadow: "0 0 22px rgba(255,215,0,0.8), 0 0 45px rgba(255,215,0,0.4), inset 0 0 12px rgba(255,255,255,0.3)",
        duration: 0.35,
        ease: "elastic.out(1.5, 0.4)"
      }, "-=0.35")

      // Phase 6: 最終安定 + 永続浮遊
      .to(overlay, {
        scale: 1.08,
        rotation: 0,
        filter: "brightness(1.2)",
        boxShadow: "0 0 15px rgba(255,215,0,0.6), inset 0 0 8px rgba(255,255,255,0.2)",
        duration: 0.4,
        ease: "power3.out"
      })
      .to(text, {
        y: 0,
        scale: 1,
        duration: 0.3,
        ease: "elastic.out(1.3, 0.5)"
      }, "-=0.2")
      // containerを完全に中央にリセット（念押し・xPercentは維持）
      .to(container, {
        x: 0,
        y: 0,
        rotation: 0,
        duration: 0.2,
        ease: "power2.out"
      }, "-=0.2")

      // Phase 7: 自然な永続浮遊（呼吸のような）
      .to(
        overlay,
        {
          y: -6,
          rotationZ: 0.7,
          scale: 1.03,
          duration: 3.2, // より自然な呼吸周期
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        },
        "-=0.1"
      )
      .to(
        text,
        {
          y: -2,
          rotationZ: -0.3,
          duration: 3.4, // 少しズレたタイミング
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        },
        "-=3.1" // 微妙にずらして自然さを演出
      )

      // Phase 8: 黄金の呼吸（輝きのゆらぎ）
      .to(
        overlay,
        {
          boxShadow: "0 0 18px rgba(255,215,0,0.6), 0 0 40px rgba(255,215,0,0.3), inset 0 0 10px rgba(255,255,255,0.2)",
          duration: 2.8,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        },
        "-=3.2"
      )

      // パーティクル風演出（キラキラ）
      .set({}, {}, 0) // パーティクル用のプレースホルダー
      ;
    }

    return () => {
      tlRef.current?.kill();
      tlRef.current = null;
      // より確実なクリーンアップ
      if (overlay) {
        gsap.set(overlay, { clearProps: "all" });
      }
      if (text) {
        gsap.set(text, { clearProps: "all" });
      }
      if (flashRef.current) {
        gsap.set(flashRef.current, { clearProps: "all" });
      }
      if (container) {
        // 中央位置は保持しつつ、アニメーションプロパティのみクリア
        gsap.set(container, {
          xPercent: -50,
          yPercent: -50,
          x: 0,
          y: 0,
          rotation: 0,
        });
      }
      linesRef.current.forEach((line) => {
        if (line) {
          gsap.set(line, { clearProps: "all" });
        }
      });
    };
  }, [failed, mode, prefersReduced]);

  const title = failed ? FAILURE_TITLE : VICTORY_TITLE;
  const subtext = failed ? FAILURE_SUBTEXT : VICTORY_SUBTEXT;

  if (mode === "inline") {
    return (
      <Box
        color="white"
        letterSpacing={0.5}
        whiteSpace="nowrap"
        fontFamily="monospace"
        textShadow={UI_TOKENS.TEXT_SHADOWS.soft}
        bg={UI_TOKENS.COLORS.panelBg80}
        border={`2px solid ${UI_TOKENS.COLORS.whiteAlpha90}`}
        borderRadius={0}
        px={4}
        py={2}
        fontWeight={700}
      >
        {title}
      </Box>
    );
  }

  return (
    <Box
      ref={containerRef}
      position="absolute"
      top="50%"
      left="50%"
      zIndex={10}
    >
      {/* ホワイトフラッシュ（全画面） */}
      <Box
        ref={flashRef}
        position="fixed"
        inset={0}
        bg="white"
        opacity={0}
        pointerEvents="none"
        zIndex={9999}
      />

      {/* 放射状ライン（8本）*/}
      {[...Array(8)].map((_, i) => {
        const angle = (360 / 8) * i;
        return (
          <Box
            key={i}
            ref={(el) => {
              linesRef.current[i] = el;
            }}
            position="fixed"
            top="50%"
            left="50%"
            width="200vw"
            height="6px"
            bg="linear-gradient(90deg, rgba(255,255,255,0.95), rgba(255,255,255,0.6) 50%, transparent)"
            transformOrigin="left center"
            transform={`rotate(${angle}deg)`}
            opacity={0}
            zIndex={9998}
            pointerEvents="none"
          />
        );
      })}

      <Box
        ref={overlayRef}
        px={{ base: 6, md: 8 }}
        py={{ base: 4, md: 5 }}
        borderRadius={0}
        fontWeight={800}
        fontSize={{ base: "22px", md: "28px" }}
        color="white"
        letterSpacing={1}
        border="3px solid"
        borderColor={UI_TOKENS.COLORS.whiteAlpha90}
        css={{
          background: UI_TOKENS.COLORS.panelBg,
          boxShadow:
            "3px 3px 0 rgba(0,0,0,0.8), 6px 6px 0 rgba(0,0,0,0.6), inset 1px 1px 0 rgba(255,255,255,0.1)",
        }}
      >
        <Box ref={textRef} textAlign="center">
          {title}
          <Text
            fontSize={{ base: "15px", md: "17px" }}
            mt={2}
            opacity={0.9}
            fontFamily="monospace"
            fontWeight={500}
            letterSpacing="0.5px"
            textShadow="1px 1px 0px #000"
          >
            {subtext}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
