# プロジェクト概要

- タイトル: **序の紋章 III（オンライン版）**
- 目的: 「ito」ライクな協力推理ゲームを、Pixi.js/GSAP による演出と Firebase（Firestore + RTDB + Auth + Functions）でリアルタイム同期させる。
- 技術スタック: Next.js 14 (App Router) / TypeScript / Chakra UI / Pixi.js 8 / GSAP 3 / Firebase / Stripe。

# 最近の大きな更新（2025-10）

1. **Presence 再設計（RTDB を authoritative に統一）**
   - Firestore `lastSeen` 依存の 45 秒ハートビートを廃止し、`presence/<roomId>/<uid>/<connId>` を唯一のオンライン判定に。
   - `attachPresence` は 20 秒心拍 + 指数バックオフ + `navigator.sendBeacon` フォールバック + `onDisconnect` を実装。
   - Cloud Functions `presenceCleanup` は `online !== true` かつ `offlineAt` が十分古い接続だけ削除するよう調整。

2. **クライアント Presence ハンドリング**
   - `useParticipants` / `useRoomState` に `presenceReady` と初期ハイドレーション待機を追加。初回スナップショットが空でも即ホスト剥奪しない。
   - `presenceLastSeenRef` を導入し、ホスト不在判定は「最後に確認できた時刻 + グレース（max(PRESENCE_STALE_MS, 60s)）」で評価。

3. **可視化復帰時のウォームアップ**
   - `SoundManager` に `warmup()` を追加し、AudioContext の再開＆pending play flush を即時実行可能に。
   - ルームページで `visibilitychange` を監視し、タブ復帰時に `soundManager.warmup()`、GSAP/Pixi の ticker tick を数フレーム強制実行。放置後のラグを緩和。

4. **テスト整備**
   - Jest: `__tests__/presence.spec.ts` を刷新（RTDB フラグ判定・グレース時間を検証）。
   - Playwright: `tests/presence-host.spec.ts` でホスト移譲・瞬断シナリオを自動確認。
   - `npm run typecheck` も通過確認済み。

# 現在の動作確認状況

- ローカル `npm run dev` + 複数ブラウザでの手動テストで、ホスト／メンバーが長時間の放置後も観戦落ちしないことを確認。
- 放置後の復帰で音・アニメーションが鈍る問題はウォームアップ処理で大幅に緩和。
- 低スペック環境スタッフとの手動テスト（ノート PC 2 台）でも完全同期を維持、落ち込みなし。

# 運用メモ

- **デプロイ手順**
  - Functions のみ更新: `firebase deploy --only functions`
  - Hosting も含む場合: `firebase deploy --only hosting,functions`（または `firebase deploy`）
  - Cloud Functions を更新しないと本番側が旧ロジックのままになるので注意。

- **ローカル開発**
  - クライアントコードは `npm run dev` で即時反映。タブ復帰の挙動を見る際はブラウザをハードリロード。
  - Cloud Functions の挙動まで確認したい場合は Firebase Emulator Suite を使うか、都度 `firebase deploy --only functions`。

# 主要ディレクトリ

- `app/rooms/[roomId]/page.tsx` … ルーム画面 UI/ゲーム進行。presence 監視、ウォームアップ処理を実装。
- `lib/hooks/useRoomState.ts` / `useParticipants.ts` … プレイヤー・presence 状態管理。
- `lib/firebase/presence.ts` … RTDB presence アタッチ／購読ロジック。
- `lib/audio/SoundManager.ts` … Web Audio 管理。`warmup()` 追加済み。
- `functions/src/index.ts` … Cloud Functions（presence cleanup / ghost room など）。
- `lib/showtime/` … GSAP/Pixi を使った演出オーケストレーション。
- `tests/presence-host.spec.ts` … Playwright テスト。

# 次のエージェントへのヒント

- プレゼンス関連は RTDB を唯一のソースとする設計が前提。`lastSeen` を復活させないこと。
- Presence 判定は `presenceReady` が true になるまで待つ。初期ハイドレーションのバグに注意。
- タブ放置後の復帰テストをする際は、コンソールログ（`[presence] update`、`[room-page]` 系）と Firebase Console の RTDB ノードを確認すると原因追跡しやすい。
- 新たに演出を追加する場合は GSAP/Pixi の ticker を重複起動させないよう `showtime` 仕組みを活用する。
- 何かトラブルがあれば `AGENTS.md` を更新してナレッジ共有してほしい。

