# アプリのゲームフロー（2025-08-31 時点）

本ドキュメントは ITO の一般的なルール説明ではなく、現在の本アプリが採用する「画面・状態・操作・遷移」をまとめた実装準拠のフローです。モック（artifact-style-mock.html）と実装（components/*, lib/*）の間をつなぐ運用仕様として参照してください。

## 概要
- フェーズは4段階: waiting → clue → reveal（sort-submit時のみ）→ finished
- ゲームモードは2種:
  - 順次（sequential）: 全員の連想ワードが確定（ready）になってから、各自が順に「出す」。出す都度に昇順チェックが進む。
  - 一括（sort-submit）: 各自が「提出」で上にカードを置き、全員揃ったらホストが「確定！」で一括判定 → reveal 演出 → finished。
- 画面の主要要素:
  - 上部: カードボードエリア（提出/公開の場）
  - 下部: 待機エリア（未提出者が並ぶ。確定済みなら連想ワードが見える）
  - 下部フッター（同一列）: 「数字チップ」「入力」「確定」「出す」「ホスト操作（開始/シャッフル/配布/判定/もう一度）」「モード切替」

## 役割
- ホスト: ラウンド開始、（一括時）確定、終了後の再開を操作
- プレイヤー: 数字の割当を受け、連想ワードを「確定」し、ルールに従って「出す/提出」

## 状態と遷移
- waiting
  - 下部に全員の未提出カードを表示（ワード未確定=💭、確定後=ワード表示）。
  - ホスト「ゲーム開始」→ clue へ。
- clue
  - 順次: 全員が「確定（ready）」になったら「出す/ドラッグ」が解禁。出す都度に昇順チェックが進む。条件成立で finished へ。
  - 一括: 各自が「提出」で上へ。未提出=下に残る。全員提出＝未提出0 → 下部に「確定」ドック表示 → クリックで submitSortedOrder → reveal へ（演出後 finished）。
- reveal（sort-submit時のみ）
  - めくりアニメ: 1枚目0.6s、以降1.5s間隔、最後に1.2sの静止。
  - 正常経路で finalizeReveal → finished。取りこぼし対策のフェイルセーフあり（理論時間超過で finalize）。
- finished
  - 1.2s後に結果演出（約4s表示。クリックでも閉じる）。
  - 「もう一度」操作で waiting に戻し、order/deal/result などをクリア。

## 主要UIとロジック
- WaitingArea（下部）
  - 「未提出＝上にまだ出していない人（orderList/proposalに含まれない）」を表示。
  - clue1（連想ワード）が確定していればワードを表示。未確定は💭。
- MiniHandDock（下部・同一列）
  - 確定: 入力ワードを保存し ready=true。下部カードにワードが現れる。Enterキーは確定に割当。
  - 出す:
    - 順次: 全員ready（cluesReady=true）で解禁。クリックまたはドラッグで commitPlayFromClue。
    - 一括: いつでも addCardToProposal（上に置く）。
- ConfirmDock（下部）
  - 条件: 一括モード・clue中・未提出0・ホスト。
  - 動作: submitSortedOrder → reveal へ（めくり → 余韻 → finished）。
- CentralCardBoard（上部）
  - 順次: orderListに並ぶ。空スロットは仮の枠。出す都度に昇順チェック。
  - 一括: proposalの並びをD&Dで調整。全員揃ったら下部に確定ドックを表示。

## 演出とタイミング（lib/ui/motion.ts）
- REVEAL_FIRST_DELAY: 600ms（1枚目）
- REVEAL_STEP_DELAY: 1500ms（以降）
- REVEAL_LINGER: 1200ms（最後の静止）
- RESULT_VISIBLE_MS: 4000ms（結果演出の表示時間）
- FLIP_DURATION_MS: 700ms（カード回転）

## ホスト操作
- ゲーム開始: waiting→clue。お題選択＋数字配布を自動（クイック開始）。
- お題シャッフル: clue 中に実行可。
- 数字配布: clue 中に再配布可（必要時）。
- 一括の確定: 下部ドックの「確定！順番を発表」。
- もう一度: finished後の再スタート。waitingへ戻し、order/deal/resultをクリア（次のラウンドは再度「ゲーム開始」から）。

## 例外/フェイルセーフ
- 一括モードの取りこぼし防止: reveal中に理論時間経過で finalizeReveal を呼ぶ保険タイマーをBoard側に実装。
- 結果演出は finished後にのみ表示（1.2s遅延で出現、~4sで閉じる/クリック閉じ）。

## アクセシビリティ/操作感
- D&Dはキーボード操作アナウンス対応（sort-submit）。
- 下部の操作列は「数字 → 入力 → 確定 → 出す →（ホスト操作）」の順で自然なフローに。

## 開発メモ（実装箇所）
- flow制御: app/rooms/[roomId]/page.tsx, lib/game/room.ts, lib/state/guards.ts
- UI要素: components/CentralCardBoard.tsx, ui/WaitingArea.tsx, ui/MiniHandDock.tsx, ui/ConfirmDock.tsx
- 演出: components/hooks/useRevealAnimation.ts, ui/ArtifactResultOverlay.tsx
- テーマ: theme/index.ts（slotRecipes: gameCard）, lib/ui/motion.ts（定数）

## 今後の拡張（デザイン反映の土台）
- テーマトークンを増やし、UIの色/影/背景は全てトークン参照へ統一
- WaitingAreaCard のラベル/ワード表示の細部（色/角R/発光）をモック最新へ
- ResultOverlay の文言/表示秒数/クリック動作を props 化

本フローは実装準拠です。差異が生じた場合はartifact-style-mock.htmlおよび ITO_MOCK_IMPLEMENTATION_GUIDE.md を先に更新し、本書を追随させてください。
