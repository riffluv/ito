"use client";

import { Box } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";

/**
 * HD-2D風 満月モチーフローディングスピナー
 *
 * デザイン指示書 v1/v2 準拠:
 * - 「夜の城で行われる紋章の儀式」をテーマにした満月モチーフ
 * - 完全なフラット円ではなく、色ムラ・陰影のある「月面」を表現
 * - 外周にごく淡い光のリングと、さらに薄い外枠リング
 * - 回転は不均一（0%→30%→60%→100%で角度進行を変える）
 * - 星/粒子は不等間隔配置、点滅タイミングも不規則
 *
 * AI感排除の工夫:
 * - 一定速度回転を避け、イージングに"手癖"を入れる
 * - 余白・サイズ・タイミングの微差（均一を避ける）
 * - ベジェカーブで「ほんの少しぎこちない」動きを作る
 */

// ======================================
// 🌙 手癖イージング（デザイン指示書より）
// ======================================
const handEasing = "cubic-bezier(.22,.8,.3,1)";
const handEasingSlow = "cubic-bezier(.16,.9,.2,1)";

// ======================================
// 🌙 不均一回転（v2: 0%→30%→60%→100%で角度進行を変える）
// ======================================
const rotateUneven = keyframes`
  0%   { transform: rotate(0deg); }
  30%  { transform: rotate(138deg); }
  60%  { transform: rotate(217deg); }
  100% { transform: rotate(360deg); }
`;

// ======================================
// ✨ 星の点滅（v1 flickerパターン応用: 不等間隔）
// ======================================
const starFlicker1 = keyframes`
  0%, 100% { opacity: 0.15; transform: translate(-50%, -50%) scale(0.7); }
  11% { opacity: 0.85; transform: translate(-50%, -50%) scale(1.05); }
  24% { opacity: 0.6; transform: translate(-50%, -50%) scale(0.92); }
  39% { opacity: 1; transform: translate(-50%, -50%) scale(1.12); }
  57% { opacity: 0.4; transform: translate(-50%, -50%) scale(0.85); }
  78% { opacity: 0.7; transform: translate(-50%, -50%) scale(0.95); }
`;

const starFlicker2 = keyframes`
  0%, 100% { opacity: 0.2; transform: translate(-50%, -50%) scale(0.75); }
  17% { opacity: 0.95; transform: translate(-50%, -50%) scale(1.08); }
  33% { opacity: 0.5; transform: translate(-50%, -50%) scale(0.88); }
  52% { opacity: 0.85; transform: translate(-50%, -50%) scale(1.02); }
  71% { opacity: 0.35; transform: translate(-50%, -50%) scale(0.8); }
  89% { opacity: 0.6; transform: translate(-50%, -50%) scale(0.9); }
`;

const starFlicker3 = keyframes`
  0%, 100% { opacity: 0.25; transform: translate(-50%, -50%) scale(0.65); }
  14% { opacity: 0.7; transform: translate(-50%, -50%) scale(0.98); }
  29% { opacity: 1; transform: translate(-50%, -50%) scale(1.15); }
  48% { opacity: 0.55; transform: translate(-50%, -50%) scale(0.9); }
  67% { opacity: 0.8; transform: translate(-50%, -50%) scale(1.0); }
  83% { opacity: 0.3; transform: translate(-50%, -50%) scale(0.72); }
`;

// ======================================
// 🌟 月光リングの微細な脈動
// ======================================
const moonGlowPulse = keyframes`
  0%, 100% { 
    box-shadow: 
      0 0 8px 2px rgba(255, 248, 220, 0.35),
      0 0 16px 4px rgba(255, 240, 200, 0.18),
      0 0 24px 6px rgba(255, 230, 180, 0.08);
  }
  32% { 
    box-shadow: 
      0 0 10px 3px rgba(255, 248, 220, 0.42),
      0 0 18px 5px rgba(255, 240, 200, 0.22),
      0 0 28px 7px rgba(255, 230, 180, 0.1);
  }
  67% { 
    box-shadow: 
      0 0 7px 2px rgba(255, 248, 220, 0.32),
      0 0 14px 3px rgba(255, 240, 200, 0.16),
      0 0 22px 5px rgba(255, 230, 180, 0.07);
  }
`;

interface HD2DLoadingSpinnerProps {
  size?: string;
}

