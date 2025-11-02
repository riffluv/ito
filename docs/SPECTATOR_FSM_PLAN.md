# 観戦フロー FSM 化 方針メモ

## 1. 現状整理

- 観戦モード判定は `app/rooms/[roomId]/page.tsx` 内部の `isSpectatorMode`（一連の `useEffect` と `useRef`）で実装されており、XState の `roomMachine` とは独立。
- 主なロジック断片  
  - `useForcedExit`: プレイヤーの強制退出・再入室補助。現状はホスト / メンバー判定でスキップしているが、トースト抑止・離席フローの判定は React 側の副作用に依存。  
  - `setPendingRejoinFlag` + `pendingSeatRequestRef`: 観戦者からの席リクエストを local state に積み、即時送信 or 後追い送信。  
  - Firestore 監視 (`rooms/{roomId}/rejoinRequests/{uid}`): リクエスト状態の更新に応じて `seatRequestState` やタイマーを更新。  
  - `attemptAutoSeatRecovery`: 待機状態かつ `pendingSeatRequestRef` / `seatRequestSource === "auto"` のときに自動で `performSeatRecovery` を再実行。  
  - 多数の `notify` / `traceAction` / `leavingRef` などの副作用が散在し、状態遷移の起点が複雑化。
- 問題点  
  - 観戦フロー固有の状態遷移が `useEffect` の組み合わせで暗黙的に管理されている。  
  - 「観戦開始 → リクエスト → 承認/拒否 → 再入室」といったフェーズが state machine 上に表現されておらず、レースコンディションが発生しやすい。  
  - Firestore 監視の副作用が UI コンポーネントに直結しており、他の変更からの影響範囲が読みにくい。

## 2. 新しい状態機械の概要

- `roomMachine` に観戦用のサブステートチャートを追加する。  
  - 大枠は `spectator` ノードを追加し、`spectator.idle` / `spectator.requesting` / `spectator.waitingHost` / `spectator.approved` / `spectator.rejected` などを遷移として定義。  
  - 既存の `waiting` / `clue` / `reveal` / `finished` はプレイヤー視点のフェーズ扱いで据え置き。
- 観戦関連のイベント案  
  | Event | 発火元 | 説明 |
  | --- | --- | --- |
  | `SPECTATOR_ENTER` | URL 入室時（部屋が進行中で参加権なしの場合） | 観戦状態へ遷移、フォールバック副作用を実行 |
  | `SPECTATOR_REQUEST` | 観戦 UI のボタン / 自動リカバリ | 席リクエスト送信。invoke サービスで Firestore 書き込み |
  | `SPECTATOR_CANCEL` | 観戦者がキャンセル、または recall window 閉鎖 | リクエストの取り消しと state リセット |
  | `SPECTATOR_APPROVED` | Firestore 監視 → status=accepted | プレイヤー復帰へ遷移、`joinRoomFully` を invoke |
  | `SPECTATOR_REJECTED` | Firestore 監視 → status=rejected | `spectator.rejected` へ遷移、UI 告知 |
  | `SPECTATOR_TIMEOUT` | タイムアウト監視 | タイムアウト通知後 `spectator.idle` へ戻す |
  | `SPECTATOR_LEAVE` | ブラウザ離脱/強制退出 | 観戦状態クリア、必要に応じて `leaveRoom` |
- サービス（invoke）で扱う処理  
  - Firestore `rejoinRequests` の購読を machine 内に封じ込め、subscription からのイベントを `SPECTATOR_*` 系に変換。  
  - 席リクエスト送信／キャンセル、`forceDetachAll`、`joinRoomFully` などの副作用を `actions` / `services` へ移動。  
  - 通知類（トースト）は `actions` として明示的に記述し、どの state で出すかを statechart 上で管理。
- ガード (`guards`)  
  - recall window 開放中か (`recallOpen`)／バージョン不一致がないか／観戦者本人がまだメンバーでないか、など。

