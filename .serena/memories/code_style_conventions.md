# コードスタイル・規約

## TypeScript規約
- **命名規則**: camelCase（関数・変数）、PascalCase（コンポーネント・型）
- **型定義**: 厳格なTypeScript設定、`types/`ディレクトリで管理
- **インポート順序**: 外部ライブラリ → 内部モジュール → 相対パス

## React/Next.js規約
- **コンポーネント**: 関数型コンポーネント優先
- **ディレクトリ**: App Routerパターン使用
- **状態管理**: Context API使用
- **ファイル命名**: PascalCase（`.tsx`）、kebab-case（`.ts`ユーティリティ）

## Chakra UI規約
- **テーマ**: `theme/index.ts`でカスタムテーマ定義
- **スタイリング**: テーマトークン優先、魔法数値禁止
- **レスポンシブ**: Chakraのブレイクポイントシステム使用
- **コンポーネント**: Chakra UIコンポーネントベース構築

## CSS/スタイル規約
- **Stylelint**: `stylelint-config-standard`使用
- **並び順**: `stylelint-config-recess-order`で統一
- **単位**: remまたはChakraトークン優先
- **レイアウト**: CSS Grid・Flexboxベース

## プロジェクト固有規約
- **フルスクリーン**: ビューポートサイズ固定、スクロール禁止
- **グリッドレイアウト**: Header/Left Panel/Center/Right Panel/Bottom構造
- **アニメーション**: motion-safe対応
- **アクセシビリティ**: ARIA属性・セマンティックHTML