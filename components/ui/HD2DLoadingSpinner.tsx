"use client";

import { Box } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";

// 手癖easing（デザイン指示書より）
const handEasing = "cubic-bezier(.2,1,.3,1)";

// 回転アニメーション（微妙に不均一な速度）
const rotateAnimation = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

// 逆回転（少し速度差をつける）
const rotateReverseAnimation = keyframes`
  0% { transform: rotate(360deg); }
  100% { transform: rotate(0deg); }
`;

// 脈動（不等間隔・手癖のリズム）
const pulseAnimation = keyframes`
  0%, 100% { opacity: 1; transform: scale(1); }
  7% { opacity: 0.92; transform: scale(1.02); }
  21% { opacity: 0.82; transform: scale(1.08); }
  34% { opacity: 0.88; transform: scale(1.05); }
  51% { opacity: 0.95; transform: scale(0.98); }
  68% { opacity: 0.85; transform: scale(1.1); }
  82% { opacity: 0.9; transform: scale(1.03); }
`;

// キラキラ（不等間隔のタイミング）
const sparkleAnimation = keyframes`
  0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
  13% { opacity: 0.6; transform: translate(-50%, -50%) scale(0.9); }
  27% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
  41% { opacity: 0.7; transform: translate(-50%, -50%) scale(0.95); }
  58% { opacity: 0.3; transform: translate(-50%, -50%) scale(0.7); }
`;

interface HD2DLoadingSpinnerProps {
  size?: string;
}

/**
 * オクトパストラベラー/ドラクエHD-2D風のローディングスピナー
 * 夜空の月モチーフ × 金色の輝き × 手癖のゆらぎ
 *
 * AI感排除の工夫：
 * - 不等間隔の配置（87°, 183°, 274° など）
 * - ゆらぎのある脈動・回転
 * - 不等間隔keyframes（均一を避ける）
 * - 手癖easing（cubic-bezier(.2,1,.3,1)）
 */
export function HD2DLoadingSpinner({ size = "32px" }: HD2DLoadingSpinnerProps) {
  // AI感排除：不等間隔の角度配置（90度ではなく、87, 183, 274度）
  const sparkleAngles = [0, 87, 183, 274];
  const sparkleDelays = [0, 0.27, 0.51, 0.83]; // 不等間隔遅延

  return (
    <Box
      position="relative"
      width={size}
      height={size}
      display="inline-block"
      role="status"
      aria-label="読み込み中"
    >
      {/* 外側の金色の輪（夜空の月をイメージ） */}
      <Box
        position="absolute"
        inset={0}
        borderRadius="50%"
        border="3px solid transparent"
        borderTopColor="rgba(255, 215, 0, 0.9)"
        borderRightColor="rgba(255, 215, 0, 0.58)" // 微妙な差
        borderBottomColor="rgba(255, 215, 0, 0.27)" // 不均一
        animation={`${rotateAnimation} 1.3s ${handEasing} infinite`} // 手癖easing
        boxShadow="0 0 12px rgba(255, 215, 0, 0.5)"
      />

      {/* 内側の白い輪（逆回転・微妙に速度差） */}
      <Box
        position="absolute"
        inset="4px"
        borderRadius="50%"
        border="2px solid transparent"
        borderTopColor="rgba(255, 255, 255, 0.82)" // 微妙な差
        borderLeftColor="rgba(255, 255, 255, 0.47)"
        animation={`${rotateReverseAnimation} 0.87s ${handEasing} infinite`} // 0.8s → 0.87s（不等間隔）
        boxShadow="0 0 8px rgba(255, 255, 255, 0.4)"
      />

      {/* 中央の脈動する光は削除（シンプルに） */}

      {/* キラキラ演出（不等間隔の配置と遅延） */}
      {sparkleAngles.map((angle, index) => {
        const delay = sparkleDelays[index];
        const radians = (angle * Math.PI) / 180;
        // 距離も微妙にバラつかせる（60% → 58%, 62% など）
        const distance = 60 + (index % 3) * 2 - 2; // 58, 60, 62, 60
        const x = 50 + Math.cos(radians) * distance;
        const y = 50 + Math.sin(radians) * distance;

        // サイズも微妙に差をつける
        const sparkleSize = index % 2 === 0 ? "4px" : "5px";

        return (
          <Box
            key={angle}
            position="absolute"
            top={`${y}%`}
            left={`${x}%`}
            width={sparkleSize}
            height={sparkleSize}
            borderRadius="50%"
            bg="rgba(255, 255, 255, 0.9)"
            boxShadow="0 0 6px rgba(255, 215, 0, 0.8)"
            animation={`${sparkleAnimation} 2.1s ${handEasing} infinite`} // 2s → 2.1s（微妙な差）
            style={{ animationDelay: `${delay}s` }}
          />
        );
      })}
    </Box>
  );
}
