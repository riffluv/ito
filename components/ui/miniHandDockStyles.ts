import { scaleForDpi } from "@/components/ui/scaleForDpi";
import { keyframes } from "@emotion/react";

// ========================================
// 🎬 Ambient Animations - 人の手感（不等間隔・微妙なゆらぎ）
// ========================================
// オレンジ系アンビエント（ゲーム開始ボタン用）
export const orangeGlowStart = keyframes`
  0% {
    box-shadow: 0 0 0 ${scaleForDpi("2px")} rgba(220,95,25,0.8), ${scaleForDpi("5px")} ${scaleForDpi("6px")} 0 rgba(0,0,0,.42), ${scaleForDpi("4px")} ${scaleForDpi("5px")} 0 rgba(0,0,0,.38), inset 0 ${scaleForDpi("2px")} 0 rgba(255,255,255,.22), inset 0 ${scaleForDpi("-2px")} ${scaleForDpi("1px")} rgba(0,0,0,.28), 0 0 ${scaleForDpi("18px")} rgba(255,145,65,0.3);
  }
  32% {
    box-shadow: 0 0 0 ${scaleForDpi("2px")} rgba(230,105,35,0.85), ${scaleForDpi("5px")} ${scaleForDpi("6px")} 0 rgba(0,0,0,.42), ${scaleForDpi("4px")} ${scaleForDpi("5px")} 0 rgba(0,0,0,.38), inset 0 ${scaleForDpi("2px")} 0 rgba(255,255,255,.24), inset 0 ${scaleForDpi("-2px")} ${scaleForDpi("1px")} rgba(0,0,0,.28), 0 0 ${scaleForDpi("22px")} rgba(255,155,75,0.42);
  }
  61% {
    box-shadow: 0 0 0 ${scaleForDpi("2px")} rgba(240,115,45,0.88), ${scaleForDpi("5px")} ${scaleForDpi("6px")} 0 rgba(0,0,0,.42), ${scaleForDpi("4px")} ${scaleForDpi("5px")} 0 rgba(0,0,0,.38), inset 0 ${scaleForDpi("2px")} 0 rgba(255,255,255,.26), inset 0 ${scaleForDpi("-2px")} ${scaleForDpi("1px")} rgba(0,0,0,.28), 0 0 ${scaleForDpi("26px")} rgba(255,165,85,0.52);
  }
  87% {
    box-shadow: 0 0 0 ${scaleForDpi("2px")} rgba(225,100,30,0.82), ${scaleForDpi("5px")} ${scaleForDpi("6px")} 0 rgba(0,0,0,.42), ${scaleForDpi("4px")} ${scaleForDpi("5px")} 0 rgba(0,0,0,.38), inset 0 ${scaleForDpi("2px")} 0 rgba(255,255,255,.23), inset 0 ${scaleForDpi("-2px")} ${scaleForDpi("1px")} rgba(0,0,0,.28), 0 0 ${scaleForDpi("20px")} rgba(255,150,70,0.38);
  }
  100% {
    box-shadow: 0 0 0 ${scaleForDpi("2px")} rgba(220,95,25,0.8), ${scaleForDpi("5px")} ${scaleForDpi("6px")} 0 rgba(0,0,0,.42), ${scaleForDpi("4px")} ${scaleForDpi("5px")} 0 rgba(0,0,0,.38), inset 0 ${scaleForDpi("2px")} 0 rgba(255,255,255,.22), inset 0 ${scaleForDpi("-2px")} ${scaleForDpi("1px")} rgba(0,0,0,.28), 0 0 ${scaleForDpi("18px")} rgba(255,145,65,0.3);
  }
`;

