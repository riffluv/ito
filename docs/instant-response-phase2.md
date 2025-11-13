# 即レス体感改善フェーズ2 メモ

## 1. カード提出の並列化
### 現状
- `enqueueFirestoreWrite` は `proposal:${roomId}:player:${playerId}` スコープでプレイヤー単位に直列化されるようになった（2025-XX 実装）。
- Firestore 取引はサーバー側リトライで解決するが、**同一プレイヤーによる連打** では依然として待ちが発生するため、さらなる最適化を検討する余地はある。
- Security Rules は `order.proposal` と `lastActiveAt` 以外の更新を拒否するため、キュー構造を変える場合もサービス層経由での書き込みが必須。

### 課題
- 同時ドロップ時の応答待ちが残り、「即レス」の体感が損なわれる。
- ホストが代理操作するケースでもルーム全体のキューに組み込まれ、他プレイヤーの操作がブロックされる。
- 並列化時に Firestore ルールや Functions 側での排他を設計しないと不整合発生リスクがある。

### 提案
- **プレイヤー単位キュー分割（PoC 実装済）**: `proposalQueueKey(roomId, playerId)` を導入し `proposal:${roomId}:player:${playerId}` スコープへ変更。`recordProposalWriteMetrics` で queue wait / tx time を Sentry Metrics へ送出。Typecheck: `npm run typecheck`。
- **Cloud Functions 排他制御案（比較検討）**: Callable Function で提出処理を受け、RTDB の `locks/{roomId}/{playerId}` をトランザクション確保→Firestore 更新→ロック解放。クライアントは Functions 経由のみ書き込み、ルールは API 署名付き書き込みに限定。
- どちらの案でも Firestore Rules の変更は不要、Cloud Functions 案は RTDB ルールへの追加許可が必要。

### 懸念
- プレイヤー単位キューでも、同一 ID を複数端末で操作すると待ち時間は残るためメトリクス監視が必要。
- Cloud Functions 案はネットワーク遅延とコールドスタートの影響を受ける。PoC で往復レイテンシ計測後に導入判断を行うべき。
- 将来的に `minInterval` を動的変更する場合、閾値設定とヒステリシス設計を詰める必要がある。

## 2. ローカル即時反映の強化
### 現状
- `useDropHandler` の `pending` 配列で楽観反映していたが、サーバー確定後のクリーンアップがなく、サーバー側で位置がずれた場合に一時的な二重表示が起き得た。
- `pending` が `string[]` のため穴埋めに弱く、差分計算・巻き戻し時の扱いが曖昧だった。

### 課題
- サーバーが別インデックスへ正規化したケースで UI が古い位置を維持し体感がぶれる。
- サーバー応答が `noop`/エラーの場合のロールバック通知が統一されておらず、ユーザーに失敗が伝わらない恐れがある。

### 提案
- `components/hooks/useDropHandler.ts` を更新し、`pending` を `Array<string | null>` へ型拡張。`scheduleOptimisticRollback` と `clearOptimisticEntry` を追加し、一定時間応答が無い場合は過去スナップショットに自動巻き戻し、通知を表示。
- サーバー `proposal` を監視する `useEffect` を追加し、確定済みカードを `pending` から除去して二重表示を防止。`useBoardSlots` / `CardRenderer` / `lib/cards/logic.ts` も `null` 対応に調整。
- Presence 切断に伴う“観戦落ち”を緩和するため、`PRESENCE_DISAPPEAR_GRACE_MS` を 5 秒に延長（`.env` で上書き可）。通信揺らぎで一瞬 Presence が途切れても UI が即座に観戦へ落ちなくなった。
- Typecheck: `npm run typecheck`。

### 懸念
- 巻き戻しタイマーは暫定 1200ms のため、計測値によるチューニングが必要。
- 同一プレイヤーが短時間に複数操作した場合、最後のスナップショットだけが保持されるため検証が必要。
- サウンド／アニメーション同期の手動確認は未実施であり、QA フローへ追加が必要。

## 3. 通信の先読み（プリフェッチ）
### 現状
- Reveal 演出では `useRevealAnimation` が都度 `evaluateSorted` を実行しており、prefix ごとに再計算していた。
- 結果表示用のサウンド・アセットを先読みする仕組みは棚上げ状態。

### 課題
- Reveal 開始直後に複数回の評価計算が走り、JS スレッドの瞬間負荷が高まる可能性がある。
- 今後アセット量が増えると、演出直前のロードで体感遅延が発生する恐れがある。

### 提案
- `lib/game/resultPrefetch.ts` を新規作成し、`primeSortedRevealCache` で prefix 評価を事前計算してメモリ保持。`useRevealAnimation` から Clue 中に `touchSortedRevealCache` を呼び、Reveal 中は `readSortedRevealCache` を優先使用、未ヒット時のみ従来の評価を実行。
- Reveal 完了・コンポーネント破棄時に `clearSortedRevealCache` を呼びメモリ解放。Typecheck: `npm run typecheck`。
- `missing-deal` フォールバックで数字を再配布しないようにし、通信ゆらぎ時に誤って全員の番号が変わる現象を防止。必要に応じてホストが手動で再配布できるようログを残す。
- サウンド/アセットのプリロードは SoundProvider 連携フックを別タスクとして設計メモ化。

### 懸念
- キャッシュはクライアントメモリに常駐するため、長大リストや複数ルーム観戦時の使用量をモニタリングする必要がある。
- numbers マップが短時間に更新されるケースでキャッシュシグネチャが追従できるか検証が必要。
- アセットプリロードは未実装のため、GSAP/Pixi 連携によるロード順制御を追加で検討する必要がある。

## 4. メトリクス収集 & 自動チューニング
### 現状
- これまでは `traceAction` とデバッグ用メトリクスのみで、書き込み遅延の統計が残っていなかった。
- キュー間隔やリトライ方針は静的設定のまま運用されている。

### 課題
- 平常時の平均/分位点を Cloud Monitoring や Sentry に送り、閾値ベースでアラート/自動調整する基盤が不足している。
- レイテンシが閾値を超えた際に `minInterval` を動的調整する仕組みが未整備。

### 提案
- `lib/metrics/proposalMetrics.ts` を追加し、`recordProposalWriteMetrics` で `queueWaitMs` と `txElapsedMs` を分布メトリクスとして記録。`lib/game/room.ts` の取引完了で呼び出すことで、Sentry Metrics API へ配信できるようにした。
- 収集した分布を元に、将来的に EWMA や p95 を利用して `PROPOSAL_QUEUE_MIN_INTERVAL_MS` を動的に調整するチューニングループを設計（別途実装予定）。
- Cloud Functions 案に移行しても同一メトリクス API を呼び出せば継続利用できるよう手当て。

### 懸念
- メトリクス送信はクライアント環境依存のため、Sentry Metrics や Cloud Monitoring 側の有効化をデプロイ要件に含める必要がある。
- 現状はクライアント側のみで集計するため、バックエンド視点の遅延監視が未整備。
- 動的チューニングのアルゴリズムは未実装で、今後ヒステリシスや安全装置を詰める必要がある。