export function HD2DLoadingSpinner({ size = "32px" }: HD2DLoadingSpinnerProps) {
  // ======================================
  // ✨ 星の配置データ（AI感排除: 不等間隔）
  // ======================================
  // 90度等分ではなく、微妙にずらした角度配置
  const stars = [
    {
      angle: 37,
      distance: 52,
      delay: 0,
      size: 3.5,
      flicker: starFlicker1,
      duration: "2.7s",
    },
    {
      angle: 143,
      distance: 56,
      delay: 0.31,
      size: 4,
      flicker: starFlicker2,
      duration: "2.3s",
    },
    {
      angle: 227,
      distance: 49,
      delay: 0.67,
      size: 3,
      flicker: starFlicker3,
      duration: "2.9s",
    },
    {
      angle: 311,
      distance: 54,
      delay: 0.19,
      size: 3.8,
      flicker: starFlicker1,
      duration: "2.5s",
    },
  ];

  return (
    <Box
      position="relative"
      width={size}
      height={size}
      display="inline-flex"
      alignItems="center"
      justifyContent="center"
      role="status"
      aria-label="読み込み中"
    >
      {/* ====================================== */}
      {/* 🌙 外側リング（薄い月光の輪） */}
      {/* ====================================== */}
      <Box
        position="absolute"
        inset="-4px"
        borderRadius="50%"
        border="1px solid rgba(255, 250, 230, 0.25)"
        pointerEvents="none"
      />

      {/* ====================================== */}
      {/* 🌙 月光グローリング */}
      {/* ====================================== */}
      <Box
        position="absolute"
        inset="-2px"
        borderRadius="50%"
        border="1px solid rgba(255, 245, 215, 0.4)"
        animation={`${moonGlowPulse} 3.7s ${handEasingSlow} infinite`}
        pointerEvents="none"
      />

      {/* ====================================== */}
      {/* 🌕 満月ディスク本体（不均一回転） */}
      {/* ====================================== */}
      <Box
        position="absolute"
        inset="0"
        borderRadius="50%"
        // HD-2D風: 色ムラのある月面グラデーション
        // 完全なフラットではなく、微妙な明暗を持つ
        background={`
          radial-gradient(
            ellipse 65% 55% at 42% 38%,
            rgba(255, 252, 240, 0.95) 0%,
            rgba(248, 235, 200, 0.9) 25%,
            transparent 70%
          ),
          radial-gradient(
            ellipse 50% 45% at 62% 65%,
            rgba(215, 195, 150, 0.4) 0%,
            transparent 60%
          ),
          radial-gradient(
            circle at 50% 50%,
            #f5e6c8 0%,
            #e8d4a8 35%,
            #d4be88 65%,
            #c4a870 100%
          )
        `}
        // 月のエッジにほんのりインナーシャドウ
        boxShadow={`
          inset 1px 1px 3px rgba(255, 255, 255, 0.35),
          inset -2px -2px 5px rgba(180, 150, 100, 0.25),
          0 0 6px rgba(255, 240, 200, 0.5)
        `}
        animation={`${rotateUneven} 4.7s ${handEasing} infinite`}
      >
        {/* 月面のクレーター風の微細なムラ（position absoluteの子要素） */}
        <Box
          position="absolute"
          top="22%"
          left="28%"
          width="18%"
          height="16%"
          borderRadius="50%"
          background="rgba(190, 170, 135, 0.35)"
          filter="blur(1px)"
          pointerEvents="none"
        />
        <Box
          position="absolute"
          top="55%"
          left="58%"
          width="14%"
          height="12%"
          borderRadius="50%"
          background="rgba(175, 155, 120, 0.3)"
          filter="blur(0.8px)"
          pointerEvents="none"
        />
        <Box
          position="absolute"
          top="38%"
          left="52%"
          width="10%"
          height="9%"
          borderRadius="50%"
          background="rgba(200, 180, 145, 0.25)"
          filter="blur(0.5px)"
          pointerEvents="none"
        />
      </Box>

      {/* ====================================== */}
      {/* ✨ 星/粒子（不等間隔配置・不規則点滅） */}
      {/* ====================================== */}
      {stars.map((star, index) => {
        const radians = (star.angle * Math.PI) / 180;
        const x = 50 + Math.cos(radians) * star.distance;
        const y = 50 + Math.sin(radians) * star.distance;

        return (
          <Box
            key={index}
            position="absolute"
            top={`${y}%`}
            left={`${x}%`}
            width={`${star.size}px`}
            height={`${star.size}px`}
            borderRadius="50%"
            // 星の色味: 月光を反射したような淡い黄金〜白
            background={`radial-gradient(
              circle at 40% 40%,
              rgba(255, 255, 250, 0.98) 0%,
              rgba(255, 245, 220, 0.85) 50%,
              rgba(255, 230, 180, 0.5) 100%
            )`}
            boxShadow={`
              0 0 ${star.size * 1.5}px rgba(255, 240, 200, 0.7),
              0 0 ${star.size * 2.5}px rgba(255, 230, 180, 0.4)
            `}
            animation={`${star.flicker} ${star.duration} ${handEasing} infinite`}
            style={{ animationDelay: `${star.delay}s` }}
            pointerEvents="none"
          />
        );
      })}
    </Box>
  );
}
