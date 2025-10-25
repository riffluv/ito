# 運用ガイド (OPERATIONS)

ゲーム「序の紋章 III（オンライン版）」を継続運用する際のハンドブックです。UI 層から Firebase までの責務を明示し、日常運用・トラブル対応・トレースの見方を何度でも参照できる形でまとめています。

---

## 1. レイヤー構造と責務

```
UI (components/ui, app/rooms/...)        ← 表示と入力のみ。ロジックは Hook/Service に委譲。
      ↓
Hooks (lib/hooks, components/hooks)       ← 状態集約・イベント制御。「traceAction」で主要操作を記録。
      ↓
Service (lib/game/service.ts ほか)        ← Firestore/RTDB 書き込み口を統一。UI から直接触らない。
      ↓
Firebase (lib/firebase/..., Cloud Functions) ← 永続層。認証・権限・バックグラウンド処理。
```

- **UI**: レイアウトとアニメーションを担当。GameCard などは props だけで振る舞いを決定。
- **Hooks**: 画面固有の状態を集約 (`useRoomState`, `useHostActions`, `useCardSubmission`, etc)。ここで trace を発火させ、失敗時は `traceError` で詳細を残す。
- **Service**: `lib/game/service.ts` に必ず経由。Firestore / RTDB へ直接書き込みたい場合も、ここへ処理を追加する。
- **Firebase**: ルール・Functions・RTDB Presence。Presence は RTDB が唯一のソース。

---

## 2. トレースとメトリクスの見方

- 主要操作に `traceAction("名前", detail)` を仕込んでいます。例:
  - `host.start`, `numbers.deal`, `order.submit`, `room.reset`, `reveal.finalize`
  - UI 由来: `ui.card.submit`, `ui.host.quickStart`, `ui.host.nextGame`, `ui.host.transfer`
- 失敗時は `traceError("名前", err, detail)` を必ず併走。Sentry Metrics が有効なら `trace.error.*` として集計され、開発中は console に `[trace:error]` が出力されます。
- ローカル/検証環境で挙動を見る際は **ブラウザ DevTools の Console** を開き、`[trace:action] ...` / `[trace:error] ...` を確認。
- メトリクスサマリは `window.__ITO_METRICS__` で取得可:
  - `ui.dragonQuestPartyRenderMs`, `ui.dragonQuestPartyRenderCount`
  - `participants.presenceReady`, `firestoreQueue.*`
  - Safe Update 系 (`safeUpdate.*`) も同様に監視できる。

---

## 3. よくあるトラブルと対処

| 症状 | 確認ポイント | 対処 |
| ---- | ------------ | ---- |
| カードが出せない / 「提出」ボタンが無効 | `traceAction("ui.card.submit")` が出ているか、`computeAllSubmitted` の条件が揃っているか | Presence Ready が false の場合はオンライン人数が計算に乗らない。`window.__ITO_METRICS__.participants` を確認し、クライアントが presence を張れているかチェック |
| 並び確定が押せない | `tests/submit-offline-continue.spec.ts` のロジックどおり、場に出ている人数と `effectiveActive` が一致しているか | 離脱者が proposal に残っていないか確認。ホストは「中断」でリセットまたは `/trace` を参照 |
| ホスト委譲が戻ってしまう | `[trace:error] ui.host.transfer` の detail を確認 | RTDB presence が古い可能性。対象プレイヤーに再ログインしてもらい、再度委譲 |
| 初回カードで回転しない | `GameCard` の `lastRotationRef` が未更新の場合は 3D 無効化が働いていないか確認 | タブを再読み込み。GSAP の from-to が実行されているか console で確認 |

---

## 4. FSM フラグの切り替え手順

新しい状態機械 (`lib/state/roomMachine.ts`) は feature flag で管理しています。

1. `.env.local` に `NEXT_PUBLIC_FSM_ENABLE=1` を設定（0 のままなら従来ロジック）。
2. `npm run dev` または `npm run build && npm run start` を再起動。
3. 主な動線（待機 → 連想 → 提出 → 公開 → 終了）の挙動が変わらないことを確認。
4. トラブル時は flag を 0 に戻し、`lib/hooks/useRoomState.ts` の `fsmEnabled` 分岐を辿って差分を調査。

※ 状態遷移テストは `tests/roomMachine.spec.ts` で網羅済み。Flag ON/OFF 双方で手動確認してから本番へ。

---

## 5. コマンドとチェックリスト

- 開発サーバー: `npm run dev`
- 型チェック: `npm run typecheck`
- ユニット／Playwright（一部）: `npm run test` / `npx playwright test`
- 本番ビルド: `npm run build && npm run start`
- 主要テスト:
  - `tests/roomMachine.spec.ts`
  - `tests/submit-offline-continue.spec.ts`
  - `tests/clue-input-shortcuts.spec.ts`
  - 既存 `__tests__/presence.spec.ts`

**デプロイ前チェック**
1. `npm run typecheck` → OK
2. `npm run test` → OK
3. `npx playwright test` → 新規テスト含めて OK
4. `NEXT_PUBLIC_FSM_ENABLE=0` の状態で手動プレイ → OK
5. Flag を 1 にして同じ流れを確認（リリース前の検証環境で実施推奨）

---

## 6. 参考リンク

- `Safe Update` telemetries: `lib/telemetry/safeUpdate.ts`
- Presence ロジック再設計メモ: `AGENTS.md`
- Game ロジック概要: `docs/GAME_LOGIC_OVERVIEW.md`

困ったら AGENTS.md や Safe Update メモへ追記し、次の担当者につなげてください。

