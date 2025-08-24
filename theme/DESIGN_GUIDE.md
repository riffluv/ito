# UI設計ガイド（Chakra UI v3 + 2025 CSS）

このプロジェクトのUI設計原則を簡潔にまとめます。目的は「一貫性」「変更容易性」「可読性」。

## トークン設計

- 色・余白・角丸・タイポグラフィは `theme/index.ts` の tokens / semanticTokens に集約。
- 画面側では極力 semanticTokens 名（例: `canvasBg`, `fgDefault`, `accent`）を参照。
- ライト/ダークの分岐は semanticTokens に寄せ、コンポーネント側での条件分岐を最小化。
- v3 追加方針: Chakra v3 の semantic color palette (`<color>.solid|subtle|muted|emphasized|contrast|fg|focusRing`) と `colorPalette` プロップを活用し、任意のサブツリーで動的テーマ差し替え可能にする。
- 直値使用が残る gradient / 特殊影 / RGBA オーバーレイは `tokens` または `semanticTokens` に吸い上げ、`gradient.*`, `shadow.accentGlow.*` など名前空間で整理。
- strictTokens を有効化し未定義トークン利用を型レベルで防止（段階的導入）。

### 型生成 (typegen)

`@chakra-ui/cli` の `chakra typegen theme/index.ts --outdir types` を実行し以下を自動生成:

- token typings (オートコンプリート)
- recipe / slot recipe variants 型
  strictTokens=true によるトークン名の静的検証
  変更時は再実行 + VSCode "Restart TS Server" 必須。

## コンポーネント設計

- ベース部品は再利用可能なコンポーネントに分離する（例: `GameCard`, `BoardArea`, `Panel`）。
- 見た目ロジック（色・影・角丸・サイズ）は部品側に寄せ、呼び出し側は「状態」を渡す。
- variant/state の組合せが増えてきたら Chakra v3 の recipes/slot recipes 導入を検討。
- 単一要素 = `recipes` (button, card)。複合要素 (Panel + Header + Body など) = `slotRecipes`。`theme/index.ts` の `theme.recipes` / `theme.slotRecipes` に集約し、`system.recipe("button")` / `system.slotRecipe("panel")` の呼び出し経路を確立。
- GameCard の flip/flat 分岐は `slot recipe` 化予定: `slots: ["container","front","back","frame"]` + `variants: { state, variant }`。
  → 実装済 (`slotRecipes.gameCard`)。利用側は `const recipe = useSlotRecipe({ key: 'gameCard' }); const styles = recipe({ state, variant });`。
  flip アニメーションは transform rotateY による 3D フリップ。`prefers-reduced-motion` で将来 transition を無効化予定（TODO: 条件適用）。
- Panel, ChatMessage など繰り返し現れるパターンも slot 化し、影・角丸・余白を集中定義。

## スタイル記述方針

- `style={{ ... }}` のインラインCSSは極力回避し、Chakraのpropsで記述（`bg`, `bgGradient`, `rounded`, `shadow`, `border*` 等）。
- 必要最低限の raw CSS は `bg` によるカスタムgradientや、どうしてもpropsで表現しづらい箇所のみに限定。
- アニメーションは `prefers-reduced-motion` を尊重（モーション安全）。
- motion layer 設計: `@layer base, tokens, recipes, utilities, overrides` の優先順。`@keyframes` は `animations` トークンに定義し、利用側は `animation="fadeIn 0.3s var(--ease-standard)"` のように統一。
- `prefers-reduced-motion: reduce` 時は `animation: none` / `transition-duration: 0ms` を opt-in で落とす semantic token (`motion.duration.fast` など) を短縮値にスイッチ。
- `:focus-visible` スタイルは semantic token `focusRing` を使用。
- 条件: `conditions.reducedMotion` を追加済（将来的に `_reducedMotion` 補助 API があれば置換）。現状は flip inner の transition を明示的に上書きする設計余地を保持。

## レイアウト

- ビューポート: `100dvh` を採用し、グローバルスクロールを避け内部スクロールで制御。
- スクロール領域には `overscrollBehavior: contain` と `-webkit-overflow-scrolling: touch` を適用（既存コード参照）。
- 将来対応: コンテナクエリ（`container-type: inline-size`）で密度・列数を親幅基準で最適化。
- コンテナクエリ運用:
  1.  レイアウト親に `data-cq` クラス (または `cq` 値) と `container-type: inline-size;` を付与。
  2.  `defineConfig` の `conditions` に `cqSm: '@container (min-width: 32rem)'`, `cqMd: '@container (min-width: 48rem)'` 等を追加。
  3.  利用側は `<Stack _cqMd={{ gap: 6 }} gap={4}>` のように幅に応じ差分適用。
  4.  スクロール内カードグリッドはコンテナ基準 → メディアクエリより細かい最適化。

  カテゴリ:
  - ビューポート依存 (ヒーローセクションなど) は従来ブレークポイント。
  - 内部リスト/カードレイアウトはコンテナクエリ優先。

## ルール表示/演出

- 逐次判定（sequential）と一括判定（sort-submit）を UI と state で明確に分離。
- リビール演出（flip）は `GameCard` の `variant="flip"` + `flipped` で制御し、演出強度を tokens で調整可能とする。
- アニメ/演出強度トークン例（追加予定）:
  - `easings.standard = cubic-bezier(.4,0,.2,1)`
  - `durations.fast = 120ms`, `durations.normal = 200ms`, `durations.slow = 320ms`
  - `shadows.glow.success`, `shadows.glow.fail` で現在の inline ringShadow を置換。

## 命名・構造

- UI部品: `components/ui/*`、ページ専用: `components/site/*`、ゲーム固有: `components/*`（Board/Monitor等）。
- 将来の recipes は `theme/recipes/*` に配置（導入時に `theme/index.ts` から参照）。
- トークン命名規則:
  - `colors`: ベースパレット (`brand`, `orange`, etc.) は 50-900 / semantic は用途語 (`canvasBg`, `fgMuted`, `accentSubtle`)
  - `shadow`: 階層は `sm|md|lg|xl|inset|glow.*`
  - `gradient`: 用途別 (`accent.soft`, `danger.intense`)
  - `motion`: `duration.fast|normal|slow`, `easing.standard|emphasized|decelerate`
  - `radii`: 4/6/8/12/16 + `full` 固定、拡張は `2xl` 以上を追加検討

  Commit prefix 指針:
  - `style:` トークン/レシピ微修正
  - `feat(theme):` 新トークン/recipe追加
  - `refactor(ui):` inline style の recipe 置換
  - `docs(design):` ガイド更新

## 参考

- Chakra UI v3: https://chakra-ui.com/docs/get-started/installation
- Semantic Tokens: https://chakra-ui.com/docs/styled-system/semantic-tokens
- App Router: https://nextjs.org/docs/app
- prefers-reduced-motion: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
- Container Queries: https://developer.mozilla.org/en-US/docs/Web/CSS/@container
- CSS Nesting: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_nesting
- :has() セレクタ: https://developer.mozilla.org/en-US/docs/Web/CSS/:has
- Chakra Theming Overview: https://www.chakra-ui.com/docs/theming/overview
- Slot Recipes: https://chakra-ui.com/docs/theming/slot-recipes
- CLI: https://chakra-ui.com/docs/get-started/cli