// オレンジ系アンビエント（次のゲーム用 - 少し控えめ）
export const orangeGlowNext = keyframes`
  0% {
    box-shadow: 0 0 0 ${scaleForDpi("2px")} rgba(220,95,25,0.8), ${scaleForDpi("5px")} ${scaleForDpi("6px")} 0 rgba(0,0,0,.42), ${scaleForDpi("4px")} ${scaleForDpi("5px")} 0 rgba(0,0,0,.38), inset 0 ${scaleForDpi("2px")} 0 rgba(255,255,255,.22), inset 0 ${scaleForDpi("-2px")} ${scaleForDpi("1px")} rgba(0,0,0,.28), 0 0 ${scaleForDpi("14px")} rgba(255,145,65,0.25);
  }
  38% {
    box-shadow: 0 0 0 ${scaleForDpi("2px")} rgba(230,105,35,0.84), ${scaleForDpi("5px")} ${scaleForDpi("6px")} 0 rgba(0,0,0,.42), ${scaleForDpi("4px")} ${scaleForDpi("5px")} 0 rgba(0,0,0,.38), inset 0 ${scaleForDpi("2px")} 0 rgba(255,255,255,.23), inset 0 ${scaleForDpi("-2px")} ${scaleForDpi("1px")} rgba(0,0,0,.28), 0 0 ${scaleForDpi("18px")} rgba(255,155,75,0.35);
  }
  69% {
    box-shadow: 0 0 0 ${scaleForDpi("2px")} rgba(235,110,40,0.86), ${scaleForDpi("5px")} ${scaleForDpi("6px")} 0 rgba(0,0,0,.42), ${scaleForDpi("4px")} ${scaleForDpi("5px")} 0 rgba(0,0,0,.38), inset 0 ${scaleForDpi("2px")} 0 rgba(255,255,255,.24), inset 0 ${scaleForDpi("-2px")} ${scaleForDpi("1px")} rgba(0,0,0,.28), 0 0 ${scaleForDpi("20px")} rgba(255,160,80,0.4);
  }
  91% {
    box-shadow: 0 0 0 ${scaleForDpi("2px")} rgba(225,100,30,0.82), ${scaleForDpi("5px")} ${scaleForDpi("6px")} 0 rgba(0,0,0,.42), ${scaleForDpi("4px")} ${scaleForDpi("5px")} 0 rgba(0,0,0,.38), inset 0 ${scaleForDpi("2px")} 0 rgba(255,255,255,.23), inset 0 ${scaleForDpi("-2px")} ${scaleForDpi("1px")} rgba(0,0,0,.28), 0 0 ${scaleForDpi("16px")} rgba(255,150,70,0.3);
  }
  100% {
    box-shadow: 0 0 0 ${scaleForDpi("2px")} rgba(220,95,25,0.8), ${scaleForDpi("5px")} ${scaleForDpi("6px")} 0 rgba(0,0,0,.42), ${scaleForDpi("4px")} ${scaleForDpi("5px")} 0 rgba(0,0,0,.38), inset 0 ${scaleForDpi("2px")} 0 rgba(255,255,255,.22), inset 0 ${scaleForDpi("-2px")} ${scaleForDpi("1px")} rgba(0,0,0,.28), 0 0 ${scaleForDpi("14px")} rgba(255,145,65,0.25);
  }
`;

export const phaseMessagePulse = keyframes`
  0% {
    opacity: 0.6;
    transform: translateY(0);
  }
  50% {
    opacity: 1;
    transform: translateY(${scaleForDpi("-1.5px")});
  }
  100% {
    opacity: 0.6;
    transform: translateY(0);
  }
`;

export const subtleTextPulse = keyframes`
  0% {
    opacity: 0.6;
    transform: translateY(0);
  }
  50% {
    opacity: 1;
    transform: translateY(${scaleForDpi("-1px")});
  }
  100% {
    opacity: 0.6;
    transform: translateY(0);
  }
`;

// ========================================
// 🎨 Design System: Button Styles
// ========================================
/**
 * ドラクエ風フッターボタンの共通スタイル定数
 *
 * 設計方針:
 * - DRY原則に従い、重複を排除
 * - 保守性向上のため一箇所で管理
 * - ドラクエ風UI統一デザイン（角ばった・モノスペース・立体感）
 */
