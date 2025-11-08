# 入室・退室・観戦フロー精査メモ（2025-11-03）

本ドキュメントは FSM 前提へ統合した後の入室／観戦挙動を再点検し、問題となったポイントと残課題を整理したものです。  
（最新修正: `skipForcedExit` の再調整、`useRoomState` の join 条件見直し）

---

## 1. 現行フロー概要

### 1-1. 自動参加フロー
- `useRoomState` が Firestore/RTDB の参加者リストを購読し、`isMember` を更新。
- `room.status === "waiting"` の間は `joinRoomFully` を発火し、成功すると `joinStatus` を `joined` に遷移。
- 再入室 (`pendingRejoin:*` が存続) の場合のみ、`recallOpen === true` を要求。初回参加は `recallOpen` に依存せず常に join。

### 1-2. 観戦遷移
- `spectatorCandidate` は以下の条件をすべて満たす場合のみ `true`:
  - `uid` 有り、`isHost === false`, `isMember === false`
  - `joinStatus` が `"idle"`（または `"joined"` 以外）ではなく、かつ `seatRequestPending` 等の再入室操作が走っていない
  - `loading === false`
- `spectatorCandidate` が `true` になった瞬間に 220ms デバウンスで `SPECTATOR_ENTER` を送信。  
  `spectatorCandidate` が `false` に戻った場合（join 開始など）は `SPECTATOR_LEAVE` / `SPECTATOR_RESET` を送る。

### 1-3. 強制退席（forced exit）
- `useForcedExit` が `canAccess === false` を検出すると以下を行う:
  - `autoJoinSuppress:*` を `1` にセットし、forced exit 理由を FSM へ通知 (`SPECTATOR_FORCE_EXIT`)。
  - 既存の `rejoinRequests` をキャンセルし、`leaveRoomAction` で Firestore/RTDB から除外。
- `skipForcedExit` が `true` の場合（`uid` 無し・ホスト/観戦でない通常参加者など）は処理をスキップ。

---

## 2. 発生していた致命的な問題と修正

### 2-1. 新規参加者が強制退席扱いになっていた
- **原因:** `skipForcedExit = !uid` によって、join 中の参加者でも `useForcedExit` が強制実行されていた。
- **症状:** `autoJoinSuppress` が常に立ち、`joinRoomFully` 実行後に即座に `leaveRoomAction` が呼ばれる → ホストから見ると 1 人目しかおらず、UI の人数と不一致。
- **対応:** `skipForcedExit = !uid || (!isHost && !isMember && !isSpectatorMode)` に修正し、観戦状態へ遷移していないプレイヤーには forced exit を掛けない。

### 2-2. 再入室判定が `recallOpen` に引きずられていた
- **原因:** `allowDirectJoin` の条件が「`recallOpen !== false`」に依存しており、`recallOpen === false` の待機状態だと初回参加もブロックされていた。
- **対応:** `pendingRejoin` の有無で分岐し、初回参加は `recallOpen` を無視、`pendingRejoin===true` の再入室だけが `recallOpen === true` を要求するよう整理。

---

## 3. SessionStorage フラグ整理

| フラグキー | Set するタイミング | Clear するタイミング | 備考 |
| ---------- | ------------------ | --------------------- | ---- |
| `pendingRejoin:${roomId}` | - 再入室ボタン (`setPendingRejoinFlag`)<br>- `useLeaveCleanup` の `pagehide/visibilitychange` | - `useRoomState` の `clearPending` (`joinRoomFully` 成功時)<br>- `useForcedExit` cleanup 中の `cancelSeatRequest` 成功時 | `traceAction("spectator.pending.clear")` で監視。 |
| `autoJoinSuppress:${roomId}:${uid}` | - `useForcedExit` が `canAccess === false` を検出した瞬間 | - 観戦 UI から「席に戻る」押下 (`clearAutoJoinSuppress`)<br>- `useRoomState` の `clearPending` | 手動解除は `traceAction("spectator.autoJoinSuppress.clear")` で記録。 |

> NOTE: join 完了後に両フラグが残っていないか、`Pending` / `Suppress` いずれか片方のみ残らないかを Kibana で追跡する。

## 4. FSM イベント遷移サマリ

```
watching ── SPECTATOR_REQUEST ──► requesting ──(snapshot accepted)──► approved ──► (ensureMember) ──► idle
    ▲                │                              │
    │                │                              └─> rejected ──► watching
    │                │
    │                ├─ SPECTATOR_FORCE_EXIT ─► idle (reason 保持)
    │                └─ SPECTATOR_TIMEOUT ─► watching
    └─(JOIN 完了 / LEAVE)─ SPECTATOR_RESET / LEAVE ─► idle
```

- `SPECTATOR_REASON_UPDATE` は観戦 UI 側の文言表記のみを更新する。  
- `SPECTATOR_WAIT_HOST` は承認待ち (`requesting`) とほぼ同義で、将来的に統合余地あり。  
- `spectator.forceExit.detected`／`spectator.forceExit.recovered` などの `traceAction` を追加済み。

## 5. E2E テスト整備

Playwright で以下のケースを自動化した。

1. **通常参加 → 並び確定** (`tests/spectatorFlow.spec.ts`)
   - `pendingRejoin:${roomId}` が join 完了後に削除されること、および `spectator.pending.clear` が `autoJoinSuppressCleared: false` で記録されることを検証。
