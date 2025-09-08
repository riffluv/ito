/**
 * 🎯 統一Z-Indexシステム
 * 
 * 全コンポーネントでこの値を使用することで、
 * レイヤー競合を防止し、予測可能な重ね順を実現
 */

// 基本レイヤー構成 (下から上へ)
export const Z_INDEX = {
  // 背景・基盤レイヤー
  BACKGROUND: 0,
  BASE: 1,
  CONTENT: 10,

  // UI要素レイヤー
  HEADER: 100,
  SIDEBAR: 200, 
  PANEL: 300,
  CARD: 400,

  // インタラクション要素
  DROPDOWN: 1000,
  TOOLTIP: 2000,
  POPOVER: 3000,

  // オーバーレイ系
  OVERLAY: 5000,
  MODAL: 6000,
  TOAST: 7000,
  
  // システム最上位
  DEBUG: 8000,
  TRANSITION: 9000,
  EMERGENCY: 9999,
} as const;

export type ZIndexLevel = typeof Z_INDEX[keyof typeof Z_INDEX];

/**
 * 🎯 レイヤー使用ガイドライン
 * 
 * BACKGROUND: 固定背景画像・パターン
 * BASE: 通常のコンテンツ基盤
 * CONTENT: テキスト・画像などの主要コンテンツ
 * 
 * HEADER: ヘッダーバー・ナビゲーション
 * SIDEBAR: サイドバー・メニューパネル
 * PANEL: ゲームパネル・情報表示エリア
 * CARD: カード・ボタンなどのインタラクティブ要素
 * 
 * DROPDOWN: ドロップダウンメニュー
 * TOOLTIP: ツールチップ・ヘルプ表示
 * POPOVER: ポップオーバー・情報パネル
 * 
 * OVERLAY: 背景オーバーレイ・マスク
 * MODAL: モーダルダイアログ・設定画面
 * TOAST: 通知・アラート表示
 * 
 * DEBUG: デバッグ表示・開発ツール
 * TRANSITION: ページ遷移エフェクト
 * EMERGENCY: 緊急時・重要な警告のみ使用
 */