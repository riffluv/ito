// カードサイズのレスポンシブCSS（重複排除）
export function cardSizeCss() {
  return {
    width: "var(--card-w-base, 100px)",
    height: "var(--card-h-base, 140px)",
    minWidth: "var(--card-w-base, 100px)",
    minHeight: "var(--card-h-base, 140px)",
    "@media (min-width: 768px)": {
      width: "var(--card-w-md, 120px)",
      height: "var(--card-h-md, 168px)",
      minWidth: "var(--card-w-md, 120px)",
      minHeight: "var(--card-h-md, 168px)",
    },
  } as const;
}
