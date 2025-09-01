# 次アクションチェックリスト (Design Refresh 基盤完成後)

現在: フェーズ0〜2 の基盤整備サンプル完了。ライトモード専用で安定。

## すぐに出来る確認

- [ ] `npm run dev` 起動後 `DesignShowcase` を一時ページ (例: `/design/preview` にインポート) してレシピ出力視覚確認
- [ ] トースト表示 (任意操作) で `getBorderWidth` エラーが消えている
- [ ] grep で `getBorderWidth(` が UI から参照されていない

## Phase 1 残タスク (raw 値削減)

- [ ] `grep -R "#[0-9A-Fa-f]" components app` で新規/残存直書きリストアップ
- [ ] 影の生値 (`0 4px 10px`) を `tokens.shadows.*` or `semanticShadows.*` に移行
- [ ] gradient 直書きを tokens 参照に置換

## Panel slot recipe 化 (推奨次作業)

1. `theme/index.ts` の既存 `slotRecipes.panel` を分離するなら `theme/recipes/panel.slot.ts` に移す
2. `components/ui/Panel.tsx` 作成: `const panel = useSlotRecipe({ key: 'panel' }); const styles = panel({ variant, density, elevated });`
3. 呼び出し側から散在する Panel 風コンテナを順次置換

## Toast バリアント拡張

- [ ] semantic colors: `toast.info.bg`, `toast.success.bg`, `toast.error.bg` を `semanticColors` に追加
- [ ] Toaster 内で `toast.type` (アプリロジックに追記) により背景/アイコン色切替

## Strict Tokens 導入 (後回し可)

```bash
# 型生成 (types/ ディレクトリはバージョン管理推奨)
npx @chakra-ui/cli typegen theme/index.ts --outdir types
```

- VSCode で TS Server restart
- `strictTokens: true` によるエラーが出た箇所を tokens 参照に修正

## 自動チェック (CI 推奨)

- lint スクリプトに `grep -R "#[0-9A-Fa-f]" src` を追加し exit code 制御
- `npx @chakra-ui/cli typegen ... && git diff --exit-code types` を CI で実行

## ダークモード再導入タイミング (任意)

1. semanticColors に `_dark` 分岐を追加 (ライト→ダーク変換表を作る)
2. `<html data-theme="light">` の固定を外し `colorModeContext` を導入
3. 減光/コントラスト調整: `accentSubtle` など過度な明度差を再計算

## 将来拡張メモ

- GameCard の flip transition を `durations.*` `easings.*` トークンで制御
- Seasonal preset: `season-winter` など追加→ `ThemePresetContext` で登録→ `/design/preview` で切替
- 視覚回帰自動テスト: Storybook + Playwright screenshot / Chromatic