export const FOOTER_BUTTON_BASE_STYLES = {
  // サイズ
  px: scaleForDpi("14px"),
  py: scaleForDpi("10px"),
  w: scaleForDpi("68px"),
  minW: scaleForDpi("68px"),
  h: scaleForDpi("36px"),
  minH: scaleForDpi("36px"),

  // 背景・枠線
  bg: "rgba(28,32,42,0.95)",
  border: "none",
  borderRadius: "0",

  // タイポグラフィ
  fontWeight: "900",
  fontFamily: "'Courier New', monospace",
  fontSize: scaleForDpi("15px"),
  letterSpacing: "0.06em",
  textShadow: `${scaleForDpi("1px")} ${scaleForDpi("1px")} 0 rgba(0,0,0,0.9)`,
  lineHeight: "1",

  // 立体感演出
  boxShadow:
    `${scaleForDpi("3px")} ${scaleForDpi("3px")} 0 rgba(0,0,0,.65), inset ${scaleForDpi("2px")} ${scaleForDpi("2px")} 0 rgba(255,255,255,0.15), inset ${scaleForDpi("-2px")} ${scaleForDpi("-2px")} 0 rgba(0,0,0,0.4), 0 0 0 ${scaleForDpi("2px")} rgba(255,255,255,0.88)`,
  transform: `translate(${scaleForDpi("0.5px")}, ${scaleForDpi("-0.5px")})`,

  // レイアウト
  display: "flex",
  alignItems: "center",
  justifyContent: "center",

  // アニメーション
  transition: "177ms cubic-bezier(.2,1,.3,1)",

  // インタラクション状態
  _hover: {
    bg: "rgba(38,42,52,0.98)",
    transform: `translate(0, ${scaleForDpi("-1px")})`,
    boxShadow:
      `${scaleForDpi("4px")} ${scaleForDpi("4px")} 0 rgba(0,0,0,.7), inset ${scaleForDpi("2px")} ${scaleForDpi("2px")} 0 rgba(255,255,255,0.2), inset ${scaleForDpi("-2px")} ${scaleForDpi("-2px")} 0 rgba(0,0,0,0.5), 0 0 0 ${scaleForDpi("2px")} rgba(255,255,255,0.95)`,
  },
  _active: {
    transform: `translate(${scaleForDpi("1px")}, ${scaleForDpi("1px")})`,
    boxShadow:
      `${scaleForDpi("2px")} ${scaleForDpi("2px")} 0 rgba(0,0,0,.75), inset ${scaleForDpi("2px")} ${scaleForDpi("2px")} 0 rgba(255,255,255,0.1), inset ${scaleForDpi("-2px")} ${scaleForDpi("-2px")} 0 rgba(0,0,0,0.6), 0 0 0 ${scaleForDpi("2px")} rgba(255,255,255,0.82)`,
  },
  _disabled: {
    bg: "rgba(28,32,42,0.5)",
    color: "rgba(255,255,255,0.4)",
    filter: "grayscale(0.8)",
    cursor: "not-allowed",
    boxShadow:
      `${scaleForDpi("2px")} ${scaleForDpi("2px")} 0 rgba(0,0,0,.4), inset ${scaleForDpi("1px")} ${scaleForDpi("1px")} 0 rgba(255,255,255,0.05), inset ${scaleForDpi("-1px")} ${scaleForDpi("-1px")} 0 rgba(0,0,0,0.3), 0 0 0 ${scaleForDpi("2px")} rgba(255,255,255,0.3)`,
  },
} as const;

export const MINI_HAND_DOCK_ICON_BUTTON_BASE_STYLES = {
  bg: "rgba(28,32,42,0.95)",
  color: "rgba(255,255,255,0.92)",
  borderWidth: "0",
  borderRadius: "0",
  fontFamily: "'Courier New', monospace",
  boxShadow: `${scaleForDpi("2px")} ${scaleForDpi("2px")} 0 rgba(0,0,0,.65), 0 0 0 ${scaleForDpi("2px")} rgba(255,255,255,0.88)`,
  _hover: {
    bg: "rgba(38,42,52,0.98)",
    color: "rgba(255,255,255,1)",
    transform: `translate(0, ${scaleForDpi("-1px")})`,
    boxShadow:
      `${scaleForDpi("3px")} ${scaleForDpi("3px")} 0 rgba(0,0,0,.7), 0 0 0 ${scaleForDpi("2px")} rgba(255,255,255,0.95)`,
  },
  _active: {
    transform: `translate(${scaleForDpi("1px")}, ${scaleForDpi("1px")})`,
    boxShadow:
      `${scaleForDpi("1px")} ${scaleForDpi("1px")} 0 rgba(0,0,0,.75), 0 0 0 ${scaleForDpi("2px")} rgba(255,255,255,0.82)`,
  },
} as const;

export const MINI_HAND_DOCK_ICON_BUTTON_DANGER_HOVER_STYLES = {
  bg: "rgba(52,28,28,0.98)",
  color: "rgba(255,220,220,1)",
  transform: `translate(0, ${scaleForDpi("-1px")})`,
  boxShadow:
    `${scaleForDpi("3px")} ${scaleForDpi("3px")} 0 rgba(0,0,0,.7), 0 0 0 ${scaleForDpi("2px")} rgba(255,180,180,0.95)`,
} as const;

export const MINI_HAND_DOCK_ICON_BUTTON_DANGER_ACTIVE_STYLES = {
  transform: `translate(${scaleForDpi("1px")}, ${scaleForDpi("1px")})`,
  boxShadow:
    `${scaleForDpi("1px")} ${scaleForDpi("1px")} 0 rgba(0,0,0,.75), 0 0 0 ${scaleForDpi("2px")} rgba(255,180,180,0.82)`,
} as const;
