# UI監査レポート（初期版）

対象リポジトリ: online-ito  
作成日: 2025-08-26

## 目的
- Chakra UI v3 と Next.js(App Router) を前提に、UI設計の一貫性・可用性・アクセシビリティ・パフォーマンスの観点で初期監査を実施。段階的移行の原則に従い、低リスクから改善を進める。

## 所見サマリ（抜粋）
- ボタンの実装が混在（`AppButton` と `Button` 併用）。→ 一部を `AppButton` 化して統一を開始。
- 色指定の直接参照（`gray.*`）が点在。→ semantic tokens（`fgMuted`/`borderDefault` 等）へ順次置換。
- Provider 直下の `_dark` 二重指定。→ semantic tokensに集約（`app/providers.tsx` 修正済）。
- Tooltip は v3 準拠のラッパーが用意済（`components/ui/Tooltip.tsx`）。→ 今後はこれを標準化。
- List は v3 API (`List.Root`) に移行済み箇所あり。
- 既知エラー: `setState in render` 警告、`cvaA.merge is not a function` 例外。→ 依存の不整合/Factoryの使い方要調査（再現観測中）。

## 変更概要（低リスク先行）
- `components/CluePanel.tsx`
  - `Button`→`AppButton`、`gray.*`→semantic tokens へ一部置換。
- `app/rooms/[roomId]/error.tsx`
  - `Button`→`AppButton`、`gray.*`→semantic tokens。
- `app/rooms/[roomId]/page.tsx`
  - ClueInputMini の送信を `AppButton` 化。
  - ホストの「せーので判定」ボタンを `AppButton` 化。
  - お題管理パネルの `borderColor`/`Text` 色を semantic tokens に置換。
- `app/providers.tsx`
  - `_dark` の重複指定を除去し、semantic tokens に一元化。

## 未対応（次段）
- `size="xs"` のボタン群：`AppButton` は `xs` 未定義のため、影響が大きくない箇所から順次対応。
- 既知エラー是正：依存バージョンの固定/更新、`useRecipe`/`useSlotRecipe` の適用方法精査。
- 画面ごとのアクセシビリティ点検（フォーカスリング/ライブリージョン/スキップリンクの徹底）。

## 優先度（Impact×Effort）
- High×Easy: `Button` の段階的排除と `AppButton` 置換の継続
- High×Medium: 既知エラーの恒久対策（依存の整合・実装パターンの統一）
- Medium×Easy: semantic tokensへの置換の徹底
- Medium×Medium: `Tooltip` ラッパーの全域適用
- Medium×Medium: 手元/場のDnDアクセシビリティ補助（説明/ガイド）

## テスト観点
- ダーク/ライトでの可読性（semantic tokens適用箇所）
- 主要フローの回帰（連想ワード送信・一括判定の実行）
- モバイル幅でのボタンラップ/溢れ処理

---

このレポートは初期版です。以降、実装進捗に合わせて更新します。
