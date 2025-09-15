import { UNIFIED_LAYOUT } from "@/theme/layout";

// カードサイズのレスポンシブCSS（重複排除）
export function cardSizeCss() {
  return {
    // DPI 100%ベース設計（標準）
    width: "100px",
    height: "140px",
    minWidth: "100px",
    minHeight: "140px",
    "@media (min-width: 768px)": {
      width: "120px",
      height: "168px",
      minWidth: "120px",
      minHeight: "168px",
    },
    // DPI 125%：軽微な縮小でバランス維持
    "@media (min-resolution: 1.25dppx), screen and (-webkit-device-pixel-ratio: 1.25)": {
      width: "95px",
      height: "133px",
      minWidth: "95px",
      minHeight: "133px",
    },
    "@media (min-resolution: 1.25dppx) and (min-width: 768px), screen and (-webkit-device-pixel-ratio: 1.25) and (min-width: 768px)":
      {
        width: "114px",
        height: "160px",
        minWidth: "114px",
        minHeight: "160px",
      },
    // DPI 150%：統一定数活用でレイアウト収束
    [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150}`]: {
      width: UNIFIED_LAYOUT.DPI_150.CARD.WIDTH.base,
      height: UNIFIED_LAYOUT.DPI_150.CARD.HEIGHT.base,
      minWidth: UNIFIED_LAYOUT.DPI_150.CARD.WIDTH.base,
      minHeight: UNIFIED_LAYOUT.DPI_150.CARD.HEIGHT.base,
    },
    [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150} and (min-width: 768px)`]: {
      width: UNIFIED_LAYOUT.DPI_150.CARD.WIDTH.md,
      height: UNIFIED_LAYOUT.DPI_150.CARD.HEIGHT.md,
      minWidth: UNIFIED_LAYOUT.DPI_150.CARD.WIDTH.md,
      minHeight: UNIFIED_LAYOUT.DPI_150.CARD.HEIGHT.md,
    },
  } as const;
}

