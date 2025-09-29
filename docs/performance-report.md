# Performance Report Template

最終更新: 2025-09-30

このテンプレートはロビー/ルーム最適化の QA および本番監視で収集したメトリクスを記録するためのメモです。`window.__ITO_METRICS__` に蓄積されるブラウザ計測値と Firebase コンソールの統計を照らし合わせて記入してください。

## 1. テスト環境

- 実行日時:
- ブランチ / コミット:
- テストブラウザ / OS:
- 環境変数: `NEXT_PUBLIC_LOBBY_DEBUG_FALLBACK`, `NEXT_PUBLIC_LOBBY_FETCH_DEBUG` など

## 2. ローカル QA 結果

| シナリオ                      | `fallback_single` 平均 (ms) | `fallback_multi` 平均 (ms) | 最大 freeze 時間 (ms) | 備考 |
| ----------------------------- | --------------------------- | -------------------------- | --------------------- | ---- |
| タブ非アクティブ → 復帰 × 5   |                             |                            |                       |      |
| 連続 join/leave (同一ルーム)  |                             |                            |                       |      |
| presence 切断シミュレーション |                             |                            |                       |      |

- `rooms_fetch` 平均 duration: **\_** ms
- `rooms_fetch` 推定クールダウン (`extra.cooldownMs`): **\_** ms

## 3. Firebase メトリクス

| 指標                           | 旧実装 (日次平均) | 新実装 (日次平均) | 差分 |
| ------------------------------ | ----------------- | ----------------- | ---- |
| Cloud Firestore Read ops       |                   |                   |      |
| Cloud Firestore Document Reads |                   |                   |      |
| Realtime Database Read ops     |                   |                   |      |

備考:

- Read ops はピーク時間帯 (21:00-23:00 JST) の 5 分移動平均を併記すると効果が把握しやすいです。
- ルームフェッチのクールダウンが長すぎる場合は Read ops が極端に減る一方で UI が stale になります。`rooms_fetch` duration と併せて確認してください。

## 4. 事象ログ

- `verify-single-error` / `verify-multi-error` 発生有無とエラーメッセージ
- `avatar-cache-fetch-failed` が発生した場合の再現手順
- その他気づいた点

## 5. アクションアイテム

- [ ] バックオフ最大値 (`MAX_BACKOFF_MS`) を **\_\_** ms に再調整 (必要な場合)
- [ ] `AVATAR_CACHE_TTL_MS` の調整検討
- [ ] Axiom 送信の自動化可否を検討

---

> 補足: `window.__ITO_METRICS__` の内容は `console.table(window.__ITO_METRICS__)` で一覧化できます。収集結果は必要に応じて CSV へコピーして保存してください。
