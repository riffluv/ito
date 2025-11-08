# SHOWTIME再設計プラン

## 背景
- 現状は **FSM (XState)** ベースの新ロジックと、従来の `room.status` 直接参照ロジックが共存している。
- SHOWTIME の演出再生はまだ旧ロジック (`room.round`, `room.status`) の変化にフックしており、RESET や「次のゲーム」で不要な発火が起きる。
- FSM 化リファクタ時に、意図せず reset/quick start でも SHOWTIME が再生されるようになり、ユーザー体験を損なっている。

## 目標
1. SHOWTIME のトリガーを FSM/intent ベースに一本化し、RESET/次のゲーム操作では演出が走らないようにする。
2. 旧ロジックを補助的な fallback としてのみ残し、ログで把握できるようにする。
3. 設計をドキュメント化し、次のエージェントが容易に追従できるようにする。

## 全体戦略
- `RoomPage` に SHOWTIME intent 管理を集約し、START/REVEAL/RESET などの操作時だけ意図的にフラグを立てる。
- `useHostActions` / `MiniHandDock` など UI 側は intent handler を受け取り、どの操作が演出対象かを明示する。
- Firestore 経由の SHOWTIME イベントも intent と連動させ、重複再生を防止する。
- 旧 `room.status` ベースの再生ロジックは段階的に縮退させ、fallback が動いたときは `traceAction("debug.showtime.fallback")` を出して観測できるようにする。

## フェーズ別タスク
### フェーズ0：現状整理
- [x] `app/rooms/[roomId]/page.tsx` / `lib/hooks/useHostActions.ts` / `lib/showtime/*` の関連箇所を洗い出し、コメントで現状の責務を記す。
- [x] `docs/GAME_LOGIC_OVERVIEW.md` に SHOWTIME の現状問題を追記。

### フェーズ1：Intent 設計とインターフェース
- [x] `RoomPage` に `startIntentRef` / `revealIntentRef` / `clearIntent` 等のユーティリティを追加。
- [x] `useHostActions` に `showtimeIntentHandlers` を渡せるよう拡張し、「ゲーム開始ボタン」「カスタム開始」など **演出を伴う操作のみ** intent を立てる。`次のゲーム` や RESET → quick start など、意図しない経路では `markShowtimeStart: false` を渡す。
- [x] `MiniHandDock` & その他ホスト UI から `showtimeIntentHandlers` を受け渡し、`sendRoomEvent` を wrap して intent を漏らさない。

### フェーズ2：SHOWTIME Publish ロジックの刷新
- [x] `phaseEvent` ベースで `round:start` / `round:reveal` を publish する `useEffect` を実装。`consumeStartIntent()`/`consumeRevealIntent()` が true のときのみ Firestore へ書き込み & ローカル再生。
- [x] Firestore `subscribeShowtimeEvents` で intent をリセット、重複再生防止セット (`processedShowtimeRef`) を維持。
- [x] 旧 `room.status` 監視の `useEffect` は fallback としてのみ残し、`traceAction("debug.showtime.fallback", { reason: "legacy-status" })` を発火する。

### フェーズ3：ドキュメントとログ
- [x] `docs/SHOWTIME_REFACTOR_PLAN.md`（本ファイル）に進捗を記録し、移行完了条件を明記。
- [x] `docs/GAME_LOGIC_OVERVIEW.md` に SHOWTIME intent の説明と fallback の扱いを書き足す。
- [x] `traceAction` で `debug.showtime.intent` / `debug.showtime.event.play` を強化し、Playwright や手動テストで追いやすくする。

### フェーズ4：クリーンアップと完全移行
- [x] Fallback ログが一定期間 0 になったら、旧 `room.status` ベースの再生ロジックを削除する。
- [x] `NEXT_PUBLIC_FSM_ENABLE` が常時オンになるタイミングで、旧ロジック用の分岐・環境変数を整理する。

## 進捗ログ
- 2025-11-09 (Codex): RoomPage に intent/ref/processed-set を実装し、`round:start` / `round:reveal` の publish・Firestore 購読・fallback ログ化を完了。`useHostActions` と `MiniHandDock` へ `showtimeIntentHandlers` を追加し、start/reveal intent をホスト UI から明示的に伝搬できる状態にした。
- 2025-11-09 (you): 1人→2人構成で START/次のゲーム/RESET を多数回テストし、`debug.showtime.fallback` が不発であることを確認。
- 2025-11-09 (Codex): legacy `room.status` / `room.round` watcher を削除し、SHOWTIME は intent publish ルートのみで再生されるよう整理。

## 補足
- 途中で意図しない挙動が出た場合は、`debug.showtime.intent` のログと `traceAction("roomState.phaseEvent")` を合わせて確認すること。
- `git bisect` で壊れたコミットを追うより、段階的に意図を明文化して上書きする方が安全。
- Playwright で `tests/roomMachine.spec.ts` を流し、少なくとも「リセット後に SHOWTIME が再生されない」ことを目視する。
