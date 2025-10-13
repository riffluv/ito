import type * as PIXI from "pixi.js";
import { drawPanelBase } from "./panels/drawPanelBase";
import { BattleRecordsAmbient } from "./battleRecordsAmbient";

export interface BattleRecordsBoardOptions {
  /**
   * ボードの幅（px）
   */
  width: number;

  /**
   * ボードの高さ（px）
   */
  height: number;

  /**
   * デバイスピクセル比
   */
  dpr?: number;

  /**
   * 勝利/敗北フラグ（アンビエント効果に影響）
   */
  failed?: boolean;
}

/**
 * Battle Records モーダルの背景パネルを描画
 *
 * ドラクエ+オクトパストラベラー風の重厚感のあるパネル:
 * - 外周の立体的なシャドウ（多層のグロー）
 * - 太い白枠（3px）+ ゴールドアクセント
 * - 内側の繊細な装飾ライン
 * - テクスチャ的なノイズ背景
 * - コーナーの装飾
 */
export function drawBattleRecordsBoard(
  pixi: typeof PIXI,
  graphics: PIXI.Graphics,
  options: BattleRecordsBoardOptions
): void {
  const { width, height } = options;

  graphics.clear();

  const { borderWidth } = drawPanelBase(graphics, {
    width,
    height,
    glow: [
      { padding: 24, color: 0x0a0d1f, alpha: 0.3 },
      { padding: 16, color: 0x0d1128, alpha: 0.5 },
      { padding: 8, color: 0x0f1530, alpha: 0.7 },
    ],
    background: { color: 0x08090f, alpha: 0.92 },
    border: { color: 0xffffff, alpha: 0.92, width: 3 },
    bezel: {
      thickness: 1,
      highlight: { color: 0xffffff, alpha: 0.4 },
      shadow: { color: 0x000000, alpha: 0.5 },
    },
    innerHighlights: [
      {
        orientation: "horizontal",
        position: "start",
        inset: 8,
        thickness: 1,
        color: 0xffffff,
        alpha: 0.25,
      },
      {
        orientation: "horizontal",
        position: "end",
        inset: 8,
        thickness: 1,
        color: 0xffffff,
        alpha: 0.25,
      },
      {
        orientation: "vertical",
        position: "start",
        inset: 8,
        thickness: 1,
        color: 0xffffff,
        alpha: 0.25,
      },
      {
        orientation: "vertical",
        position: "end",
        inset: 8,
        thickness: 1,
        color: 0xffffff,
        alpha: 0.25,
      },
    ],
  });

  const borderW = borderWidth;

  // ========================================
  // Layer 4: ゴールドアクセント（コーナー装飾）
  // ========================================
  const cornerSize = 16;
  const goldColor = 0xffd700;
  const goldAlpha = 0.75;

  // 左上コーナー
  graphics.rect(borderW, borderW, cornerSize, 2)
    .fill({ color: goldColor, alpha: goldAlpha });
  graphics.rect(borderW, borderW, 2, cornerSize)
    .fill({ color: goldColor, alpha: goldAlpha });

  // 右上コーナー
  graphics.rect(width - borderW - cornerSize, borderW, cornerSize, 2)
    .fill({ color: goldColor, alpha: goldAlpha });
  graphics.rect(width - borderW - 2, borderW, 2, cornerSize)
    .fill({ color: goldColor, alpha: goldAlpha });

  // 左下コーナー
  graphics.rect(borderW, height - borderW - 2, cornerSize, 2)
    .fill({ color: goldColor, alpha: goldAlpha });
  graphics.rect(borderW, height - borderW - cornerSize, 2, cornerSize)
    .fill({ color: goldColor, alpha: goldAlpha });

  // 右下コーナー
  graphics.rect(width - borderW - cornerSize, height - borderW - 2, cornerSize, 2)
    .fill({ color: goldColor, alpha: goldAlpha });
  graphics.rect(width - borderW - 2, height - borderW - cornerSize, 2, cornerSize)
    .fill({ color: goldColor, alpha: goldAlpha });

  // ========================================
  // Layer 6: 内側シャドウ（シンプル版）
  // ========================================
  // 上部の影
  graphics.rect(borderW, borderW, width - borderW * 2, 15)
    .fill({ color: 0x000000, alpha: 0.3 });

  // 下部の影
  graphics.rect(borderW, height - borderW - 15, width - borderW * 2, 15)
    .fill({ color: 0x000000, alpha: 0.15 });

  // ========================================
  // Layer 8: 外枠の立体感（ハイライト + シャドウ）
  // ========================================
  // 左上のハイライト（白の光沢）
  graphics.rect(0, 0, width, 1)
    .fill({ color: 0xffffff, alpha: 0.4 });
  graphics.rect(0, 0, 1, height)
    .fill({ color: 0xffffff, alpha: 0.4 });

  // 右下のシャドウ（深い影）
  graphics.rect(0, height - 1, width, 1)
    .fill({ color: 0x000000, alpha: 0.5 });
  graphics.rect(width - 1, 0, 1, height)
    .fill({ color: 0x000000, alpha: 0.5 });
}

/**
 * アンビエント効果を作成
 *
 * 勝利/敗北に応じた大気効果を生成:
 * - 勝利: 金色の微粒子が上昇 + 淡いグロー脈動
 * - 敗北: 青白い微粒子が下降 + 静かな脈動
 *
 * @returns アンビエントコンテナ（アニメーション付き）
 */
export function createBattleRecordsAmbient(
  options: BattleRecordsBoardOptions
): BattleRecordsAmbient {
  return new BattleRecordsAmbient({
    width: options.width,
    height: options.height,
    failed: options.failed,
  });
}

/**
 * ノイズテクスチャを生成（オプション）
 *
 * 縦ノイズやシマーを入れたい場合に使用。
 * 今回は静的背景想定だが、将来的に追加可能。
 */
export function createNoiseTexture(
  pixi: typeof PIXI,
  width: number,
  height: number,
  intensity = 0.12
): PIXI.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Failed to create noise texture context");
  }

  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;

  // ランダムなノイズを生成
  for (let i = 0; i < data.length; i += 4) {
    const noise = Math.random() * 255 * intensity;
    data[i] = noise;     // R
    data[i + 1] = noise; // G
    data[i + 2] = noise; // B
    data[i + 3] = 255;   // A
  }

  ctx.putImageData(imageData, 0, 0);

  return pixi.Texture.from(canvas);
}
