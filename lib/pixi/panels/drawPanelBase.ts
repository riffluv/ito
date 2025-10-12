import type * as PIXI from "pixi.js";

export interface PanelGlowLayer {
  /** パネル外側への広がり（px） */
  padding: number;
  color: number;
  alpha: number;
}

export interface PanelBackgroundOptions {
  color: number;
  alpha: number;
}

export interface PanelBorderOptions {
  color: number;
  alpha: number;
  width: number;
}

export interface PanelBezelOptions {
  thickness: number;
  highlight: { color: number; alpha: number };
  shadow: { color: number; alpha: number };
}

export type PanelHighlightOrientation = "horizontal" | "vertical";

export interface PanelInnerHighlight {
  orientation: PanelHighlightOrientation;
  /** 枠線の内側距離（px） */
  inset: number;
  /** true=終端側（下 or 右）、false=開始側（上 or 左） */
  position?: "start" | "end";
  thickness: number;
  color: number;
  alpha: number;
}

export interface PanelBaseOptions {
  width: number;
  height: number;
  glow?: PanelGlowLayer[];
  background?: PanelBackgroundOptions;
  border?: PanelBorderOptions;
  bezel?: PanelBezelOptions;
  innerHighlights?: PanelInnerHighlight[];
}

export interface PanelBaseResult {
  borderWidth: number;
  contentBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

const DEFAULT_BACKGROUND: PanelBackgroundOptions = {
  color: 0x08090f,
  alpha: 0.9,
};

const DEFAULT_BORDER: PanelBorderOptions = {
  color: 0xffffff,
  alpha: 0.9,
  width: 3,
};

/**
 * パネル背景の共通基盤を描画するユーティリティ。
 * グロー → 背景 → 枠線 → ベゼル → インナーハイライトの順で描画する。
 */
export function drawPanelBase(
  graphics: PIXI.Graphics,
  options: PanelBaseOptions
): PanelBaseResult {
  const { width, height } = options;
  const background = options.background ?? DEFAULT_BACKGROUND;
  const border = options.border ?? DEFAULT_BORDER;

  // 外周グロー
  options.glow?.forEach((layer) => {
    const padding = layer.padding ?? 0;
    graphics
      .rect(-padding, -padding, width + padding * 2, height + padding * 2)
      .fill({ color: layer.color, alpha: layer.alpha });
  });

  // メイン背景
  graphics.rect(0, 0, width, height).fill({
    color: background.color,
    alpha: background.alpha,
  });

  // 枠線
  const bw = border.width;
  const borderColor = { color: border.color, alpha: border.alpha };
  graphics.rect(0, 0, width, bw).fill(borderColor);
  graphics.rect(0, height - bw, width, bw).fill(borderColor);
  graphics.rect(0, 0, bw, height).fill(borderColor);
  graphics.rect(width - bw, 0, bw, height).fill(borderColor);

  // ベゼル（ハイライト・シャドウ）
  if (options.bezel) {
    const { thickness, highlight, shadow } = options.bezel;
    graphics
      .rect(0, 0, width, thickness)
      .fill({ color: highlight.color, alpha: highlight.alpha });
    graphics
      .rect(0, 0, thickness, height)
      .fill({ color: highlight.color, alpha: highlight.alpha });
    graphics
      .rect(0, height - thickness, width, thickness)
      .fill({ color: shadow.color, alpha: shadow.alpha });
    graphics
      .rect(width - thickness, 0, thickness, height)
      .fill({ color: shadow.color, alpha: shadow.alpha });
  }

  // インナーハイライト
  options.innerHighlights?.forEach((highlight) => {
    const position = highlight.position ?? "start";
    const { orientation, inset, thickness, color, alpha } = highlight;
    if (orientation === "horizontal") {
      const y =
        position === "start"
          ? inset
          : height - inset - thickness;
      graphics
        .rect(
          inset,
          y,
          width - inset * 2,
          thickness
        )
        .fill({ color, alpha });
    } else {
      const x =
        position === "start"
          ? inset
          : width - inset - thickness;
      graphics
        .rect(
          x,
          inset,
          thickness,
          height - inset * 2
        )
        .fill({ color, alpha });
    }
  });

  const contentBounds = {
    x: bw,
    y: bw,
    width: width - bw * 2,
    height: height - bw * 2,
  };

  return {
    borderWidth: bw,
    contentBounds,
  };
}
