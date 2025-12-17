# Debug Metrics Cheat Sheet（`dumpItoMetricsJson()`）

「序の紋章 III（オンライン版）」の不具合報告・切り分けを速くするために、DevTools Console で使うメトリクス採取コマンドの使い方をまとめます。

このプロジェクトでは `components/perf/PerformanceMetricsInitializer.tsx` が `window.dumpItoMetricsJson()` を提供しており、**いまのクライアントが持っている“状態/最近のトレース/主要タイミング”を1発で JSON 化**できます。

---

## 1) まずこれ（報告テンプレ）

### 1-1. 直後に叩く
不具合が起きた「その画面」で、**できるだけ早く** DevTools Console にこれを入力します。

```js
dumpItoMetricsJson("ここに症状を書いてOK")
```

例:
- `dumpItoMetricsJson("sync-stuck: host only")`
- `dumpItoMetricsJson("drag-issue: dropped but seino not visible")`
- `dumpItoMetricsJson("reset-failed: 500")`

### 1-2. コピペを楽にする（Chrome系）
Console が長くてコピーしづらい時は:

```js
copy(dumpItoMetricsJson("issue"))
```

---

## 2) どういう時に打つ？（おすすめラベル集）

ラベルは自由入力です。**「何が起きたか」「誰の端末か」「どの操作の直後か」**が分かる文字列にしてください。

### A. 同期・復帰（最優先）
- 症状: 「同期中です…」が長い / 片側だけ止まる / 別タブ復帰で挙動が怪しい  
  - `dumpItoMetricsJson("sync-stuck")`
  - `dumpItoMetricsJson("resume-after-background")`
  - `dumpItoMetricsJson("host-stuck-others-progressing")`

### B. 決定系 API（start/reset/next-round など）
- 症状: ボタン押下で失敗 / 500 / 409 / invalid_status  
  - `dumpItoMetricsJson("start-failed")`
  - `dumpItoMetricsJson("reset-failed")`
  - `dumpItoMetricsJson("next-round-failed")`

※ Console の Network タブで該当 `/api/rooms/...` の status code とレスポンスも一緒に貼ると最速です。

### C. 連想ワード（clue）
- 症状: 決定したのに刻印が遅い/戻る/反映が揺れる  
  - `dumpItoMetricsJson("clue-issue")`
  - `dumpItoMetricsJson("clue-optimistic")`

### D. ドラッグ/ドロップ（proposal）
- 症状: 置けた気がするのに反映されない / 「せーの！」が出ない / カードが一瞬消えた  
  - `dumpItoMetricsJson("drag-issue")`
  - `dumpItoMetricsJson("drop-noop-or-missing")`
  - `dumpItoMetricsJson("drag-disappear")`

### E. 音/表示（副作用チェック）
- 症状: 音が鳴らない / タブ復帰後だけ音が遅い / 表示が乱れる  
  - `dumpItoMetricsJson("audio-issue")`
  - `dumpItoMetricsJson("visibility-issue")`

---

## 3) どこを見る？（JSON の読み方）

`dumpItoMetricsJson()` は大きく以下を返します（代表例）。

### 3-1. `roomSnapshot`（同期の心臓）
同期が怪しい時はここが最重要です。

- `lastSnapshotSource`: `"server"` か `"cache"` か（`cache` だけが続くのは要注意）
- `lastSnapshotTs` / `lastAnySnapshotTs`: 最後に受けた snapshot の時刻（epoch ms）
- `forceRefreshMs`: 強制リフレッシュにかかった時間（自己回復が走っていれば出る）

### 3-2. `hostAction`（ホスト操作の観測）
ホストボタンの結果・スピナー理由の確認に使います。

- `syncSpinner.reason`: 何が原因で spinner を出しているか（例: `quickStartPending` など）
- `*.latencyMs` / `*.result` / `*.lastResult`: API/操作の結果（success/failure）
- `*.statusSyncMs`: 状態同期が追いつくまでの時間（重い時の指標）

### 3-3. `presence`（RTDB Presence）
「人数判定/入席可否/ホスト判定が怪しい」時に見る。

- `connection.open`: 接続が開いているか
- `heartbeat.ok`: 心拍が進んでいるか
- `connId`: 接続ID（再現条件がある時に役立つ）

### 3-4. `dropRecords`（ドラッグ/ドロップのタイミング）
`client.drop.*` のようなキーが集まります。

- `client.drop.queueWaitMs` などが大きい場合、操作が詰まっている可能性

### 3-5. `traces`（直近の重要イベント）
最後の10件が入ります。原因切り分けの“足跡”です。

例:
- `room.snapshot.forceRefresh`
- `room.snapshot.restart`
- `room.sync.event.received`（RTDB 通知）
- `clue.optimistic.apply/rollback/confirm`

---

## 4) 併せて欲しい情報（あると強い）

- 再現手順（最短）
- 端末/OS/ブラウザ（iPhone + Safari 等）
- その瞬間の Console エラー
- Network の該当 API の status code / response body
- 可能なら「ホスト側」「止まった側」「正常に進んだ側」それぞれの `dumpItoMetricsJson()`（同じラベルでOK）

---

## 5) 注意

- `dumpItoMetricsJson()` は “その端末が見ている状態” のスナップショットです。**現象が治ってから**打つと痕跡が薄れるので、なるべく直後に。
- 認証トークン等の秘匿値を表示する設計にはしていませんが、貼り付け前に念のため目視してください。

