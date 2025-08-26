# 推奨コマンド一覧

## 開発用コマンド
- `npm run dev` - 開発サーバーを起動
- `npm run build` - プロダクションビルドを作成
- `npm start` - プロダクションサーバーを起動
- `npm run typecheck` - TypeScript型チェック
- `npm test` - Jest テスト実行

## CSS・スタイル関連
- `npm run chakra:typegen` - Chakra UIの型定義生成
- `npm run lint:css` - CSS/SCSSのlint実行

## システムコマンド（Windows）
- `ls` - ディレクトリ内容表示（エイリアス）
- `cd` - ディレクトリ移動
- `grep` - テキスト検索（ripgrep推奨）
- `find` - ファイル検索
- `git` - バージョン管理

## タスク完了時の推奨手順
1. `npm run typecheck` - 型エラーチェック
2. `npm run lint:css` - CSS品質チェック
3. `npm test` - テスト実行
4. 必要に応じて `npm run build` でビルド確認

## Firebase関連
- Firebase Emulator Suite使用可能
- `firebase.json`で設定済み
- Firestoreルール・インデックス定義済み