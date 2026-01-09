import { scaleForDpi } from "@/components/ui/scaleForDpi";

// HD-2D風：部屋名と統一感のある背景
export const CARD_BACKGROUND = "rgba(12,14,20,0.35)";
export const CARD_HOVER_BACKGROUND = "rgba(18,24,34,0.45)";
export const CARD_BOX_SHADOW = `0 ${scaleForDpi("1px")} ${scaleForDpi("4px")} rgba(0,0,0,0.12)`;
export const CARD_HOVER_BOX_SHADOW = `0 ${scaleForDpi("2px")} ${scaleForDpi("6px")} rgba(0,0,0,0.18)`;
export const CARD_FLASH_SHADOW =
  `0 ${scaleForDpi("2px")} ${scaleForDpi("8px")} rgba(255,255,255,0.3), 0 ${scaleForDpi("4px")} ${scaleForDpi("16px")} rgba(255,255,255,0.2), inset 0 ${scaleForDpi("1px")} 0 rgba(255,255,255,0.5)`;
export const CLUE_FLASH_BRIGHTNESS = 1.28;
export const CARD_HEIGHT = scaleForDpi("52px");
export const CARD_AVATAR_SIZE = scaleForDpi("44px");
export const CARD_RADIUS = scaleForDpi("3px");
export const CARD_HOVER_LIFT = scaleForDpi("-1.5px");
export const CARD_PASSIVE_LIFT = scaleForDpi("-0.5px");

export const actionableHoverStyle = {
  bg: CARD_HOVER_BACKGROUND,
  transform: `translateY(${CARD_HOVER_LIFT})`,
  boxShadow: CARD_HOVER_BOX_SHADOW,
} as const;

export const passiveHoverStyle = {
  bg: CARD_HOVER_BACKGROUND,
  transform: `translateY(${CARD_PASSIVE_LIFT})`,
  boxShadow: `0 ${scaleForDpi("4px")} ${scaleForDpi("10px")} rgba(0,0,0,0.32)`,
} as const;

