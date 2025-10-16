export const DOCK_BOTTOM_MOBILE = "120px";
export const DOCK_BOTTOM_DESKTOP = "144px";

// 16:9 安全領域対応（据え置きゲーム機風UI）
// 画面端からの余白を確保し、テレビ表示でも見切れないようにする
export const SAFE_AREA_INSET = {
  MOBILE: "12px",  // モバイル：最小限の余白
  DESKTOP: "32px", // デスクトップ：16:9 HDテレビの安全領域を考慮
} as const;

export const CHAT_FAB_OFFSET_MOBILE = "148px";
export const CHAT_FAB_OFFSET_DESKTOP = "172px";
export const CHAT_PANEL_BOTTOM_MOBILE = "212px";
export const CHAT_PANEL_BOTTOM_DESKTOP = "232px";

