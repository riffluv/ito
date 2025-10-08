export interface MagnetConfig {
  /**
   * 半径内に入ったときに吸着補正を開始する距離（px）
   */
  snapRadius?: number;
  /**
   * ドロップ確定とみなす距離（px）。snapRadius より小さい値を推奨。
   */
  snapThreshold?: number;
  /**
   * 補正移動量の最大値（px）。
   */
  maxOffset?: number;
  /**
   * 補正の緩和カーブ。0.0〜1.0 を入力し 0.0〜1.0 を返す関数。
   */
  ease?: (t: number) => number;
}

export interface MagnetResult {
  dx: number;
  dy: number;
  strength: number;
  distance: number;
  shouldSnap: boolean;
}

export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

const defaultEase = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * ドラッグ中の要素と候補スロットの距離から吸着補正量を計算する。
 */
export function computeMagnetTransform(
  overRect: RectLike | null | undefined,
  activeRect: RectLike | null | undefined,
  config: MagnetConfig = {}
): MagnetResult {
  const radius = Math.max(config.snapRadius ?? 120, 1);
  const maxOffset = config.maxOffset ?? 36;
  const ease = config.ease ?? defaultEase;
  const threshold = config.snapThreshold ?? radius * 0.55;

  if (!overRect || !activeRect) {
    return {
      dx: 0,
      dy: 0,
      strength: 0,
      distance: Number.POSITIVE_INFINITY,
      shouldSnap: false,
    };
  }

  const overCenterX = overRect.left + overRect.width / 2;
  const overCenterY = overRect.top + overRect.height / 2;
  const activeCenterX = activeRect.left + activeRect.width / 2;
  const activeCenterY = activeRect.top + activeRect.height / 2;

  const diffX = overCenterX - activeCenterX;
  const diffY = overCenterY - activeCenterY;
  const distance = Math.hypot(diffX, diffY);

  if (!Number.isFinite(distance) || distance >= radius) {
    return {
      dx: 0,
      dy: 0,
      strength: 0,
      distance,
      shouldSnap: false,
    };
  }

  const normalized = Math.min(Math.max(1 - distance / radius, 0), 1);
  const strength = ease(normalized);
  const clampedStrength = Math.min(Math.max(strength, 0), 1);

  return {
    dx: diffX * clampedStrength * (maxOffset / Math.max(distance, 1)),
    dy: diffY * clampedStrength * (maxOffset / Math.max(distance, 1)),
    strength: clampedStrength,
    distance,
    shouldSnap: distance <= threshold,
  };
}

