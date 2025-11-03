# Safe Update FSM 設計プラン（2025-11-04）

## 1. 背景と目的
- 現状の Safe Update は `lib/serviceWorker/updateChannel.ts` を中心に段階的ロジックを維持しているが、イベント競合時に「勝手に更新」「更新中で停止」「タブ間不一致」が再発するリスクが残る。
- `.env` の `NEXT_PUBLIC_APP_VERSION` が更新されないと、旧バンドルを握った Service Worker が存在し続ける。ユーザー体験としては以下の課題が残っている:
  - 更新検知の通知がタブによって異なる。
  - 手動ボタンと自動適用が競合し、稀に固まる。
  - キャッシュが残っているユーザーが旧機能を長期間利用する可能性がある。
- **目的:** 状態遷移を XState 等の FSM で明示化し、更新検知→適用→再試行の挙動を統一。UI・テレメトリ・SW を跨ぐ処理を一元的に管理する。

## 2. 参考ドキュメント
- `lib/serviceWorker/updateChannel.ts`: 現行のストア実装（phase, autoApplySuppressed 等）。※ 2025-11-03 に XState マシンへリファクタリング完了。
- `docs/safe-update-incident-20251025.md`: 過去の障害と暫定対策の要約。
- `docs/SAFE_UPDATE_TEST_PLAN.md`: 現状の手動テストケース。FSM へ移行後も互換性のあるテストを維持する。

## 3. 想定ステート
| ステート | 説明 | 代表 UI / テレメトリ |
| -------- | ---- | -------------------- |
| `idle` | 更新待ち。監視のみ。 | バナー非表示。 |
| `checking` | `registration.update()` 実行中。 | ローディング表示（必要ならバッジ）。 |
| `update_detected` | `registration.waiting` を検出。 | バナー表示（「更新があります」）。 |
| `auto_pending` | 自動適用待機中（一定時間後に適用）。 | カウントダウン、AutoApply タイマー保持。 |
| `waiting_user` | 手動操作待ち。 | 「今すぐ更新」ボタン表示。 |
| `suppressed` | ゲーム中等で自動適用を禁止。 | バナーは「後で通知」。 |
| `applying` | `skipWaiting` 実行後、`controllerchange` 待ち。 | 「更新中…」表示。 |
| `applied` | 成功。必要なら 1 度だけ `location.reload()`。 | 「最新です」表示・自動リロード実施。 |
| `failed` | 適用失敗。 | 再試行ボタン + 詳細ログ。 |

> 既存の `state.phase` と互換を取りつつ、`update_detected` を `ready`、`auto_pending` を `ready(auto)`, `waiting_user` を `ready(manual)` といったサブステートで表現しても良い。

## 4. イベント一覧
| イベント | 発火元 | 概要 |
| -------- | ------ | ---- |
| `CHECK_TRIGGERED` | cron/timer/visibilitychange | `registration.update()` を開始。 |
| `CHECK_SUCCEEDED(waitingReg?)` | Service Worker 登録結果 | 待機中 worker の有無で `update_detected` or `idle` に遷移。 |
| `CHECK_FAILED(error)` | update() 失敗 | `failed` へ。ログ残し。 |
| `AUTO_TIMER_EXPIRED` | auto 適用タイマー | `auto_pending` → `applying` に遷移。 |
| `USER_CONFIRM` | バナーの「今すぐ更新」 | `waiting_user` → `applying`。 |
| `USER_DISMISS` | 「あとで」 | `waiting_user` → `suppressed`（or `idle`）。 |
| `APPLY_SUCCESS` | `controllerchange` / reload 後 | `applied`。`pendingReload` 消費。 |
| `APPLY_FAILURE(reason)` | タイムアウト or `redundant` | `failed` に遷移し、再試行可能に。 |
| `RETRY_REQUEST` | UI 再試行 | `failed` → `applying`（safe mode で適用）。 |
| `SUPPRESS_AUTO(reason)` | ゲーム進行中など | `suppressed` ステート。 |
| `RESUME_AUTO` | 抑止解除 | `suppressed` → `auto_pending` or `waiting_user`。 |

## 5. アクション定義
- `startUpdateCheck`: `registration.update()` 実行。結果に応じて `CHECK_SUCCEEDED`/`CHECK_FAILED` を dispatch。
- `announceWaiting(reg)`: `extractVersionTag` でバージョン取得、BroadcastChannel で他タブに通知。
- `scheduleAutoApply(delay)`: `setTimeout` 保持、キャンセル用 ID を FSM コンテキストに格納。
- `invokeApply({ safeMode })`: `waiting.postMessage({ type: "SKIP_WAITING" })` → `APPLY_SUCCESS` or `APPLY_FAILURE`。12 秒タイムアウト。
- `recordTelemetry(name, detail)`: `traceAction("safeUpdate.transition")` と `logSafeUpdateTelemetry` を併用。
- `reloadOnce()`: `location.reload()`（`pendingReload` フラグで多重防止）。
- `notifyUI(snapshot)`: `snapshotListeners` / React context へ変更通知。UI 側は `state.matches()` で描画。

