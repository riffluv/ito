# 新観戦システム アーキテクチャ草案

最終更新: 2025-11-05（コミット `7b55bf45` 基準）

## 1. 目的と範囲

- **目的**: 既存観戦フロー（レガシー）を置き換える新しい観戦システムを設計し、まずは招待制（身内向け）観戦ベータを実装する。
- **作用範囲**: フロントエンド（Next.js 14 / XState / Pixi）、Firebase（Firestore + RTDB + Functions/API）、テレメトリ。
- **非対象**: チケット課金・公開観戦実装は本ドキュメントでは設計フェーズのみ。実装は将来のステップ。

## 2. ユースケース

### 2.1 身内観戦ベータ（スコープ内）
| 番号 | シナリオ | 主体 | 概要 |
| --- | --- | --- | --- |
| UC-01 | ホストが観戦招待を発行 | ホスト | ゲーム内 UI から観戦招待リンクを生成し、URL/QR で共有 |
| UC-02 | 招待を受けたユーザーが観戦入室 | 観戦者 | 招待リンクから部屋へアクセスし、観戦セッションを開始 |
| UC-03 | 観戦中のプレイヤー復帰申請 | 観戦者 | 停止中のリコール window で復帰を申請し、ホスト承認を待つ |
| UC-04 | ホストが復帰を承認/拒否 | ホスト | 承認時はプレイヤーとして復席、拒否時は観戦継続 |
| UC-05 | ホストリセット/ゲーム終了時の観戦挙動 | システム | ゲーム状態変化に応じて観戦セッションを更新／終了 |

### 2.2 将来拡張（参考）
- UC-10: 公開観戦ロビー（鍵なし部屋一覧から観戦入室）
- UC-11: チケット購入 → 視聴 → 有効期限管理
- UC-12: 観戦者同士のチャット／エモート
- UC-13: 配信モード（観戦者数大規模対応）

## 3. 全体アーキテクチャ概要

```
┌─────────────────────────────┐
│ Next.js (App Router)           │
│  ├─ useRoomState (既存)        │
│  ├─ useSpectatorSession (新規) │
│  ├─ spectatorSessionMachine    │
│  └─ UI コンポーネント          │
│          │ send(event)         │
└──────────┬───────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ Firebase                       │
│  ├─ Firestore                  │
│  │   ├─ rooms/{roomId}         │
│  │   ├─ spectatorSessions/{id} │
│  │   └─ spectatorInvites/{id}  │
│  ├─ RTDB (presence)            │
│  └─ Cloud Functions / API      │
└───────────────────────────────┘
```

- 新観戦セッション情報は `spectatorSessions` コレクションで管理し、`rooms` ドキュメントとは分離する。
- `spectatorSessionMachine` がセッションの状態遷移（招待→入室→観戦→復帰申請→承認/拒否）を担当。
- 復帰承認後にのみ既存 `joinRoomFully` を実行し、プレイヤー側のロジックに影響を与える。

## 4. データモデル案（Firestore）

### 4.1 `spectatorInvites/{inviteId}`
| フィールド | 型 | 説明 |
| --- | --- | --- |
| `roomId` | string | 対象ルーム |
| `issuerUid` | string | 招待発行者（ホスト） |
| `createdAt` | Timestamp | 招待生成時刻 |
| `expiresAt` | Timestamp | 招待期限（オプション） |
| `mode` | string | `private`・`public` など将来拡張用 |
| `maxUses` | number | 使用可能回数 |
| `usedCount` | number | 現在の使用回数 |

