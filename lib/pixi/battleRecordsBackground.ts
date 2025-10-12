import type * as PIXI from "pixi.js";

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
  const { width, height, dpr = 1 } = options;

  graphics.clear();

  // ========================================
  // Layer 1: 外周の深い影（多層グロー）
  // ========================================
  // 最外周 - ダークブルーのソフトグロー
  graphics.rect(-24, -24, width + 48, height + 48)
    .fill({ color: 0x0a0d1f, alpha: 0.3 });

  // 2層目 - 深い紺のミディアムグロー
  graphics.rect(-16, -16, width + 32, height + 32)
    .fill({ color: 0x0d1128, alpha: 0.5 });

  // 3層目 - 濃い紺のタイトグロー
  graphics.rect(-8, -8, width + 16, height + 16)
    .fill({ color: 0x0f1530, alpha: 0.7 });

  // ========================================
  // Layer 2: メイン背景（リッチブラック）
  // ========================================
  graphics.rect(0, 0, width, height)
    .fill({ color: 0x08090f, alpha: 0.92 });

  // ========================================
  // Layer 3: 太い白枠（3px）- ドラクエの象徴的な枠
  // ========================================
  const borderW = 3;

  // 上辺
  graphics.rect(0, 0, width, borderW)
    .fill({ color: 0xffffff, alpha: 0.92 });

  // 下辺
  graphics.rect(0, height - borderW, width, borderW)
    .fill({ color: 0xffffff, alpha: 0.92 });

  // 左辺
  graphics.rect(0, 0, borderW, height)
    .fill({ color: 0xffffff, alpha: 0.92 });

  // 右辺
  graphics.rect(width - borderW, 0, borderW, height)
    .fill({ color: 0xffffff, alpha: 0.92 });

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
  // Layer 5: 内側の繊細な装飾ライン（二重枠）
  // ========================================
  const innerOffset = 8;
  const lineWidth = 1;

  // 内側白枠（淡い）
  // 上辺
  graphics.rect(innerOffset, innerOffset, width - innerOffset * 2, lineWidth)
    .fill({ color: 0xffffff, alpha: 0.25 });

  // 下辺
  graphics.rect(innerOffset, height - innerOffset - lineWidth, width - innerOffset * 2, lineWidth)
    .fill({ color: 0xffffff, alpha: 0.25 });

  // 左辺
  graphics.rect(innerOffset, innerOffset, lineWidth, height - innerOffset * 2)
    .fill({ color: 0xffffff, alpha: 0.25 });

  // 右辺
  graphics.rect(width - innerOffset - lineWidth, innerOffset, lineWidth, height - innerOffset * 2)
    .fill({ color: 0xffffff, alpha: 0.25 });

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
