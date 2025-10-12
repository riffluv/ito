import type * as PIXI from "pixi.js";

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
  const { width, height, dpr = 1 } = options;

  graphics.clear();

  // ========================================
  // Layer 1: 外周の影（シンプルグロー）
  // ========================================
  // 最外周 - ダークグレーのソフトグロー
  graphics.rect(-16, -16, width + 32, height + 32)
    .fill({ color: 0x08090f, alpha: 0.4 });

  // 2層目 - ミディアムグロー
  graphics.rect(-8, -8, width + 16, height + 16)
    .fill({ color: 0x08090f, alpha: 0.6 });

  // ========================================
  // Layer 2: メイン背景（リッチブラック）
  // ========================================
  graphics.rect(0, 0, width, height)
    .fill({ color: 0x08090f, alpha: 0.9 });

  // ========================================
  // Layer 3: 太い白枠（3px）- ドラクエの象徴的な枠
  // ========================================
  const borderW = 3;

  // 上辺
  graphics.rect(0, 0, width, borderW)
    .fill({ color: 0xffffff, alpha: 0.9 });

  // 下辺
  graphics.rect(0, height - borderW, width, borderW)
    .fill({ color: 0xffffff, alpha: 0.9 });

  // 左辺
  graphics.rect(0, 0, borderW, height)
    .fill({ color: 0xffffff, alpha: 0.9 });

  // 右辺
  graphics.rect(width - borderW, 0, borderW, height)
    .fill({ color: 0xffffff, alpha: 0.9 });

  // ========================================
  // Layer 4: 内側の微妙なハイライト（控えめ）
  // ========================================
  // 上部の微妙なハイライト
  graphics.rect(borderW, borderW, width - borderW * 2, 1)
    .fill({ color: 0xffffff, alpha: 0.08 });

  // 左側の微妙なハイライト
  graphics.rect(borderW, borderW, 1, height - borderW * 2)
    .fill({ color: 0xffffff, alpha: 0.08 });

  // ========================================
  // Layer 5: 外枠の立体感（ハイライト + シャドウ）
  // ========================================
  // 左上のハイライト（白の光沢）
  graphics.rect(0, 0, width, 1)
    .fill({ color: 0xffffff, alpha: 0.3 });
  graphics.rect(0, 0, 1, height)
    .fill({ color: 0xffffff, alpha: 0.3 });

  // 右下のシャドウ（深い影）
  graphics.rect(0, height - 1, width, 1)
    .fill({ color: 0x000000, alpha: 0.4 });
  graphics.rect(width - 1, 0, 1, height)
    .fill({ color: 0x000000, alpha: 0.4 });
}