### 4.2 `spectatorSessions/{sessionId}`
| フィールド | 型 | 説明 |
| --- | --- | --- |
| `roomId` | string | セッション対象ルーム |
| `viewerUid` | string | 観戦者 UID（未ログイン対応検討） |
| `status` | string | `watching` / `rejoin-requested` / `approved` / `ended` |
| `inviteId` | string | 利用した招待 ID（招待無しの場合は null） |
| `createdAt` | Timestamp | セッション開始 |
| `updatedAt` | Timestamp | 最終更新 |
| `rejoinRequest` | object | 復帰申請情報（`source`/`createdAt`/`reason` 等） |
| `telemetry` | object | 観戦体験計測用（`joinLatency`, `framesDropped` 等） |
| `flags` | object | 将来フラグ（有料チケットなど） |

### 4.3 既存 `rooms/{roomId}`
- 観戦システムによる追加書き込みは最小限にする。`spectatorSessions` から派生した必要情報のみ（例：現在承認待ち人数）をサマリで保持するかは要検討。

## 5. 状態機械概要

### 5.1 `spectatorSessionMachine`（新規）

状態ノード:
- `idle`: 招待検証前
- `inviting`: 招待トークン検証中
- `watching`: 観戦中
- `rejoinPending`: 復帰申請中（ホスト承認待ち）
- `rejoinApproved`: 承認済み（`joinRoomFully` 実行）
- `rejoinRejected`: 拒否された／タイムアウト
- `ended`: 部屋終了／ホストリセットにより観戦終了

主要イベント:
- `SESSION_START` (招待成功)
- `SESSION_ERROR` (招待失敗／期限切れ)
- `REQUEST_REJOIN` (観戦者→システム)
- `REJOIN_ACCEPTED` / `REJOIN_REJECTED` (サーバー通知)
- `SESSION_END` (ホストリセット・切断)

### 5.2 `roomMachine` との連携
- 既存 `roomMachine` はプレイヤー視点の FSM として維持。
- 観戦セッション FSM との連携ポイントは以下に限定:
  1. `REJOIN_ACCEPTED` → `joinRoomFully` → プレイヤーとして `START`/`SYNC` を受ける。
  2. `SESSION_END` → 観戦 UI を閉じる／トップへ戻る。

### 5.3 Rejoin サブステート詳細（2025-11-05 時点）
- `watching → rejoinPending` では `requestRejoin` サービスが `/api/spectator/sessions/[sessionId]/rejoin` を呼び出し、Firestore 側の `spectatorSessions/{sessionId}.rejoinRequest` を `pending` へ更新。
- `rejoinPending` に入ると即座に `observeRejoinSnapshot` が購読を開始し、ドキュメントの更新を `REJOIN_SNAPSHOT` イベントとして machine へ反映。  
  - `status=accepted` → `rejoinApproved` で `cancelRejoin` を発火し、承認後の冪等性を担保。  
  - `status=rejected` → `rejoinRejected` へ遷移し、理由 (`reason`) を `context.error` に格納して UI へ露出。  
  - それ以外（`pending` のまま）→ 状態を保持してホストの応答を待機。
- `rejoinRejected` から再度 `REQUEST_REJOIN` を送ると、`requestRejoin` サービスが再呼び出しされ、context の `error` / `rejoinSnapshot` はリセットされる。
- `SESSION_END` では `endSession` サービスが `/api/spectator/sessions/[sessionId]/end` を叩き、`status=ended` と `endReason` の記録を保証。
- ホスト UI (`SpectatorRejoinManager`) は `useSpectatorHostQueue` を介して `pending` な `rejoinRequest` を購読し、承認 (`approveRejoin`) / 拒否 (`rejectRejoin`) を API 経由で処理する。拒否理由は 160 文字に切り詰められ、クライアントでも同じ制約を提示。
- テストカバレッジ:  
  - `__tests__/spectatorSessionMachine.test.ts` で承認/拒否/再申請/セッション終了パスを検証。  
  - `__tests__/useSpectatorSession.test.tsx` でフックの `approve/reject` 委譲を確認。  
  - `tests/spectatorSessionRoutes.spec.ts` / `tests/spectatorHostFlow.spec.ts` で API レベルの承認・拒否・キャンセル→再申請・異常系（閲覧者不一致、理由切り詰め等）を網羅。

