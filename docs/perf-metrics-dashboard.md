# パフォーマンス計測ダッシュボード設定ガイド

今回実装したクライアント計測 (`client.fps.sample` / `client.inp.rolling`) を活用するための Sentry メトリクス可視化手順です。

## 前提
- Sentry Projects の Metrics / Discover が利用可能であること
- 既にアプリに `PerformanceMetricsInitializer` を組み込んでデプロイ済みであること
- `NEXT_PUBLIC_DISABLE_CLIENT_METRICS` が `1` でないこと（計測が有効）

## 1. メトリクスの確認
1. Sentry で対象プロジェクトを開く
2. Metrics → Metrics Explorer を選択
3. Query に `client.fps.sample` を入力し、Aggregation を `p50`（中央値）もしくは `p95` に設定
4. Filters に `release` や `environment` を指定して、対象デプロイに絞り込む
5. 同様に `client.inp.rolling` についても確認

## 2. チャート（Dashboard）の作成
1. Dashboards → Create Dashboard
2. Widget を追加し、以下の設定例で作成する
   - **Widget 1 (FPS)**
     - Data source: Metrics
     - Metric: `client.fps.sample`
     - Aggregation: p50（中央値）
     - Display: Line Chart
     - Additional Filters: `tags.window:5000`（デフォルト窓長）
     - Thresholds: Warning < 50, Critical < 40
   - **Widget 2 (INP)**
     - Metric: `client.inp.rolling`
     - Aggregation: p95
     - Display: Area Chart
     - Thresholds: Warning > 120ms, Critical > 200ms
   - **Widget 3 (Web Vitals)**
     - Metric: `web-vitals.fid`, `web-vitals.cls`, etc.
     - Aggregation: p95
3. 保存してダッシュボードを共有

## 3. アラート設定
1. Alerts → Metric Alerts → Create Alert
2. Metric: `client.inp.rolling`
3. Condition: `p95 > 180` ms を 5 分間継続
4. Actions: 通知チャネル（Slack / Email）を設定
5. 必要に応じて `client.fps.sample` も同様に設定（例: `p50 < 45` を 3 分継続）

## 4. デバイス別の詳細分析
- `PerformanceMetricsInitializer` は自動的に `window` タグを付与
- 追加で `recordMetricDistribution` 呼び出し時に `tags: { device: navigator.userAgent }` などを付けたい場合は、`PerformanceMetricsInitializer` を拡張すればデバイス別比較も可能

## 5. トラブルシューティング
- メトリクスが表示されない場合
  - ブラウザの DevTools で `client.fps.sample` や `web-vitals.***` の送信ログを確認
  - `NEXT_PUBLIC_DISABLE_CLIENT_METRICS` が `1` になっていないか確認
- データ量が多すぎてコストが気になる場合
  - `NEXT_PUBLIC_PERF_FPS_WINDOW_MS` を 10000 などに延長してサンプリング間隔を長くする
  - `PerformanceMetricsInitializer` 内で `requestAnimationFrame` の実行を条件付きにする

## 6. 次のステップ
- ダッシュボードで遅延が確認される時間帯／環境が判明したら、該当する UI（例: Pagination、RoomPasswordPrompt）での再描画削減や Pixi/Gsap の調整を検討
- 端末別に INP が 200ms を越える場合、ノイズの多いアニメーションやエフェクトを `低負荷モード` で抑えるなどの対策を順次導入

以上の手順で、今回追加した計測を定期的に監視し、レスポンスの劣化を早期に検知できる体制が整います。
