# Performance Optimization Brief

最終更新: 2025-09-30

## 目的

ロビー表示とルーム一覧取得における Firebase 読み取り負荷を低減しつつ、人数カウントの信頼性と UI レスポンスを維持することを目的としています。本アップデートでは以下の改善を実装しました。

- Firestore fallback 検証の動的バックオフと共有キャッシュ
- ルーム一覧フェッチの可変ウィンドウ / クールダウン制御
- アバター割り当てのメモリキャッシュ化
- ブラウザ計測 (`performance.measure`) とデバッグログの拡充

## 変更概要

### useLobbyCounts

- ルーム単位のヘルススコアと指数バックオフを導入し、Firestore 読み取り頻度を動的に調整
- fallback 検証結果を 30 秒間キャッシュし、presence が安定している間は Firestore クエリをスキップ
- `NEXT_PUBLIC_LOBBY_DEBUG_FALLBACK` でキャッシュヒット / バックオフログを有効化
- `performance.measure` による `fallback_single` / `fallback_multi` を `window.__ITO_METRICS__` へ蓄積

### useOptimizedRooms

- フェッチ所要時間と検索モードに応じてクールダウンを 30s〜5m の範囲で自動調整
- 取得ルーム数に応じて `lastActiveAt` のウィンドウを 1〜15 分の範囲で自動拡大/縮小
- `NEXT_PUBLIC_LOBBY_FETCH_DEBUG` でクールダウン計算結果をログ出力
- `rooms_fetch` 計測結果を `window.__ITO_METRICS__` に記録

### roomService

- join 時に players サブコレクションをキャッシュし、短時間での再 join で読み取りを省略
- キャッシュ TTL は 30 秒。`cleanupDuplicatePlayerDocs` が重複を削除した場合はキャッシュを無効化
- `performance.mark("avatar_cache_hit|miss")` でヒット率を QA できるように

## 環境変数

| 変数名                             | 既定値  | 役割                                                       |
| ---------------------------------- | ------- | ---------------------------------------------------------- |
| `NEXT_PUBLIC_LOBBY_DEBUG_FALLBACK` | `false` | fallback バックオフ/キャッシュの詳細ログをコンソールへ出力 |
| `NEXT_PUBLIC_LOBBY_FETCH_DEBUG`    | `false` | ルーム一覧フェッチのクールダウン計算をコンソールに出力     |
| `NEXT_PUBLIC_DISABLE_FS_FALLBACK`  | `false` | fallback 自体を緊急停止 (既存)                             |
| `NEXT_PUBLIC_LOBBY_VERIFY_SINGLE`  | `false` | fallback 検証 (単一 UID) を強制有効化 (既存)               |
| `NEXT_PUBLIC_LOBBY_VERIFY_MULTI`   | `false` | fallback 検証 (複数 UID) を強制有効化 (既存)               |

## ロールアウト手順

1. `.env.local` で `NEXT_PUBLIC_LOBBY_DEBUG_FALLBACK=1` `NEXT_PUBLIC_LOBBY_FETCH_DEBUG=1` を指定し、ローカル QA でメトリクスとログの有効性を確認
2. ステージングでタブ非アクティブ→復帰、連続 join/leave を実施し、`window.__ITO_METRICS__` の収集内容を確認
3. 本番でリリース後 24h は Firebase コンソールの Read ops を監視し、ピーク時間帯での読み取り削減率を記録
4. 想定よりフェッチ頻度が低い場合は `NEXT_PUBLIC_LOBBY_RECENT_WINDOW_MS` の既定値を少し下げるか、`MAX_FETCH_COOLDOWN_MS` を短縮

## ロールバック指針

- `NEXT_PUBLIC_DISABLE_FS_FALLBACK=1` で fallback を無効化すれば旧来の presence 専用ロジックに戻せます。
- `git revert <commit>` で `useLobbyCounts` / `useOptimizedRooms` の差分のみを戻す場合は、`docs/lobby-latency-tuning.md` の説明を旧バージョンへ合わせて更新してください。

## 未実施のフォローアップ

- Firebase Functions を用いた `players` 事前集計 (将来的には presence ゴースト検知をサーバ側に移譲)
- `window.__ITO_METRICS__` を Axiom へストリーミングする lightweight な uploader
- アバター割当キャッシュの SSR 対応 (サーバアクション経由 join の場合は別途検証が必要)
