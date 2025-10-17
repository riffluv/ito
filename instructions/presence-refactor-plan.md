# Presence/Host 安定化タスク指示書

## 背景
- 現行実装は RTDB Presence と Firestore `players.lastSeen` を併用しているが、役割が曖昧で瞬断時にホストが観戦モードへ落ちる事象が発生した。
- 暫定対応としてクライアントから 45s ごとの `updateLastSeen` ハートビートと判定閾値の緩和を実施済み。  
  ただしこれはブラウザ依存の心拍であり、オンラインゲーム向けの業界標準とは言えない。

## 目的
Presence 情報を “単一の真実の源泉” として再設計し、短時間のネットワーク変動やタブ休止でもホスト／プレイヤーが不意に落とされない堅牢な実装へ刷新する。

## 実装ポリシー
1. **責務の一本化**  
   - RTDB `presence/<roomId>/<uid>/<connId>` を authoritative source にする。  
   - Firestore の `lastSeen` は履歴・統計用途に限定し、オンライン判定には使わない。  
   - どうしても Firestore 側の補助データが必要な場合は、RTDB → Cloud Functions → Firestore の一方向同期を採用する。

2. **サーバー側での存在判定**  
   - `lib/server/roomActions.ts` 系のホスト判定、prune 処理はすべて RTDB Presence のみを参照するよう書き換える。  
   - `MAX_CLOCK_SKEW_MS` / `PRESENCE_STALE_MS` をクライアント・サーバー間で共通値として管理し、コードの重複定義を排除する（例: `lib/constants/presence.ts` を新設して共有）。

3. **onDisconnect + 心拍の固化**  
   - クライアントは `attachPresence` で `onDisconnect` を確実に設定すること。失敗時はバックオフして再試行する。  
   - RTDB 側の `ts` 更新は `serverTimestamp()` に限定し、クライアントが `Date.now()` を書き込むのは禁止。  
   - 心拍の周期は 15s〜20s 程度とし、`setInterval` 失敗時は `visibilitychange`・`navigator.sendBeacon` 等で補完。  
   - ブラウザ休止時に心拍が止まるケースを想定し、Cloud Functions で “stale connection cleanup” を定期的（1分周期）に実行する。

4. **client fallback の廃止**  
   - `app/rooms/[roomId]/page.tsx` や `useHostClaim/useHostPruning` で `lastSeen` による補助判定を利用している箇所を撤廃。  
   - オンラインプレイヤー一覧は `subscribePresence` の結果だけで組み立てる。取得前（`undefined`）は “判定保留” として扱い、フォールバックで空配列を返さない。

5. **テスト整備**  
   - `__tests__/presence.spec.ts`（サーバーレイヤー）と Playwright シナリオ（ホストが短時間オフライン→復帰）を追加し、  
     - 5秒未満の瞬断ではホストが剥奪されない  
     - 60秒以上の切断では自動譲渡される  
     - 複数タブ同時接続・再接続でもホストが安定する  
     を自動検証する。

6. **メトリクスとログ**  
   - Presence 周りの主要イベント（接続・切断・cleanup・claim 成功/失敗）を `logInfo/logWarn/logError` で統一的に出力。  
   - `lib/utils/metrics` に Presence 専用カウンタを追加し、Cloud Logging／Sentry へ送出できるようにする。

## 作業項目（優先順）
1. `lib/firebase/presence.ts` のハートビート処理を `serverTimestamp()` + 20s 心拍 + 3回 retry バックオフへ再実装。  
   - 成功時は `cleanupResidualConnections` を実行。失敗時は 3 秒 → 9 秒 → 27 秒バックオフ。
2. `lib/server/roomActions.ts` のオンライン判定を RTDB のみ参照するよう修正し、`lastSeen` 依存コードを削除。  
3. Cloud Functions（`functions/` 配下）に `presenceCleanup` バッチを追加し、`PRESENCE_STALE_MS` を超えた古い接続を強制削除。  
4. `useParticipants` / `useHostClaim` / `useHostPruning` の `lastSeen` ロジックを排除し、`onlineUids` と RTDB イベントのみで動作させる。  
5. Jest + Playwright の統合テストを追加し、CI で presence/host のユースケースを検証。  
6. 既存の `updateLastSeen` を履歴用途のみに限定し、利用箇所を明示的に変更（例: ログイン時のみ更新、定期心拍は廃止）。

## 確認ポイント
- `npm run lint && npm run test` を通過させること。  
- Playwright E2E に “ホスト瞬断→復帰” シナリオを組み込み、GitHub Actions 上でも再現できるようにする。  
- デプロイ後は Cloud Logging で Presence イベントが期待通り流れているかを確認する。

## 引き継ぎメモ
- 今回の指示書は 2025-10-17 時点の `main` ブランチを前提としている。  
- 作業開始前に最新 `main` を取り込み、既存ハートビート（45s `updateLastSeen`）が残っていれば削除して構わない。  
- 実装後はこのファイルを `docs/changelog` に転記し、完了チェックを追記すること。