## 6. データ構造（コンテキスト）
```ts
type SafeUpdateContext = {
  waitingRegistration: ServiceWorkerRegistration | null;
  waitingVersion: string | null;
  waitingSince: number | null;
  lastCheckAt: number | null;
  lastError: string | null;
  autoApplySuppressed: boolean;
  autoApplyHolds: Record<string, number>;
  autoApplyAt: number | null;
  pendingReload: boolean;
  applyReason: string | null;
  pendingApply: {
    reason: string;
    safeMode: boolean;
    startedAt: number;
    attemptId: number;
    automatic: boolean;
  } | null;
  retryCount: number;
  attemptSeq: number;
  applyTimeoutId: number | null;
  autoApplyTimerId: number | null;
};
```
- `autoApplyHolds`: 複数タブからの抑止を参照カウント方式で保持。
- `pendingApply`: 適用結果のテレメトリ情報と `consumePendingApplyContext` 用のデータを格納。
- `pendingReload`: `consumePendingReloadFlag` で消費されるまで `true` を維持し、重複リロードを防止。

## 7. テレメトリ／ログ要件
- `traceAction("safeUpdate.transition", { from, to, reason, version })`
- `traceAction("safeUpdate.autoApply.scheduled", { delayMs })`
- `traceAction("safeUpdate.apply.success", { safeMode })`
- `traceError("safeUpdate.apply.failed", error, { reason, safeMode, retryCount })`
- `window.__ITO_METRICS__.safeUpdate` は `phase` に合わせて `deferred / applied / failure / suppressed` を更新（既存カウンタを維持）。

## 8. 実装タスク
1. **前提整理**
   - `safe-update-incident-20251025.md` の暫定対策が FSM と重複しないか整理。
   - `NEXT_PUBLIC_APP_VERSION` をデプロイパイプラインで自動設定する（Vercel 環境変数 or build script）。
2. **マシン実装**
   - ✅ `lib/serviceWorker/updateChannel.ts` を FSM ベースへ再構築。既存 API (`subscribeSafeUpdateSnapshot` 等) は互換層を提供。
   - ✅ `useServiceWorkerUpdate` を新スナップショット構造へ対応させ、UI への公開値（`isUpdateReady` など）を新ステートへマップ。
3. **UI 更新**
   - `SafeUpdateBanner` / ミニ HUD の表示条件を `state.matches("update_detected")` 等で制御。
   - 「自動更新が抑止されている」ステートにバッジ表示。
4. **テスト**
   - ✅ `__tests__/safeUpdateMachine.test.ts` を追加し、自動適用・手動適用・失敗からの再試行をユニットテスト。
   - `SAFE_UPDATE_TEST_PLAN.md` を FSM と整合するようアップデート。自動テスト（Playwright）を追加。
   - BrowserStack 等で iOS PWA の挙動確認。
5. **ドキュメント/ハンドオフ**
   - 実装後に `safe-update-incident` 文書へ結果を追記。
   - 次エージェントへの引き継ぎとして FSM の状態図と `traceAction` 名をまとめる。

## 9. 次ステップ（推奨フロー）
1. `.env`（Vercel 含む）で `NEXT_PUBLIC_APP_VERSION` を設定し、デプロイ毎に更新。
2. 上記 FSM をプロトタイプ実装し、ローカルで `updatefound` → `apply` フローを確認。
3. QM テスト（手順書 + 自動化）を実施し、`safe_update.*` テレメトリが期待通りに変化するか検証。
4. 本番反映後、数日の間 `safe_update.failure` の件数を監視し、挙動を安定化。

## 10. 実装サマリ（2025-11-03）
- `lib/serviceWorker/updateChannel.ts` を XState v5 を用いた FSM へ移行し、BroadcastChannel 連携・force apply hold・auto apply タイマー・`consumePending*` API をアクション／コンテキストで一元管理。
- `traceAction("safeUpdate.transition", ...)`・`traceAction("safeUpdate.autoApply.scheduled", ...)`・`traceAction("safeUpdate.apply.success", ...)` / `traceError("safeUpdate.apply.failed", ...)` を主要遷移に追加。
- `useServiceWorkerUpdate`, `SafeUpdateBanner`, `UpdateAvailableBadge` が新しい `SafeUpdatePhase` を前提とした描画条件へ対応。
- Jest ユニットテスト `__tests__/safeUpdateMachine.test.ts` を追加し、自動適用・手動適用・失敗からの再試行シナリオを検証。
- `docs/SAFE_UPDATE_TEST_PLAN.md` を FSM フロー準拠で更新（自動適用・手動適用・失敗復旧・PWA 確認の手順を改訂予定）。

---
作成: Codex（2025-11-04）  
担当: Safe Update FSM 移行タスク一次設計
