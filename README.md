# Online-ITO (Next.js + Chakra UI + Firebase)

このプロジェクトは、仕様書 `ito-spec.md` に基づくオンライン協力ゲーム「ito」風の最小実装です。ロビー→ルーム→ゲーム（ヒント→並べ替え→確認→答え合わせ）→結果の一連の流れをカバーします。

## セットアップ

1. Firebase プロジェクトを作成し、Authentication で匿名認証を有効化、Firestore を有効化します。
2. 下記の Web アプリ用設定から環境変数を `.env.local` に設定します（`.env.local.example` を参考）。
3. 依存インストールと起動:

```bash
npm install
npm run dev
```

## 主な機能

- 匿名ログイン（初回にプレイヤー名入力を促す）
- ロビーでの部屋一覧表示／部屋作成
- ルーム内の参加者一覧・チャット・オプション編集（ホストのみ）
- ゲーム開始（ホストのみ。プレイヤーへ 1〜100 の一意な数字を配布）
- ヒント入力（ヒント1必須、オプションでヒント2）
- dnd-kit によるドラッグ＆ドロップ並べ替えと保存
- 全員の「確認」完了後に答え合わせ（framer-motion で公開アニメ）
- 成功/失敗の結果表示、もう一度（ホスト）、失敗時の継続（オプション）

## Firestore 構造

- `rooms/{roomId}`: { name, hostId, options, status, createdAt, result }
  - `players/{playerId}`: { name, avatar, number, clue1, clue2, ready, orderIndex }
  - `chat/{messageId}`: { sender, text, createdAt }

仕様書のスキーマをベースに実装しています（`result` は結果表示のために追加）。

## 補足

- 並べ替え保存は誰でも可能。全員が「確認」したら、ホストが「結果を確定」して終了画面に遷移します。
- 失敗後の「継続」は、数字・ヒント・並びを維持したまま、確認状態のみリセットして並べ替えを続行します。
- もう一度：ホストが状態を waiting に戻し、数値/ヒント/確認をリセットします（再度「ゲーム開始」で数字を再配布）。

## 既知の余地

- 参加者数表示（ロビー）は簡略化しています。
- セキュリティルールは含まれません（本番運用時は Firestore ルールの設定が必須）。

## アーキテクチャ（リファクタ後の構成要点）

- UIレイヤ
  - `components/ui/Panel.tsx`: セクション枠の共通コンポーネント（見出し・アクション）
  - 各機能UI: `TopicDisplay`/`CluePanel`/`OrderBoard`/`RevealPanel`/`ChatPanel` は `Panel` を用いて統一スタイル
- テーマ
  - `theme/index.ts`: `semanticTokens`（色トークン）、`layerStyles`（`panel`/`panelSub`）、`textStyles.hint` を定義
- ゲームロジック
  - `lib/game/random.ts`: 決定的な数字配布
  - `lib/game/rules.ts`: 非減少判定・リビール順計算
  - `lib/game/room.ts`: ゲーム状態遷移（開始・確定・結果確定・継続）
- Firestore I/O ラッパ
  - `lib/firebase/players.ts`: 連想ワード更新、順序保存、ready、presence、プレイヤー初期化
  - `lib/firebase/chat.ts`: チャット送信
  - `lib/firebase/rooms.ts`: ルームオプション更新、最終アクティブ更新、ホスト移譲、退出処理

この分離により、UI刷新（レイアウト変更やテーマ拡張）やルール拡張（判定方法の切替）を局所的な変更で実現できます。
