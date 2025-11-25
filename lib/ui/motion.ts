// リビール演出のテンポ調整を集約（すべての値は ms 単位）。
export const REVEAL_FIRST_DELAY = 220; // 「3,2,1」直後の短いタメ
export const REVEAL_STEP_DELAY = 520; // 1枚ごとの間合い（表面の滞留＋短い間）
export const REVEAL_LINGER = 520; // リビール完了前に一拍置く待ち
export const RESULT_VISIBLE_MS = 4200; // 結果画面を表示し続ける時間
// 参考資料: Desktop 150-200ms / Mobile 250-350ms → 中間値 280ms を採用
export const FLIP_DURATION_MS = 280; // 3D フリップ自体の所要時間
// 最終カード完了後の導入待ち。食い気味でカッコよく登場する 230ms に調整
export const RESULT_INTRO_DELAY = 230;
// 認知余白は 0ms（導入待ちに集約）
export const RESULT_RECOGNITION_DELAY = 0;
export const FINAL_TWO_BONUS_DELAY = 260; // 最後の2枚だけ滞留を加算する時間
// フリップ完了から評価処理までの余白を +180ms に調整（視覚完了を確実に待つ）
export const FLIP_EVALUATION_DELAY = Math.round(FLIP_DURATION_MS + 180);

// シーケンシャルモード用（sort-submit のリビール間隔に準拠）。
export const SEQ_FIRST_CLUE_MS = 260;
export const SEQ_FLIP_INTERVAL_MS = REVEAL_STEP_DELAY;

// 共有で使うイージング曲線。
export const CARD_FLIP_EASING = "cubic-bezier(0.23, 1, 0.32, 1)";
export const HOVER_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";
export const BOUNCE_EASING = "cubic-bezier(0.68, -0.55, 0.265, 1.55)";
