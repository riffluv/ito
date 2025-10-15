# イベントID方式による showtime 演出トリガー実装指示

## ゴール
勝利・敗北の演出（showtime とサウンド再生）を Firestore 上の「イベントID付きイベントストリーム」に置き換え、再接続やハードリロード時にも重複実行されないようにする。

## やりたいこと
1. **イベントデータ構造を新設**  
   - `rooms/{roomId}/events/{eventId}` のようなコレクションを作り、`type`, `payload`, `createdAt`, `processedBy` などを保存。  
   - 既存の `status/result` の書き込みから、副作用トリガーをこのイベントへ移行する。

2. **イベント生成タイミングの整理**  
   - ラウンド開始 (`round:start`)、判定結果 (`round:reveal`)、勝敗確定（成功/失敗）など、現在 `showtime.play(...)` を呼んでいる箇所でイベントを追加する。  
   - Cloud Functions またはサーバーロジックを使い、重複生成が無いようにする（例：トランザクション内で追加）。

3. **クライアントのイベント購読**  
   - `rooms/{roomId}/events` を `onSnapshot` で購読し、新しいイベントだけ処理する。  
   - `processedBy`（例：`processedBy.{clientId}`）を更新するか、LocalStorage に `lastProcessedEventId` を保持して、重複処理を避ける。

4. **showtime / サウンドのフックをイベントベースへ移植**  
   - `showtime.play()` や `GameResultOverlay` の副作用を、イベント受信ハンドラーの中から実行するように書き換える。  
   - 既存の `revealedAt` ベースの再生判定は撤去できるはず。

5. **過去イベントの整理**  
   - 古いイベントを一定期間後に削除するクリーンアップ処理（Cloud Functions のスケジュールでも可）。  
   - もしくは初期ロード時に「未処理かつ新しいイベントのみ」を処理し、古いものはスキップする。

6. **テスト観点**  
   - 勝利直後にイベントが1回だけ処理されること。  
   - ハードリフレッシュ後に同じイベントが再生されないこと。  
  - リビルドや複数クライアント同時接続時でも演出が重複しないこと。

## 注意点
- 既存の UI と同期を崩さないこと（`showtime` のタイミング、背景フラッシュは現状どおり）。
- イベントは「順序を保証する必要がある」ため、`createdAt` と `eventId` の扱いに注意する。
- Firestore の write/read コストは増えるため、イベント件数を必要最低限に抑える（ラウンド開始、結果確定など）。

## 参考ファイル
- `lib/showtime/actions.ts`
- `lib/showtime/scenarios/roundStart.ts` / `roundReveal.ts`
- `components/ui/GameResultOverlay.tsx`
- `app/rooms/[roomId]/page.tsx`
- `lib/game/room.ts`（判定ロジックと Firestore 更新）
- Cloud Functions：`functions/src/index.ts`（必要に応じてイベント生成を集中管理）

## 期待する成果物
- イベントストリームでトリガーされる showtime 演出が実装されている。
- ハードリロードや再接続で勝利ファンファーレ・背景演出が重複再生しない。
- 追加されたイベントスキーマや処理の説明を README などに追記。
