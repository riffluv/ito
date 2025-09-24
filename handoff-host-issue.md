# ホスト自動移譲バグの引き継ぎメモ

## 現象
- ルームから退出 → 再入室すると、元のホストがまだ残っていても `hostId` が別プレイヤーに移ることがある。
- 最近の修正（`lib/server/roomActions.ts` と `lib/firebase/rooms.ts` の `hostStillPresent` 判定追加）でも再現。
- 初回アクセス時の `/api/rooms/[roomId]/leave` / `claim-host` はビルドに時間がかかるが、これはキャッシュの問題で本症状とは別。

## これまでに行った対応
1. サーバー (`leaveRoomServer`) / クライアント (`leaveRoom`) 両方で、`remainingTrimmed` と `hostStillPresent` を追加し、現在のホストIDが `players` に残っていれば再割当しないよう修正。
2. システムメッセージを `[system] ...` 形式に統一、`displayName` サニタイズを追加。
3. `.env.local` に `NEXT_PUBLIC_LOG_LEVEL=info` を追加し、`logDebug` の大量出力を抑制。
4. `npm test -- hostRules` は成功。

## まだ解決していない点
- **再入室時**に `room.hostId` が空になる瞬間があり、別プレイヤーが `claim-host` を叩いてホストが移る。
- `hostClaimCandidateId` が常に先頭プレイヤーを選ぶだけなので、旧ホストが戻る前に他プレイヤーが候補になる可能性。
- Firestore `players` コレクションで `doc.id` と `uid` の整合が崩れていないかは未確認。

## 次の調査アイデア
- クライアント `attemptClaim` 実行直前に `room.hostId` と `hostClaimCandidateId` をログ出力し、自分自身かどうか判定してから `claim-host` を呼ぶ。
- Firestore 側の `onPlayerDeleted` / `onPlayerCreated` で `hostId` を空にしないよう、トランザクションまたは同一タイミングで処理する検討。
- Realtime Database の `presence/{roomId}` を確認し、再入室直後に旧ホストの presence が途切れていないかを調査。

## 再現手順メモ（追記予定）
1. ホストAとゲストBでルーム参加。
2. ホストAがいったん退出 → 即再入室。
3. このとき `room.hostId` がホストAのままかログで確認（`host-leave fallback-check` / `host-claim`）。

状況が変わったらこのメモにログや手順を追記してください。