## 6. API / サービス設計

### 6.1 API 概要
| エンドポイント | メソッド | 概要 | 認証 |
| --- | --- | --- | --- |
| `/api/spectator/invites` | POST | 観戦招待を発行 | ホストのみ |
| `/api/spectator/invites/[id]/consume` | POST | 招待を消費しセッションを開始 | 認証済み（未ログイン対応検討） |
| `/api/spectator/sessions/[id]/rejoin` | POST | 復帰申請を登録 | セッション参加者 |
| `/api/spectator/sessions/[id]/approve` | POST | 復帰申請承認 | ホスト |
| `/api/spectator/sessions/[id]/reject` | POST | 復帰申請拒否 | ホスト |
| `/api/spectator/sessions/[id]/end` | POST | 観戦終了（ホストリセット等） | ホスト |

- Firestore 直接書き込みは禁止し、API を経由して server-authoritative な整合性を担保。
- Functions 実装の可能性もあるが、App Router の Route Handler で開始し、必要に応じて Functions へ移行。

### 6.2 クライアントサービス層
- `lib/spectator/v2/service.ts` で API 呼び出し／Firestore 読み込みラッパを提供。
- `lib/spectator/v2/adapters` にて既存 hook との互換用ヘルパーを実装。

## 7. テレメトリ・ログ
- `traceAction("spectatorV2.*")` を新設し、セッション開始／観戦開始／復帰申請／承認／拒否を計測。
- `metrics`: 観戦による `rooms` 書き込み回数、観戦→復帰レイテンシを記録。
- 旧フローとの差分比較用に `SpectatorV1` vs `SpectatorV2` ラベルを付加。

## 8. 段階的移行計画

1. **設計確定**: 本ドキュメントをレビューし、データモデル・API・FSM の仕様を固める。
2. **基盤実装**: `spectatorSessionMachine`・サービス層・API を実装し、ユニットテストを整備。
3. **UI 組み込み（ベータフラグ）**: フラグ `NEXT_PUBLIC_SPECTATOR_V2` 有効時に新フローを有効化。旧フローは並存させる。
4. **E2E 検証**: Playwright で観戦入室→承認のシナリオをカバー。
5. **計測・安定化**: ラグ改善を確認したら旧フローを無効化する時期を決定。
6. **旧フロー撤去**: 旧 `useSpectatorFlow` 等を削除し、関連ドキュメントを更新。
7. **公開観戦準備**: 招待以外の観戦導線（公開ロビー、チケット）に着手。

## 9. 未確定事項 / ToDo

- 外部認証が無いゲスト観戦者への対応（セッション紐づけ方法）
- 招待期限や同時視聴上限のポリシー
- 旧フローと新フロー混在期間のメトリクス集計方法
- Functions と Route Handler のどちらを本採用するかの最終判断

---

この草案をベースに詳細設計・実装を進め、決定事項は逐次更新する。

## 10. 2025-11-05 Hook 順序リファクタリングメモ

- `app/rooms/[roomId]/page.tsx` で観戦用 Hook 群（`useSpectatorSession` / `useSpectatorFlow` など）を `RoomPageContentInner` に集約し、認証・ルーム読み込み中の早期 return では **React Hook が追加されない** ことを保証。`React error #310` の再発を防止。
- レンダー中に `notify` / `setState` を実行していた箇所を `useEffect`／`useCallback` 内へ整理し、副作用の発火タイミングを安定化。
- Service Worker 更新監視 (`subscribeToServiceWorkerUpdates`) を内側へ移動しつつ、`RoomPageContent` ではローディング判定とルーター遷移処理のみを担当する構造に変更。
- Jest (`__tests__/SpectatorNotice.test.tsx`) と `npm run typecheck` で回帰を確認済み。観戦ベータの検証手順に影響はなく、FSM/Service Worker の流れも従来通り。
