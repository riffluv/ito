## 観戦フロー再設計プラン（2025-11-04）

### 目的
- 観戦 → 再参加の挙動を明確な状態遷移で管理し、レクリエーションなど大規模イベントでも安定稼働させる
- `app/rooms/[roomId]/page.tsx` に集中している副作用・責務を分離し、保守性とテスト容易性を高める
- Service Worker 更新判定（Safe Update）など周辺機能との絡みを整理し、ユーザー体験を途切れさせない

---

### 現状サマリ（課題ポイント）

1. **責務が散在**
   - `page.tsx` が観戦 FSM イベント送出、`sessionStorage` 操作、通知、Service Worker 更新などを横断して扱っている。
   - `useRoomState` にも観戦再参加ロジックが混在し、プレイヤー参加との境界が曖昧。

2. **状態の重複・競合**
   - `sessionStorage` キー（`pendingRejoin:*`, `autoJoinSuppress:*`）・XState コンテキスト・React state が同じ情報をそれぞれ持ち、タイミング差による競合が起きやすい。
   - `useForcedExit` が観戦モードでも `cancelSeatRequest` などを走らせ、再参加の流れとぶつかるケースがある。

3. **Safe Update 依存の複雑化**
   - Service Worker 更新待機 (`useServiceWorkerUpdate`) が観戦 UI の分岐に直接関与し、観戦ロジック自体が読みにくくなっている。

---

### ゴールイメージ

```
useSpectatorFlow ⇒ 観戦専用の状態と副作用を集約
 ├─ provides → spectatorState (mode/reason/request status 等)
 ├─ handles → requestSeat/cancelSeatRequest/clearFlags
 └─ emits → FSM events (SPECTATOR_*)

page.tsx
 ├─ useRoomState（プレイヤー入室/ゲーム状態）
 ├─ useSpectatorFlow（観戦UIに必要な情報を購読）
 └─ SafeUpdate UI（独立した通知レイヤー）

useForcedExit
 └─ プレイヤー退席/再接続のみに専念（観戦時は useSpectatorFlow がハンドリング）
```

---

### 詳細設計ステップ

#### 1. ステート構造の整理
- `roomMachine` に観戦サブステート（`spectator.idle / watching / requesting / waitingHost / approved / rejected`）を定義。
- 既存の `spectatorStatus`/`spectatorReason`/`spectatorRequestStatus` などはサブステートとコンテキストに集約。
- Firestore `rejoinRequests` 監視は machine の invoke で処理し、UI からは XState の state 経由でのみ結果を参照。

#### 2. `useSpectatorFlow` 新設
- 入力: `roomId`, `uid`, `displayName`, `roomState`（プレイヤー情報）, `sendRoomEvent`, `recallOpen` など。
- 出力:
  - `spectator` スナップショット（`mode`, `reason`, `request`, `buttonsDisabled`, `optimisticPlayer` 等）
  - ハンドラ: `requestSeat(source)`, `cancelSeatRequest()`, `leaveSpectatorMode()`, `clearPendingFlags()` など。
- 内部で `sessionStorage` フラグ（pending/auto join）を一元管理し、タイミングを明確化。
- `traceAction` / `logDebug` / `notify` もこのフックに閉じ込め、UI からは「何を表示するか」だけに専念。

#### 3. `useRoomState` の責務整理
- 観戦関連ロジックを `useSpectatorFlow` に移管し、`useRoomState` はプレイヤー入室 (`joinRoomFully`) と Firestore 購読、presence のみ担当。
- `clearPending()` など観戦絡みのメソッドは削除し、`useSpectatorFlow` から `useRoomState` に注入する API（例: `onJoinSuccess`）で同期。

#### 4. `useForcedExit` の調整
- 観戦モードでの強制退席は `useSpectatorFlow` 側でハンドルし、`useForcedExit` は「プレイヤー権限ユーザーの離脱」専用にする。
- `skip` フラグをデフォルトで `isSpectatorMode` に合わせ、二重に `cancelSeatRequest` 等が呼ばれないようにする。

#### 5. Safe Update (Service Worker) の分離
- `useServiceWorkerUpdate` の判定結果は `SafeUpdateBanner` など専用 UI コンポーネントで扱い、観戦ロジックに分岐を持ち込まない。
- 観戦フローには `versionMismatch` の最小限の情報のみ渡す。

#### 6. UI 再構成
- `page.tsx` は `useSpectatorFlow` が返す `spectatorState` を props として受け取り、ボタンの disabled 判定やメッセージを描画。
- `spectatorNotice` や `handArea` の表示判定は `spectatorState` の値に基づく純粋な条件式に変更。

---

### 実装タスク（概略）

1. **基盤整備**
   - [x] `useSpectatorFlow` ファイル作成（`lib/hooks` を想定）
   - [x] `roomMachine` に観戦サブステート定義を追加
   - [x] `useRoomState` から観戦関連の state/副作用を切り出し

