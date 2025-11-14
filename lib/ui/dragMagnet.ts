export interface MagnetConfig {
  /**
   * 半径内に入ったときに吸着補正を開始する距離（px）
   * デフォルト: 120px (PC), 150px推奨 (タッチ)
   */
  snapRadius?: number;
  /**
   * ドロップ確定とみなす距離（px）。snapRadius より小さい値を推奨。
   * デフォルト: 24px (PC), 30px推奨 (タッチ)
   */
  snapThreshold?: number;
  /**
   * 補正移動量の最大値（px）。
   */
  maxOffset?: number;
  /**
   * 吸着力の立ち上がりカーブ。数値が大きいほど終盤で一気に引き寄せる。
   */
  pullExponent?: number;
  /**
   * どの程度近づいたらスロット中心へ完全に寄せるか（0〜1）。
   */
  settleProgress?: number;
  /**
   * オーバーシュートを開始する強さ（0〜1）。
   */
  overshootStart?: number;
  /**
   * オーバーシュートの割合（残距離に対する割合）。
   */
  overshootRatio?: number;
  /**
   * オーバーシュートの最大距離（px）。
   */
  maxOvershootPx?: number;
  /**
   * 補正の緩和カーブ。0.0〜1.0 を入力し 0.0〜1.0 を返す関数。
   * デフォルト: easeOutBack風のオーバーシュート付き
   */
  ease?: (t: number) => number;
  /**
   * デバイス種別（タッチ時は閾値を拡大）
   */
  isTouch?: boolean;
  /**
   * 既に適用済みのオフセット（DragOverlay側での補正量）を推定する値。
   * shouldSnap や pullRatio の判定を視覚上の位置に合わせる用途。
   */
  projectedOffset?: {
    dx: number;
    dy: number;
  };
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

/**
 * easeOutBack: 終点を約10%オーバーシュートしてから戻る、
 * 「バネで吸い付く」感覚を演出するイージング関数
 * 参考: Penner's easing functions (overshoot parameter ≈ 1.70158)
 */
const easeOutBack = (t: number, overshoot: number = 1.70158): number => {
  const t1 = t - 1;
  return t1 * t1 * ((overshoot + 1) * t1 + overshoot) + 1;
};

const defaultEase = (t: number) => easeOutBack(t, 1.7);

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

const easeOutWithExponent = (t: number, exponent: number) => 1 - Math.pow(1 - t, exponent);

/**
 * ドラッグ中の要素と候補スロットの距離から吸着補正量を計算する。
 *
 * 資料に基づく推奨パラメータ:
 * - スナップ距離: PC 24px / タッチ 30px
 * - イージング: easeOutBack (10%程度のオーバーシュート)
 * - アニメーション時間: 0.2秒 (CentralCardBoard側で設定)
 */
export function computeMagnetTransform(
  overRect: RectLike | null | undefined,
  activeRect: RectLike | null | undefined,
  config: MagnetConfig = {}
): MagnetResult {
  const isTouch = config.isTouch ?? false;
  const radius = Math.max(config.snapRadius ?? 120, 1);
  const ease = config.ease ?? defaultEase;
  // 資料推奨値: PC 24px, タッチ 30px
  const threshold = config.snapThreshold ?? (isTouch ? 30 : 24);

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
  const projectedOffsetX = config.projectedOffset?.dx ?? 0;
  const projectedOffsetY = config.projectedOffset?.dy ?? 0;
  const visualCenterX = activeCenterX + projectedOffsetX;
  const visualCenterY = activeCenterY + projectedOffsetY;

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

  const normalized = clamp01(1 - distance / radius);
  const strength = ease(normalized);
  const clampedStrength = clamp01(strength);
  const safeDistance = Math.max(distance, 1);

  const overRight = overRect.left + overRect.width;
  const overBottom = overRect.top + overRect.height;
  const visualInsideSlotBounds =
    visualCenterX >= overRect.left &&
    visualCenterX <= overRight &&
    visualCenterY >= overRect.top &&
    visualCenterY <= overBottom;
  const visualDiffX = overCenterX - visualCenterX;
  const visualDiffY = overCenterY - visualCenterY;
  const visualDistance = Math.hypot(visualDiffX, visualDiffY);
  // 視覚的スナップ閾値を引き上げ、より早期に完全吸着を開始
  const visualSnapThreshold = threshold * 0.82;

  const pullExponent = config.pullExponent ?? (isTouch ? 2.2 : 1.8);
  const basePullRatio = easeOutWithExponent(normalized, pullExponent);
  const settleProgress = clamp01(config.settleProgress ?? (isTouch ? 0.88 : 0.8));
  let pullRatio = normalized >= settleProgress ? 1 : clamp01(basePullRatio);
  if (visualInsideSlotBounds || visualDistance <= visualSnapThreshold) {
    pullRatio = 1;
  }

  const overshootStart = clamp01(config.overshootStart ?? (isTouch ? 0.94 : 0.9));
  const overshootRatio = config.overshootRatio ?? (isTouch ? 0.06 : 0.1);
  const overshootRange = Math.max(1 - overshootStart, 0.0001);
  let overshootProgress = 0;
  if (normalized > overshootStart) {
    overshootProgress = (normalized - overshootStart) / overshootRange;
  }
  let overshootMultiplier = clamp01(overshootProgress) * Math.max(overshootRatio, 0);
  if (visualInsideSlotBounds || visualDistance <= visualSnapThreshold) {
    overshootMultiplier = 0;
  }
  const slotSpan = Math.max(overRect?.height ?? 0, overRect?.width ?? 0);
  const maxOvershootPx = Math.max(
    0,
    config.maxOvershootPx ?? (slotSpan > 0 ? Math.min(slotSpan * 0.18, 14) : 10)
  );

  const desiredOffset = Math.min(
    distance * (pullRatio + overshootMultiplier),
    distance + maxOvershootPx
  );

  const maxOffset = config.maxOffset;
  const clampedOffset =
    typeof maxOffset === "number" && Number.isFinite(maxOffset)
      ? Math.min(desiredOffset, Math.max(maxOffset, 0))
      : desiredOffset;
  const offsetFactor = clampedOffset / safeDistance;

  const shouldSnap =
    visualInsideSlotBounds || visualDistance <= threshold || distance <= threshold;

  return {
    dx: diffX * offsetFactor,
    dy: diffY * offsetFactor,
    strength: clampedStrength,
    distance,
    shouldSnap,
  };
}
