// リビール演出のテンポ調整を集約（すべての値は ms 単位）。
export const REVEAL_FIRST_DELAY = 220; // 「3,2,1」直後の短いタメ
export const REVEAL_STEP_DELAY = 520; // 1枚ごとの間合い（表面の滞留＋短い間）
export const REVEAL_LINGER = 520; // リビール完了前に一拍置く待ち
export const RESULT_VISIBLE_MS = 4200; // 結果画面を表示し続ける時間
// 実アニメは従来どおり 320ms（単体テスト時の体感を維持）
export const FLIP_DURATION_MS = 320; // 3D フリップ自体の所要時間
// 食い気味に演出を入れるため、最後のカード完了後の導入待ちを短め(220ms)に
export const RESULT_INTRO_DELAY = 220;
// プレイヤーが数字を認知する余白を拡張（リクエストに合わせて約260ms）
export const RESULT_RECOGNITION_DELAY = 260;
export const FINAL_TWO_BONUS_DELAY = 260; // 最後の2枚だけ滞留を加算する時間
// フリップ完了から評価処理までの余白を+220msに拡張（視覚完了を確実に待つ）
export const FLIP_EVALUATION_DELAY = Math.round(FLIP_DURATION_MS + 220);

// シーケンシャルモード用（sort-submit のリビール間隔に準拠）。
export const SEQ_FIRST_CLUE_MS = 260;
export const SEQ_FLIP_INTERVAL_MS = REVEAL_STEP_DELAY;

// 共有で使うイージング曲線。
export const CARD_FLIP_EASING = "cubic-bezier(0.23, 1, 0.32, 1)";
export const HOVER_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";
export const BOUNCE_EASING = "cubic-bezier(0.68, -0.55, 0.265, 1.55)";
