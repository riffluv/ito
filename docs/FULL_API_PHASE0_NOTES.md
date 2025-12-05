# Phase 0 inventory (full API refactor)

調査日時: 2025-12-05

## 直接 Firestore 書き込み（クライアント SDK）
- `components/CreateRoomModal.tsx`: 部屋作成時の `setDoc`（rooms/<roomId>、players サブコレクション）。
- `lib/game/room.ts`: ゲーム進行コマンド群（startGame, dealNumbers, finishRoom, continueAfterFail, resetRoom, proposal add/remove/move, commitPlayFromClue, submitSortedOrder, finalizeReveal など）で `updateDoc`/`setDoc`/`runTransaction`.
- `lib/game/service.ts`: 上記進行系をラップしつつ `setDoc`/`updateDoc`/`runTransaction` を実行。`resetRoomWithPrune`, `beginRevealPending`, `clearRevealPending`, `setRoundPreparing`, `pruneProposalByEligible`, `cancelSeatRequest` など。
- `lib/services/roomService.ts`: 参加・離脱・ready・座席復帰・チャット投稿等を `setDoc`/`updateDoc`/`deleteDoc`/`runTransaction`/`addDoc` で実施。`ensureMember`/`leaveRoom`/`setReady`/`saveOrderIndices`/`chat` 投稿などを含む。
- `lib/firebase/rooms.ts`: `setRoomOptions`, `updateLastActive`, `transferHost`, `leaveRoom`, `resetRoomToWaiting`, `resetRoomWithPrune`, `requestSpectatorRecall` が `updateDoc`/`deleteDoc`/`runTransaction`.
- `lib/firebase/players.ts`: `setReady`, `updateClue1`, `saveOrderIndices`, `resetPlayerState`, `setPlayerName/Avatar`, `updateLastSeen` が `updateDoc`/`writeBatch`.
- `lib/firebase/events.ts`・`lib/firebase/chat.ts`・`lib/showtime/events.ts`: ルーム配下の `events` / `chat` への `addDoc`.
- `lib/game/mvp.ts`, `lib/game/topicControls.ts`: MVP 投票・お題管理で `updateDoc`.
- `lib/hooks/useBulletin.ts`: `bulletin` コレクションへ `addDoc`（ルーム外だが書き込みあり）。
- `lib/firebase/cleanup.ts`: 古い room/player ドキュメントの `deleteDoc`.

## RTDB 書き込み
- `lib/firebase/presence.ts`: Presence 心拍・接続管理で `set`/`update`/`remove`/`push` を使用（RTDB が唯一のソースという前提に沿った用途）。

## 2025-12-05 追加メモ（Phase3/4 完了）
- 上記の rooms/players 直書きはすべて Next.js API へ移行完了。
  - 新規 API: `/api/rooms/[roomId]/topic`（カテゴリ選択/シャッフル/カスタム/リセット）、`/mvp`（MVP 投票）、`/reveal-pending`・`/round-preparing`（UI フラグ）、`/players/profile`・`/players/reset`（プロフィール更新・自己リセット）、`/finalize`（リザルト確定）、`/prune-proposal`（提案クリーンアップ）。
  - `dealNumbersCommand` がプレイヤーの `number` を Admin SDK で付与するため、クライアントの番号書き込みは不要。
- クライアント側の Firestore 直書き（topicControls, mvp, roomService, firebase/players など）は撤廃済み。`lib/firebase/rooms.leaveRoom` 内のトランザクションは API 失敗時のフォールバックとしてのみ残置。

## 既存の関連 API Route
- `app/api/rooms/version-check/route.ts`（A案ガチのバージョン整合チェック）。
- `app/api/rooms/[roomId]/reset/route.ts`（host/creator/Admin で待機戻し）。
- `app/api/rooms/[roomId]/leave/route.ts`, `claim-host/route.ts`, `transfer-host/route.ts`, `prune/route.ts`。
- その他: `app/api/presence/heartbeat/route.ts`, `app/api/spectator/invites/route.ts`（観戦系）, Stripe 決済系など。

## バージョンガード関連
- `lib/constants/appVersion.ts` で APP_VERSION 解決。
- `lib/server/roomVersionGate.ts` の `checkRoomVersionGuard` / `normalizeVersion` / `versionsEqual`.
- クライアント版チェックは `lib/services/roomService.ts` 内 `ensureRoomVersionAllowed`（`/api/rooms/version-check` をフェッチ）でも実施済み。

メモ: Presence (RTDB) の設計・サーバー主導ポリシーは AGENTS.md を遵守済み。次フェーズではこれら直接書き込み箇所をサーバーコマンド層＋ API へ段階的に移設する。