2. **副作用の移行**
   - [x] 既存の `pendingSeatRequestRef`, `seatAcceptanceHold`, `autoJoinSuppress` 処理を新フックへ移動
   - [x] `notify`, `traceAction`, `logSpectator*` の呼び出しを整理し重複を解消

3. **UI の再配線**
   - [ ] `page.tsx` を新フックの戻り値に合わせて書き換え
   - [ ] 観戦 UI コンポーネント（ボタン群・メッセージ）の props を `spectatorState` ベースに統一

4. **強制退席・Safe Update の整理**
   - [x] `useForcedExit` を観戦除外モードで修正
   - [ ] Safe Update 表示コンポーネントの分離・簡素化

5. **テスト・検証**
   - [ ] 既存 Playwright/Jest の観戦テストケースの確認・更新
   - [x] `useSpectatorFlow` のユニットテスト整備（state 遷移テスト）
   - [ ] ログ・メトリクス（`traceAction("spectator.*")`）の動作確認

6. **ドキュメント・デプロイ準備**
   - [ ] `docs/` に観戦フロー新構成の概要追加
   - [ ] レクリエーション本番前チェックリストに観戦項目を追記

---

### 依存・留意事項
- Cloud Functions (`functions/src/rejoin.ts`) の処理は現行維持を前提とするが、観戦フロー移行後に verify が必要。
- `sessionStorage` クリアはブラウザタブ単位で動くため、複数タブを開いた場合の挙動も確認する。
- Safe Update 機能の API（`applyServiceWorkerUpdate`, `resyncWaitingServiceWorker`）を直接叩く箇所は新フックから排除する。

---

### タイムライン（目安）
1. 設計・骨組み作成：1〜2 日
2. 観戦フック導入＋`page.tsx` 差し替え：2〜3 日
3. FSM/強制退席/テスト整備：1〜2 日
4. QA・最終調整・ドキュメント反映：1 日

※ レクリエーション開催（11/19）までにバッファを確保できるよう、早めに実装着手・段階的な PR を推奨。

---

### 次アクション
- `useSpectatorFlow` 鋳型と観戦サブステートの skeleton 実装を先行で作成し、段階的に既存ロジックを移す。
- 移行後すぐに Playwright で観戦 E2E を回し、ホストリセット→再入室のケースを自動検証する仕組みを整える。

### 進捗メモ (2025-11-04)
- useSpectatorFlow に観戦席リカバリ用の API を拡張し、hasRejoinIntent / suppressAutoJoinIntent / cancelSeatRequestSafely を追加。再入室フラグと席リクエストのキャンセル処理をフック内に集約。
- useForcedExit は観戦フック経由のコールバックを受け取る構造に刷新し、sessionStorage 操作や cancelSeatRequest 直呼びを排除。観戦中の強制退席フローとリカバリ処理が競合しにくくなった。
- roomMachine に phase/spectator の並列サブステートを導入し、FSM とフック双方で観戦状態が 1:1 で同期する構造に移行。SPECTATOR_REQUEST_SNAPSHOT イベントもサブステート遷移を通じて整合性を保つように修正。
- page.tsx や useRoomState で spectatorNode を参照できるよう整備し、観戦サブステートに基づくログ出力と判定条件を更新。
- useForcedExit が spectatorNode と新しい再入室APIを利用するように更新され、観戦状態と連動した強制退席テレメトリを送出。
- クイック開始時に参加プレイヤー数を検証するガードを追加し、プレイヤードキュメントが揃う前に startGame/dealNumbers を呼び出さないよう調整。MiniHandDock から host actions へ在席人数を伝播することで、配札が行われず waiting に戻れない不具合を解消。
- 観戦専用通知パネルの文言とボタンを `seatRequestState` に合わせて再整理し、承認・却下・タイムアウト時のガイダンスとトースト重複を解消。タイムアウト発生時の自動トレース (`spectator.request.timeout`) も追加。
- `useSpectatorFlow` のユニットテストを追加し、再入室フラグ／キュー制御／キャンセル API の挙動を検証。観戦テレメトリ (`spectator.request.*`) のログ出力も受け側 UI と同期。
- 観戦パネルは `isSpectatorMode && !isMember` 条件に限定し、プレイヤー席に戻ったユーザーへ観戦UIが残留しないよう調整。FSM が再接続状態に揺れても観戦メッセージが出ないことを確認。
- `seatAcceptanceHold` のローカル state を削除し、観戦再入室待機は `seatRequestStatus` のみで制御。不要なタイマーやクリーンアップを排除し、`useSpectatorFlow` の責務を明確化。
- `handleSeatRecovery` の通知・トレース呼び出しを共通化し、`spectator.request.intent` / `spectator.request.blocked.*` で観戦リクエストの流れを可視化。今後は Playwright 観戦シナリオでトレースの整合を確認する。