2. **観戦 → recallClose 中の再入室**
   - 観戦キュー投入時に `spectator.request.enqueue` が出力されること。
   - `recallOpen` 再開後に `pendingRejoin` と `autoJoinSuppress` が同時に解放され、`spectator.pending.clear` の詳細に `autoJoinSuppressCleared: true` が含まれることを確認。
3. **強制退席 → 観戦 UI 維持**
   - `spectator.forceExit.detected` → `spectator.forceExit.cleanup` → `spectator.forceExit.recovered` の順序でトレースされること。
   - 復帰後に `pendingRejoin` / `autoJoinSuppress` が残らないことを検証。

テスト実行コマンド:

```bash
npx playwright test tests/spectatorFlow.spec.ts
```

※上記テストは `__ITO_TRACE_BUFFER__` を直接参照し、`traceAction` 出力が期待どおりであることも確認している。

## 6. ログ＆デバッグ導線

- 主要ログ:
  - `traceAction("membership.state")`
  - `traceAction("spectator.request.enqueue")`
  - `traceAction("spectator.forceExit.*")`
  - `logDebug("room-page", "spectator-state", ...)`（ステート差分出力）
- Kibana / console では `spectator.*` prefix で検索できるようテンプレートを用意する。
- join フローの不一致を調べる際は `joinRoomFully-*` と `membership.state` を連続で追うと解析が早い。

---

## 4. 今後の進め方（サマリー）

1. 上記テスト整備（§5）を実装し、結果を反映する。  
2. 観戦フローが安定した時点で FSM 化残タスク（旧ドキュメントやフラグ整理）へ移行する。  
3. 次エージェント向けに、完了／未完リストと検証済みシナリオをまとめたハンドオフ文書を用意する。

---

補足: `NEXT_PUBLIC_FSM_ENABLE` は完全に廃止済み（`.env.local` / `.env.local.bak` いずれにも存在しません）。性能計測フラグ類 (`*_PERF_*`) は現行のまま維持。

---

## 7. 観戦／リセット周りのリファクタリング計画（次期エージェント向け）

### 目的

1. **FSM ロジックへ一本化** — `pendingRejoin` / `autoJoinSuppress` / `recallOpen` など旧ロジック由来のフラグを散在させず、FSM および専用モジュールで管理する。
2. **リセット操作と観戦復帰の完全分離** — 「ルームを waiting へ戻す」操作と「観戦者を席へ招く」操作を別経路にし、リセットでは観戦者を呼び戻さない。
3. **拡張性／デバッグ性向上** — API と状態遷移をドキュメント化し、主要イベントを `traceAction` で可視化することで、他エージェントが即座に影響範囲を把握できるようにする。

### 実装概要

1. **API レベルの分割**
   - `/api/rooms/[roomId]/reset` は既定で `ui.recallOpen=true` の待機状態へ戻すが、観戦者は自動では戻らない。ホストが観戦席を閉じたい場合は、`recallSpectators: false` を明示するか `/spectators/recall` API で個別制御できる。
   - 観戦者を一斉に待機へ戻す専用エンドポイント `/api/rooms/[roomId]/spectators/recall` を新設し、`lib/firebase/rooms.ts` の `requestSpectatorRecall()` 経由でホスト操作からのみ叩く。
   - `composeWaitingResetPayload` の既定値は `true` に戻しつつ、UI では観戦者を常に spectator HUD 上に留めるため、自動再入室は行わない。

2. **状態管理の整理**
   - `useRoomState` は `pendingRejoin` / `autoJoinSuppress` を直接触らず、`lib/spectator/sessionFlags.ts` の `readPendingRejoinFlag` / `readAutoJoinSuppressFlag` に委譲。
   - `requestSpectatorRecall()` が `traceAction("spectator.recall.initiated")` / `"spectator.recall.success"` を記録し、失敗時は `traceError("spectator.recall", …)` に集約した。
   - `recallOpen` は「サーバーが観戦者再入室を受け入れているか」のフラグに限定され、UI の可否判定は新 API とリクエスト状態に依存する。

3. **UI / UX の調整**
   - 観戦 UI（SpectatorNotice）は常に表示し、`席に戻れるか試す` ボタンから手動で再入室フローを開始する。リセット後は `ui.recallOpen=true` のため、ボタンを押せば即時承認（自動承認）で席に戻れる。
   - 観戦者復帰パネル（観戦者の復帰申請）はデザインが固まるまで非表示にしつつ、裏側の自動承認ロジックだけを残してあるため、再度有効化したい場合はフラグを戻すだけで良い。

4. **トレースとドキュメント**
   - 新しい `spectator.recall.*` トレースで API 呼び出しを可視化し、観戦者まわりの調査ポイントをダッシュボードから即確認できるようにした。
   - 本ドキュメントを最新仕様に更新し、API / FSM / UI の分離を随時参照できるようにした。

### 完了定義

- リセット後に観戦者が自動で席へ戻らない（`ui.recallOpen` の既定値は常に `false`）。
- 観戦者は「席にもどる」ボタンとホスト承認なしにはプレイヤー席に復帰できない。
- FSM／API／フラグ管理の責務が明確に分かれ、他エージェントが観戦ロジックを触っても副作用を即座に把握できる。
- 本ドキュメントなどに最新仕様が記載され、ハンドオフ情報として参照可能になっている。

> この計画を次期エージェントへ引き継ぎ、実装着手前に API 設計と state machine 図を更新すること。
