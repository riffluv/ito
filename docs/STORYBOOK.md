# Storybook セットアップ（デザイン合意・スナップ用）

## インストール

開発環境で以下を追加インストールしてください。

```
npm i -D @storybook/nextjs @storybook/react @storybook/addon-essentials @storybook/addon-interactions @storybook/addon-a11y
```

## 実行

```
npm run storybook
```

## 収録済みストーリー（最小）
- UI/AppButton: レシピ準拠のボタン。visual/palette/size を切替可能。
- UI/Panel: パネルの variant/density/elevated を確認。
- Game/GameCard: variant(flat/flip) × state(default/success/fail) を確認。

## テーマ切替
ツールバーの Theme を Light/Dark で切替できます。`data-theme` 属性が `<html>` に付与され、semantic tokens の `_dark` が適用されます。

## スナップ/ビジュアルテスト（任意）
Chromatic 等のSaaSを使う場合は `.storybook/main.ts` へアドオンを追加して運用してください。

