// リビール演出のテンポ調整を集約（すべての値は ms 単位）。
export const REVEAL_FIRST_DELAY = 220; // 「3,2,1」直後の短いタメ
export const REVEAL_STEP_DELAY = 780; // 1枚ごとの間合い（表面の滞留＋短い間）
export const REVEAL_LINGER = 520; // リビール完了前に一拍置く待ち
export const RESULT_VISIBLE_MS = 4200; // 結果画面を表示し続ける時間
export const FLIP_DURATION_MS = 320; // 3D フリップ自体の所要時間
export const RESULT_INTRO_DELAY = 420; // 最後のカードが落ち着いてから結果演出へ進むための待ち
export const RESULT_RECOGNITION_DELAY = 210; // 最後のフリップ後に数値を認知するための余白
export const FINAL_TWO_BONUS_DELAY = 260; // 最後の2枚だけ滞留を加算する時間
export const FLIP_EVALUATION_DELAY = Math.round(FLIP_DURATION_MS + 120); // 視覚上のフリップ完了と評価処理を同期

// シーケンシャルモード用（sort-submit のリビール間隔に準拠）。
export const SEQ_FIRST_CLUE_MS = 260;
export const SEQ_FLIP_INTERVAL_MS = 780;

// 共有で使うイージング曲線。
export const CARD_FLIP_EASING = "cubic-bezier(0.23, 1, 0.32, 1)";
export const HOVER_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";
export const BOUNCE_EASING = "cubic-bezier(0.68, -0.55, 0.265, 1.55)";
