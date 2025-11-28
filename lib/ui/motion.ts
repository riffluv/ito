// リビール演出のテンポ調整を集約（すべての値は ms 単位）。

// ========== 加速テンポ方式 ==========
// 最初はゆっくり（数字を認識させる）→ 徐々に加速（テンポ良く盛り上げる）
export const REVEAL_FIRST_DELAY = 450; // 「せーの！」直後のタメ（フラッシュ演出込み）
export const REVEAL_INITIAL_STEP_DELAY = 850; // 1枚目→2枚目の間隔（長め＝認識時間確保）
export const REVEAL_MIN_STEP_DELAY = 580; // 最速時の間隔（これ以下には縮まない）
export const REVEAL_ACCELERATION_FACTOR = 0.88; // 1枚ごとに間隔を縮める係数
export const REVEAL_LINGER = 520; // リビール完了前に一拍置く待ち
export const RESULT_VISIBLE_MS = 4200; // 結果画面を表示し続ける時間
// 参考資料: Desktop 150-200ms / Mobile 250-350ms → 中間値に近いがやや長め 320ms
export const FLIP_DURATION_MS = 320; // 3D フリップ自体の所要時間（少し長めで認識しやすく）
// 最終カード完了後の導入待ち。食い気味でカッコよく登場する 230ms に調整
export const RESULT_INTRO_DELAY = 230;
// 認知余白は 0ms（導入待ちに集約）
export const RESULT_RECOGNITION_DELAY = 0;
export const FINAL_TWO_BONUS_DELAY = 320; // 最後の2枚だけ滞留を加算する時間（長めに）

// ========== フラッシュ演出タイミング ==========
export const REVEAL_DIM_DURATION = 180; // 暗転時間
export const REVEAL_DIM_BRIGHTNESS = 0.6; // 暗転時の明るさ (0-1)
export const REVEAL_FLASH_DELAY = 80; // 暗転後の静止時間
export const REVEAL_FLASH_DURATION = 100; // フラッシュ時間
// フリップ完了から評価処理までの余白を +180ms に調整（視覚完了を確実に待つ）
export const FLIP_EVALUATION_DELAY = Math.round(FLIP_DURATION_MS + 180);

// シーケンシャルモード用（加速テンポの平均値を使用）
export const SEQ_FIRST_CLUE_MS = 260;
export const SEQ_FLIP_INTERVAL_MS = Math.round(
  (REVEAL_INITIAL_STEP_DELAY + REVEAL_MIN_STEP_DELAY) / 2
);

// 共有で使うイージング曲線。
export const CARD_FLIP_EASING = "cubic-bezier(0.23, 1, 0.32, 1)";
export const HOVER_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";
export const BOUNCE_EASING = "cubic-bezier(0.68, -0.55, 0.265, 1.55)";