## 3. UI 側の責務

- `RoomPageContent` は machine 状態を `useRoomState`（XState interpreter）から取得し、`spectator` サブステートの `value` / `context` を参照して表示を切り替える。  
- `setPendingRejoinFlag` や `seatRequestState` などのローカル状態は廃止し、machine の context に移す。  
- `attemptAutoSeatRecovery` や多数の `useEffect` は machine の `after` や `activities` で代替。React 側では必要最低限のエフェクト（UI transition／Pixi cleanup等）のみ残す。

## 4. 段階的移行ステップ

1. **イベント・副作用洗い出し（完了）**  
   - 既存観戦処理の主要イベント／副作用を洗い出し、上記テーブルに取り込んだ。
2. **machine 設計の叩き台作成**  
   - `roomMachine` に `spectator` ノードを追加し、最低限の context（`spectatorStatus`, `spectatorPendingSource`, `spectatorError` など）を定義する。  
   - 新設イベントの型定義を `RoomMachineClientEvent` に拡張。
3. **Firestore 監視の移行**  
   - 現在 `useEffect` で行っている `onSnapshot` を machine の invoke に置き換え、イベント経由で state を更新。  
   - これに伴い `pendingSeatRequestRef` 等の `useRef` を削除。
4. **UI の簡素化**  
   - 観戦 UI コンポーネントは machine の状態を props で受け取り、`send` 経由でイベントを発火するシンプルな構造に整理。  
   - トースト表示やトランジションは machine の actions から実施。
5. **テスト整備**  
   - XState の state test（`createTestModel` 等）で観戦フローを検証。  
   - Playwright で「観戦入室→リクエスト→承認」「観戦入室→リクエスト→拒否」「観戦入室→無操作→ホストリセット」などの E2E を追加。

## 6. 初期リファクタ ToDo（実装順想定）

1. `lib/state/roomMachine.ts`  
   - `RoomMachineClientEvent` に観戦イベントを追加。  
   - コンテキストへ観戦用データ（例: `spectatorStatus`, `spectatorRequestSource`, `spectatorError`）を定義。  
   - 新しい `spectator` サブステートを雛形だけ追加（イベントは未実装でも可）。
2. `lib/hooks/useRoomState.ts`  
   - interpreter から観戦 state/context を UI へ渡せるよう型を拡張。  
   - 既存の `roomStatus` 依存箇所へ観戦 state を供給する計画を立てる。
3. `app/rooms/[roomId]/page.tsx`  
   - 観戦 UI に必要な情報を machine state から受け取る props へ置き換える準備。  
   - `useForcedExit` などの呼び出し元を暫定ラッパに差し替え、machine イベントに委譲できるようにする。
4. Firestore サブスクのラップ  
   - 新しい invoke サービスのインターフェースを定義し、既存 `onSnapshot` ロジックを切り出す。  
   - サービスから `send` するイベントの payload 形式を決めておく。

## 5. 追加検討事項

- `NEXT_PUBLIC_FSM_ENABLE` フラグの扱い  
  - 観戦 FSM を導入する段階で flag を必須にし、旧ロジック分岐を段階的に削除する。  
  - 旧ロジック併存期間中は `roomMachine` 側だけ新実装へ寄せ、旧 UI パスでは従来処理を維持する。
- テレメトリ・トレース  
  - 現在の `traceAction("spectator.*")` を machine 内の actions へ移植し、状態遷移と同期させる。  
  - メトリクス（`bumpMetric("recall", ...)` 等）も同様に machine 内部から発火。
- フロントエンド外の依存  
  - Functions/API などサーバー側の観戦ロジックは今回は対象外。ただし state machine からのイベントに合わせて呼び出しシーケンスが変わる場合は別途調整する。

---

今後はこのメモをベースに、具体的な state machine 実装と UI リファクタを段階的に進める。
