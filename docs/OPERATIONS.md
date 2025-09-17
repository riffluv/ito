# 運用メモ（提出・通知・同期の要点）

この文書は、ゲーム挙動を変えずに安定運用するための短いメモです。

## 1. Firestore ルール（提出の許可）

- 一般参加者の更新は、`clue` 中のみ以下を満たすと許可されます。
  - トップレベルの差分: `order` と `lastActiveAt` だけが変更
  - `order` 内の差分: `proposal` のみ（互換で `total` 同時更新も許可）
  - 重要フィールド（`hostId/status/options/topic/deal/result/round` 等）は不変
- ホスト/管理者の更新は従来どおり（`isValidHostAssignment` + `isValidRoomDoc`）。

備考: 旧/新クライアントどちらの書式（`updateMask` の揺れ）でも通るよう、diff ベースで判定しています。

## 2. クライアントの提出方針

- rooms の更新は「`order.proposal` と `lastActiveAt`」のみピンポイント更新。
- DnD の空きスロット ID は `slot-<index>` に統一（`over.id` と一致）。

## 3. ラウンド境界の扱い（復活防止）

- 古い連想を出さない条件: `clueUpdatedAt > resetAt`。
- 判定は以下の全経路に適用済みです。
  - 待機カード（WaitingAreaCard）
  - サイドリスト（DragonQuestParty）
  - 中央スロット（CentralCardBoard）
  - 入力欄の初期値（MiniHandDock）
- データの初期化（書き込み）は waiting 遷移時のみ（clue 直後は UI ガードで十分）。

## 4. 通知

- `events` サブコレクションに集約。チャットに依存しない。
- `RoomNotifyBridge` が可視時のみ購読し、右上トースト表示。
- 初期読み取りは最新1件→“入室後の新規のみ”表示。

## 5. ログの静音化

- `.env.local`（開発）
  - `NEXT_PUBLIC_LOG_LEVEL=warn`
  - `NEXT_PUBLIC_FIRESTORE_LOG_LEVEL=warn`
- `.env`（本番）
  - `NEXT_PUBLIC_LOG_LEVEL=error`（または `silent`）
  - `NEXT_PUBLIC_FIRESTORE_LOG_LEVEL=error`（または `silent`）

## 6. TTL（任意・無料）

- Firestore コンソール → TTL → 追加
  - コレクショングループ: `rooms/*/events`
  - TTL フィールド: `expireAt`
  - 有効化（自動削除）
- 送信側は `expireAt` を自動付与（保持日数は `NEXT_PUBLIC_EVENT_TTL_DAYS`）。

## 7. ロールバック

- ルールはコンソールの「履歴」から即復元可能。
- 既存クライアントは proposal ピンポイント更新に統一済みのため、後方互換性は保たれます。

