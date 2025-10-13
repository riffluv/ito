import type * as PIXI from "pixi.js";
import { drawPanelBase } from "./panels/drawPanelBase";

export interface ChatPanelBackgroundOptions {
  width: number;
  height: number;
  dpr?: number;
}

/**
 * チャットパネルのPixi背景
 *
 * オクトパストラベラー風のHD-2Dパネル:
 * - リッチブラック背景（深み）
 * - 太い白枠（3px）
 * - 淡い外周グロー（控えめ）
 * - 内側の繊細なハイライト
 */
export function drawChatPanelBackground(
  pixi: typeof PIXI,
  graphics: PIXI.Graphics,
  options: ChatPanelBackgroundOptions
): void {
  const { width, height } = options;

  graphics.clear();

  drawPanelBase(graphics, {
    width,
    height,
    glow: [
      { padding: 8, color: 0x08090f, alpha: 0.5 },
    ],
    background: { color: 0x08090f, alpha: 0.95 },
    border: { color: 0xffffff, alpha: 0.9, width: 3 },
    bezel: {
      thickness: 1,
      highlight: { color: 0xffffff, alpha: 0.2 },
      shadow: { color: 0x000000, alpha: 0.3 },
    },
    innerHighlights: [
      {
        orientation: "horizontal",
        position: "start",
        inset: 3,
        thickness: 1,
        color: 0xffffff,
        alpha: 0.12,
      },
      {
        orientation: "vertical",
        position: "start",
        inset: 3,
        thickness: 1,
        color: 0xffffff,
        alpha: 0.12,
      },
    ],
  });
}
