// Border width / radius / shadow の基礎トークン (ライトモード専用現段階)
// Chakra v3 tokens に統合されつつも、エンジン外ロジックが参照する最低限のエクスポートのみ提供。

export const borderWidths = {
  none: { value: "0px" },
  thin: { value: "1px" },
  medium: { value: "2px" },
  thick: { value: "3px" },
};

export const radii = {
  xs: { value: "4px" },
  sm: { value: "6px" },
  md: { value: "8px" },
  lg: { value: "12px" },
  xl: { value: "16px" },
  full: { value: "9999px" },
};

// 他 foundations (spacing, typography) は既存 index.ts 内 tokens を段階的に移行予定。

export type BorderWidthToken = keyof typeof borderWidths;
