import type * as PIXI from "pixi.js";
import { drawPanelBase } from "./panels/drawPanelBase";

export interface SettingsModalBackgroundOptions {
  /**
   * モーダルの幅（px）
   */
  width: number;

  /**
   * モーダルの高さ（px）
   */
  height: number;

  /**
   * デバイスピクセル比
   */
  dpr?: number;
}

/**
 * Settings Modal の背景パネルを描画
 *
 * ドラクエ風のシンプルなパネル:
 * - リッチブラック背景 (rgba(8,9,15,0.9))
 * - 太い白枠（3px）
 * - 外周の影（シンプル）
 * - 内側の微妙なハイライト
 *
 * ※ BattleRecordsの特別な装飾は使わない
 */
export function drawSettingsModalBackground(
  pixi: typeof PIXI,
  graphics: PIXI.Graphics,
  options: SettingsModalBackgroundOptions
): void {
  const { width, height } = options;

  graphics.clear();

  drawPanelBase(graphics, {
    width,
    height,
    glow: [
      { padding: 16, color: 0x08090f, alpha: 0.4 },
      { padding: 8, color: 0x08090f, alpha: 0.6 },
    ],
    background: { color: 0x08090f, alpha: 0.9 },
    border: { color: 0xffffff, alpha: 0.9, width: 3 },
    bezel: {
      thickness: 1,
      highlight: { color: 0xffffff, alpha: 0.3 },
      shadow: { color: 0x000000, alpha: 0.4 },
    },
    innerHighlights: [
      {
        orientation: "horizontal",
        position: "start",
        inset: 3,
        thickness: 1,
        color: 0xffffff,
        alpha: 0.08,
      },
      {
        orientation: "vertical",
        position: "start",
        inset: 3,
        thickness: 1,
        color: 0xffffff,
        alpha: 0.08,
      },
    ],
  });
}
