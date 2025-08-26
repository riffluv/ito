# デザイン比較ワークフロー（参照HTMLとの乖離ゼロ運用）

## 目的
HTMLで用意した参照デザイン（Reference）と、Chakra実装（App）の**視覚差異を限りなくゼロ**に保つための最小セット。

## 置き場所
- 参照HTML: `public/design/reference/<name>.html`
- 一覧: `public/design/reference/index.json`

## 閲覧
- トークン一覧: `/design/tokens`
- 比較ページ: `/design/compare/<name>`
  - 左: Reference(HTML) — 同一ドキュメント内に埋め込み（semantic tokens継承）
  - 右: App(Chakra) — 対応実装を配置（段階的に移植）
  - 表示切替: Split / Reference / App

## ダーク/ライト切替について
- 本実装は `next-themes` の `class` モード（`html`に `dark|light`）を使用。
- 比較ページは**同一DOM**内に参照HTMLを描画するため、Chakraの semantic tokens と連動して**自動で配色が切り替わります**。
- 参照HTML側では独自の色指定を避け、CSS変数（例: `var(--colors-panelBg)`）のみを使用してください。

## 参照HTMLの書き方（最小ルール）
- 使ってよいのは CSS変数 とボックスモデルのみ（例: padding/border/radius）
- 例
  ```html
  <div style="background: var(--colors-panelBg); color: var(--colors-fgDefault); border: 1px solid var(--colors-borderDefault); border-radius: 12px; padding: 16px;">
    ...
  </div>
  ```

## 次の発展（任意）
- 視覚回帰（CI）: Playwright/Chromatic 等で `/design/compare/<name>` のスクショ差分を自動検査
- クラス統一: ChakraのRecipe/SlotRecipeに付与した `className` とHTML側のクラス名を合わせ、二重管理を回避
- Lint: 直値カラーやpx直書きを禁止（stylelint）

---
このガイドに従うことで、参照HTMLと実装のズレを最小化できます。
