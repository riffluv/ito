# UI設計ガイド（Chakra UI v3 + 2025 CSS）

このプロジェクトのUI設計原則を簡潔にまとめます。目的は「一貫性」「変更容易性」「可読性」。

## トークン設計
- 色・余白・角丸・タイポグラフィは `theme/index.ts` の tokens / semanticTokens に集約。
- 画面側では極力 semanticTokens 名（例: `canvasBg`, `fgDefault`, `accent`）を参照。
- ライト/ダークの分岐は semanticTokens に寄せ、コンポーネント側での条件分岐を最小化。

## コンポーネント設計
- ベース部品は再利用可能なコンポーネントに分離する（例: `GameCard`, `BoardArea`, `Panel`）。
- 見た目ロジック（色・影・角丸・サイズ）は部品側に寄せ、呼び出し側は「状態」を渡す。
- variant/state の組合せが増えてきたら Chakra v3 の recipes/slot recipes 導入を検討。

## スタイル記述方針
- `style={{ ... }}` のインラインCSSは極力回避し、Chakraのpropsで記述（`bg`, `bgGradient`, `rounded`, `shadow`, `border*` 等）。
- 必要最低限の raw CSS は `bg` によるカスタムgradientや、どうしてもpropsで表現しづらい箇所のみに限定。
- アニメーションは `prefers-reduced-motion` を尊重（モーション安全）。

## レイアウト
- ビューポート: `100dvh` を採用し、グローバルスクロールを避け内部スクロールで制御。
- スクロール領域には `overscrollBehavior: contain` と `-webkit-overflow-scrolling: touch` を適用（既存コード参照）。
- 将来対応: コンテナクエリ（`container-type: inline-size`）で密度・列数を親幅基準で最適化。

## ルール表示/演出
- 逐次判定（sequential）と一括判定（sort-submit）を UI と state で明確に分離。
- リビール演出（flip）は `GameCard` の `variant="flip"` + `flipped` で制御し、演出強度を tokens で調整可能とする。

## 命名・構造
- UI部品: `components/ui/*`、ページ専用: `components/site/*`、ゲーム固有: `components/*`（Board/Monitor等）。
- 将来の recipes は `theme/recipes/*` に配置（導入時に `theme/index.ts` から参照）。

## 参考
- Chakra UI v3: https://chakra-ui.com/docs/get-started/installation
- Semantic Tokens: https://chakra-ui.com/docs/styled-system/semantic-tokens
- App Router: https://nextjs.org/docs/app
- prefers-reduced-motion: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
- Container Queries: https://developer.mozilla.org/en-US/docs/Web/CSS/@container

