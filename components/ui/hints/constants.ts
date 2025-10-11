/**
 * 🎮 ヒントコンポーネント用定数
 *
 * SpaceKeyHint と SubmitEHint の配置・スタイル定数を一元管理
 * DRY原則に従い、保守性を向上させる
 */

/**
 * ヒント配置定数
 *
 * 設計方針:
 * - 中央下部のフッターエリア上に配置
 * - SPACEは左下、Eは右上で対角線配置
 * - レスポンシブ対応（base / md）
 */
export const HINT_POSITIONS = {
  /** Spaceキーヒント（左下） */
  SPACE: {
    bottom: { base: "calc(20px + 60px + 10px)", md: "calc(24px + 62px + 15px)" },
    left: { base: "50%", md: "calc(50% - 80px)" },
    transform: "translateX(-50%)",
  },
  /** Eキー/ドラッグヒント（右上） */
  SUBMIT_E: {
    bottom: { base: "calc(20px + 60px + 80px)", md: "calc(24px + 62px + 100px)" },
    left: { base: "calc(50% + 20px)", md: "calc(50% + 30px)" },
  },
} as const;

/**
 * キーボードキー定数
 *
 * マジックストリングを排除し、タイポを防止
 */
export const KEYBOARD_KEYS = {
  SPACE: " ",
  E: "e",
  ENTER: "Enter",
  ESCAPE: "Escape",
  TAB: "Tab",
} as const;

/**
 * ヒント共通スタイル定数
 */
export const HINT_COMMON_STYLES = {
  /** z-index（フッターより上） */
  zIndex: 45,
  /** pointer-events（クリックを無効化） */
  pointerEvents: "none" as const,
  /** 初期opacity */
  initialOpacity: 0,
} as const;

/**
 * パーティクル設定
 */
export const PARTICLE_CONFIG = {
  /** パーティクル数 */
  count: 8,
  /** パーティクルサイズ */
  size: "6px",
  /** 拡散距離 */
  spreadDistance: 40,
} as const;

/**
 * アニメーション設定
 */
export const HINT_ANIMATION_CONFIG = {
  /** アニメーション開始遅延 */
  startDelay: 300,
  /** アニメーション完了後の待機時間 */
  endDelay: 100,
  /** ヒント表示時間 */
  displayDuration: 2500,
} as const;
