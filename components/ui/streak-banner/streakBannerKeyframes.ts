import { keyframes } from "@emotion/react";

// 光の筋アニメーション
export const lightSweep = keyframes`
  0% { transform: translateX(-200%) skewX(-25deg); opacity: 0; }
  10% { opacity: 0.9; }
  100% { transform: translateX(400%) skewX(-25deg); opacity: 0; }
`;

// 数字の輝きパルス
export const numberPulse = keyframes`
  0%, 100% { filter: brightness(1) drop-shadow(0 0 8px currentColor); }
  50% { filter: brightness(1.3) drop-shadow(0 0 18px currentColor); }
`;

