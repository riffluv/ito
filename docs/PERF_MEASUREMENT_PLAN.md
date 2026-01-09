# 体感改善（据え置きゲーム感）: 計測プラン

「改善のための改悪」を避けるために、まず **何を計測して、どの差分をもって“改善”とみなすか** を固定します。
このドキュメントは、既存の `trace` / `metrics` / `dumpItoMetricsJson()` を前提にした運用メモです（ゲームロジックは触らない）。

---

## 1. 基本方針（絶対に崩さない）

- 変更は小さく安全に（ドラッグ/同期/Pixi/ホスト操作/状態遷移/権限は慎重に）。
- Server-authoritative 方針を壊さない（決定処理は API/Functions が唯一の真実）。
- Presence は RTDB を唯一のソース（人数判定は `presenceReady` 待ち）。
- 計測は「増やす」より **使い切る**（既存の観測点で判別できない時だけ最小追加）。

---

## 2. 「体感」を分解して、測る対象を固定する

### 2.1 体感カテゴリ

1. **入力→反応**: 押した瞬間に「通った」と感じるか（不安/連打を生まない）
2. **同期の滑らかさ**: 状態が戻る/ちらつく/一瞬有効化などの視覚ノイズがない
3. **描画の安定**: FPS/INP が破綻せず、ピーク負荷が見えている
4. **復帰の安定**: タブ復帰/回線揺らぎで固まらず自己回復する

### 2.2 “改善”判定（例）

- 目標は **中央値を少し** よりも **p95 を削る**（不快な人を減らす）を優先。
- 観測期間は「同一ビルド」「同一シナリオ」「同一端末」を揃える。

---

## 3. 既存の観測点（まずここだけで戦う）

### 3.1 端末内ログ（再現時の採取）

- `copy(dumpItoMetricsJson("label"))`（`docs/DEBUG_METRICS.md` 参照）
  - 同期: `roomSnapshot.*`（`resume.serverSyncMs` / `lastSnapshotSource` など）
  - ホスト操作: `hostAction.*`（`*.latencyMs` / `*.statusSyncMs` / `syncSpinner.reason`）
  - presence: `presence.*`（`connection.open` / `heartbeat.ok`）
  - ドロップ: `dropRecords.*`（`client.drop.*` 系）
  - 足跡: `traces`（直近10件）

### 3.2 送出メトリクス（継続監視）

- クライアント体感
  - `client.inp.rolling`（主観の「重い」を拾いやすい）
  - `client.fps.sample`（描画が詰まる兆候）
- Ops（劣化兆候）
  - `ops.room.sync.health` / `ops.room.sync.staleAgeMs`
  - `ops.presence.degraded` / `ops.presence.recovered`

ダッシュボード作成は `docs/perf-metrics-dashboard.md` を参照。

---

## 4. シナリオ別：何を見ればよいか（“いつ・何を”の対応表）

### 4.1 参加〜入室（join）

- 症状: 参加が遅い / 同期中が長い
- 採取: `dumpItoMetricsJson("join-stuck")`
- 見る:
  - `roomSnapshot.lastSnapshotSource` が `cache` で停滞していないか
  - `ops.room.join.status` / `ops.room.access.*` が増えていないか

### 4.2 ホスト開始（quickStart / start）

- 症状: 開始が早い/遅い揺れ、開始 UI の再表示（フリッカー）
- 採取: `dumpItoMetricsJson("start-feel")`
- 見る:
  - `hostAction.quickStart.*`（`latencyMs` と `statusSyncMs` の差）
  - `syncSpinner.reason` が想定外に残っていないか
  - `traces` に `resetUiHold` 系の残骸が出ていないか

### 4.3 ドラッグ/ドロップ（proposal / commit）

- 症状: 置けたのに反映されない、せーのが出ない、カードが一瞬消える
- 採取: `dumpItoMetricsJson("drag-issue")` + `window.dumpBoardState?.()`
- 見る:
  - `dropRecords` の queue wait / noop / rollback 系
  - `roomSnapshot` の更新源と遅延（局所的な sync 遅延を疑う）

### 4.4 Reveal / Result 演出（重い・止まる）

- 症状: 演出開始直後にカクつく、音が遅い、結果で固まる
- 採取: `dumpItoMetricsJson("reveal-jank")`
- 見る:
  - `client.inp.rolling` のスパイク（前後1分）
  - `client.fps.sample` の下振れ（p50 より “落ちた回数” を見る）
  - `traces` の reveal 開始直後に同期/計算が集中していないか

### 4.5 リセット/次ラウンド（reset / next-round）

- 症状: 押下後の体感が重い、ボタンが一瞬戻る、ロックが残る
- 採取: `dumpItoMetricsJson("reset-next-round")`
- 見る:
  - `hostAction.reset.*` / `hostAction.nextGame.*`
  - `syncSpinner.reason` が適切に消えているか

### 4.6 タブ復帰/回線揺らぎ（resume）

- 症状: 復帰後だけ遅い、復帰で固まる
- 採取: `dumpItoMetricsJson("resume-lag")`
- 見る:
  - `roomSnapshot.resume.serverSyncMs`（復帰→server snapshot まで）
  - `ops.room.sync.health` が `stale|recovering|blocked` に寄っていないか
  - presence の `heartbeat.ok` が途切れていないか

---

## 5. 次に“追加できる計測”候補（実装前レビュー前提）

既存で判別できない場合のみ、以下を **最小** で追加する。

1. **入力即時フィードバック遅延**（押下〜UI反映の差）
   - 例: Start/Reset/Next で `performance.mark` → `performance.measure`
2. **重いフレーム原因の切り分け**
   - 例: Reveal 中に限って「どの処理が 16ms を超えたか」を low-cardinality で記録
3. **Pixi 側の負荷観測（背景/HUD）**
   - 例: draw call / texture recovery / context lost の頻度（既存 trace と揃える）

---

## 6. 運用（報告テンプレ）

再現したら「その画面」で、できるだけ早く：

1. `copy(dumpItoMetricsJson("症状 + 端末 + 直前操作"))`
2. Network: 該当 `/api/rooms/...` の status code と response body
3. 可能なら「ホスト側/止まった側/正常側」それぞれ採取（同じ label でOK）

