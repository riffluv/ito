# 序の紋章III リファクタリング指示書 v1

最終更新: 2025-11-18  
対象: Codex / ChatGPT などのエージェント（実装担当）

---

## 0. このドキュメントの使い方

- このファイルは「**次のエージェントが何をどう直すか**」を明確にするための指示書です。
- 毎セッションの最初にここを読み、**フェーズ順にタスクを進めてください**。
- 実装が進んだら:
  - 完了したタスクに「(DONE)」コメントやチェックボックスを付ける
  - 新たに見つかった論点や TODO を追記する
- コードリーディング自体はこの指示書をガイドにして、該当ファイルをローカルで開いてください。

---

## 1. 目的とスコープ

### 1-1. 目的

- ホスト操作 / ルーム状態管理 / 観戦 / プレゼンスまわりを、
  - **責務ごとに分割**し、
  - **テストしやすく**、
  - **将来拡張しやすい**構造に整理すること。

### 1-2. スコープ（今回フォーカスする領域）

- ホスト操作:
  - `lib/hooks/useHostActions.ts`
  - `components/hooks/useHostActions.ts`
  - `components/ui/MiniHandDock.tsx`
  - `components/ui/HostControlDock.tsx`
  - `lib/game/quickStart.ts`
  - `lib/host/hostActionsModel.ts`
  - `lib/game/service.ts`
- ルーム状態:
  - `lib/hooks/useRoomState.ts`
  - `lib/state/roomMachine.ts`
  - `app/rooms/[roomId]/page.tsx`
- 入室 / 観戦 / プレゼンス:
  - `lib/services/roomService.ts`
  - `lib/firebase/rooms.ts`
  - `lib/hooks/useParticipants.ts`
  - `lib/hooks/useLobbyCounts.ts`

この指示書 v1 では **フェーズ1〜3 を優先**して実装してください。フェーズ4以降は余力があれば着手する想定です。

---

## 2. 共通方針・制約

- **Firestore / RTDB の書き込みは service 経由**に寄せる。
  - 例: UI コンポーネントから直接 `updateDoc` するコードは、`lib/services/*` または `lib/game/service.ts` の薄いラッパへ移す。
- **Server-authoritative ポリシーを尊重**する。
  - `docs/AGENTS.md` の「サーバー主導ポリシー」「reset API / ui.recallOpen」説明に反しないこと。
- 可能な限り **既存のテレメトリ（`traceAction` / `setMetric`）・トーストの UX を変えない**。
- 既存のテスト:
  - Playwright: `tests/roomMachine.spec.ts`, `tests/gameService.spec.ts`, `tests/waitingReset.spec.ts` などが **落ちないこと**。
  - 余裕があれば、新規/変更箇所に Jest テストを足しても良い（ただし過剰に広げない）。

---

## 3. フェーズ1: ホストアクションの一本化 (HIGH)

### 3-1. 現状の問題

- ホスト操作の入口が分散:
  - `components/hooks/useHostActions.ts`（HostControlDock 用）  
  - `lib/hooks/useHostActions.ts`（MiniHandDock / in-game ホスト UI 用）
- それぞれが別々のルートで:
  - `GameService` / `topicControls` / `lib/game/quickStart.ts`
  - Cloud Functions `"quickStart"` (`httpsCallable`)
  - `resetRoomWithPrune` / `/api/rooms/[roomId]/reset`
  を呼んでおり、「どのボタンがどの API / Firestore 書き込みに対応しているか」が追いにくい。

### 3-2. ゴール

- 「**ホスト操作の IO（API / Functions / Firestore）を 1 ヶ所に集約**」したモジュールを作る。
- UI 側（MiniHandDock / HostControlDock / RoomView など）は、
  - このモジュールを通してのみクイックスタート／リセット／次ゲーム／並び確定を行う。
- 既存のテレメトリ（`traceAction("ui.host.*")` 等）・トースト表示は **振る舞いを変えない**。

### 3-3. 実装指示 (チェックリスト)

1. **新モジュールの作成**
   - ファイル案: `lib/host/HostActionsController.ts`（名前は多少変えてもよいが目的が分かるものに）
   - ここに以下のメソッドを定義する:
     - `quickStartWithTopic`  
       - 入力: `{ roomId, defaultTopicType, roomStatus?, presenceInfo?, intentMeta?, showtimeIntents? }`
       - 振る舞い:
         - 必要であれば Cloud Functions `"quickStart"` を呼び出す（現在 `lib/hooks/useHostActions.ts` が行っている形をベース）。
         - presence / playerCount チェックは内部で行い、`calculateEffectiveActive` を利用。
         - `traceAction("ui.host.quickStart")` / `"ui.host.quickStart.result"` をここから発火する。
     - `resetRoomToWaitingWithPrune`  
       - `resetRoomWithPrune` + `/api/rooms/[roomId]/reset` パスのラップ（現行 `lib/hooks/useHostActions.ts` のロジックをまとめる）。
     - `restartRound`  
       - `resetRoomToWaitingWithPrune` → `quickStartWithTopic` を組み合わせる再開処理。
     - `evaluateSortedOrder`  
       - `submitSortedOrder` + `beginRevealPending` をまとめる (`lib/hooks/useHostActions.ts` の `evalSorted` ベース)。
     - `submitCustomTopicAndStartIfNeeded`
       - カスタムお題＋即クイックスタートのパス（`handleSubmitCustom` 相当）を1箇所に。
   - これらのメソッドは **UI に依存しない**（`notify` / `AppButton` 等は触らない）。

2. **`lib/hooks/useHostActions.ts` の整理**
   - 目的: `"ゲーム内 MiniHandDock のホスト操作"` 専用 Hook にする。
   - 既存のロジックから以下を削る/移管する:
     - Cloud Functions 呼び出し / Firestore `getDoc` / `resetRoomWithPrune` 等の **IO 部分** → 新しい `HostActionsController` 経由に。
   - `useHostActions` の責務:
     - ボタン連打防止 (`quickStartPending` / `isResetting` 等の state 管理)
     - トースト表示（`notify`）とユーザー向けメッセージ
     - `showtimeIntents` 呼び出し
   - パブリック API（戻り値）は現状と互換にしておく:
     - `quickStart`, `resetGame`, `restartGame`, `handleNextGame`, `evalSorted`, カスタムトピック関連など。

3. **`components/hooks/useHostActions.ts` の整理**
   - 目的: HostControlDock（画面上部のホスト操作 UI）が同じ controller を使うようにする。
   - ここでは:
     - `buildHostActionModel`（純粋モデル）はそのまま利用。
     - 実際の「開始」「中断（リセット）」「並びを確定」ボタンの onClick で、新しい `HostActionsController` を呼び出す。
   - すでに `executeQuickStart` を使っているが、これも controller に置き換える。

4. **MiniHandDock / HostControlDock の呼び出し統一**
   - `components/ui/MiniHandDock.tsx` と `components/ui/HostControlDock.tsx` で、
     - `useHostActionsCore` / `useHostActions` のインポート先が **統一された API** を使うように修正。
   - `MiniHandDock` 内で行っている `topicControls.shuffleTopic` などは、必要に応じて controller に統合してもよいが、v1 では「クイックスタート/リセット/次ゲーム/並び確定」を優先する。

5. **テスト**
   - `npm run test -- tests/gameService.spec.ts`
   - `npx playwright test tests/roomMachine.spec.ts`
   - 可能であれば、ホスト操作まわりの E2E (`tests/host-transfer.spec.ts` 相当) も実行。

---

## 4. フェーズ2: `useRoomState` の責務分割 (HIGH)

### 4-1. 現状の問題

- `lib/hooks/useRoomState.ts` が以下すべてを抱えている:
  - Firestore `rooms/{roomId}` 購読（バックオフ / quota 対応）
  - `joinRoomFully` / `ensureMember` を使った入室・再入室ロジック（リトライ・バックオフ）
  - XState `roomMachine` actor の生成・ライフサイクル管理
  - 観戦 v2 (`spectatorSessions`) の購読・FSM イベント連携
  - Prefetch (`loadPrefetchedRoom` / `storePrefetchedRoom`) の適用
- その結果、**「入室まわりを直したいだけでも machine 周りまで読まないといけない」** 状態。

### 4-2. ゴール

- Firestore 購読＋join ロジックと、XState machine 管理を **別 Hook に分ける**。
- `app/rooms/[roomId]/page.tsx` から見た API は原則維持（`useRoomState` の戻り値の形は極力互換）。

### 4-3. 実装指示

1. **`useRoomSnapshot` の追加**
   - 新規ファイル案: `lib/hooks/useRoomSnapshot.ts`
   - 責務:
     - `room` ドキュメント購読＋バックオフ
     - `joinRoomFully` / `ensureMember` / `leaveRoom` などのサービス呼び出し
     - `prefetchedRoom` の適用
   - 戻り値例:
     ```ts
     type RoomSnapshotState = {
       room: (RoomDoc & { id: string }) | null;
       players: (PlayerDoc & { id: string })[];
       loading: boolean;
       roomAccessError: string | null;
       joinStatus: "idle" | "joining" | "retrying" | "joined";
       // 必要に応じて onlineUids / presenceReady などもここに含める
     };
     ```

2. **`useRoomMachineController` の追加**
   - 新規ファイル案: `lib/hooks/useRoomMachineController.ts`
   - 責務:
     - `createRoomMachine` / `createActor` を呼び、machine の actor を管理。
     - `sendRoomEvent` 関数の提供。
     - machine の snapshot から `phase`, `spectatorStatus`, `spectatorReason`, `spectatorRequestStatus` などを抽出。
     - `subscribeSpectatorRejoin` の注入。
   - 戻り値例:
     ```ts
     type RoomMachineState = {
       phase: RoomDoc["status"];
       spectatorStatus: SpectatorStatus;
       spectatorReason: SpectatorReason;
       spectatorRequestStatus: "idle" | "pending" | "accepted" | "rejected";
       spectatorRequestFailure: string | null;
       sendRoomEvent: (event: RoomMachineClientEvent) => void;
     };
     ```

3. **`useRoomState` の薄いラッパ化**
   - 既存の `useRoomState` を:
     - 内部で `useRoomSnapshot` と `useRoomMachineController` を呼ぶだけの Hook にする。
   - 既存の戻り値フィールドは極力そのまま維持する（`RoomPageContent` が壊れないように）。

4. **`app/rooms/[roomId]/page.tsx` の修正**
   - import 先は `useRoomState` のままでよいが、必要なら `useRoomSnapshot` / `useRoomMachineController` を別途読み込む構成にしてもよい。
   - React Hook の順序が変わらないよう注意する（`docs/SPECTATOR_ARCHITECTURE.md` の「Hook 順序リファクタリングメモ」を参照）。

5. **テスト**
   - `npx playwright test tests/roomMachine.spec.ts`
   - ルーム入室系の Playwright (`tests/spectatorFlow.spec.ts`, `tests/spectatorHostFlow.spec.ts` 等) を可能な範囲で実行。

---

## 5. フェーズ3: UI からの直接 Firestore 書き込みの整理 (HIGH)

### 5-1. 現状の直接書き込み例

- `app/rooms/[roomId]/page.tsx`
  - `updateDoc(meRef, { ready: false })` で `round` 変更時にプレイヤーの `ready` をリセット。
- `components/ui/MiniHandDock.tsx`
  - `getDoc(doc(db, "rooms", roomId))` で `options.defaultTopicType` を再取得し、トピックボタンの挙動に利用。
- `components/CentralCardBoard.tsx`
  - `finalizeReveal` を `lib/game/room` から直接呼んでいる（具体的な箇所は要確認）。

### 5-2. ゴール

- **UI レイヤーでは Firestore を直接触らない**方針に統一（例外があればコメントで明示）。
- 上記処理を service / controller に移し、UI はそれを呼ぶだけにする。

### 5-3. 実装指示

1. `ready:false` リセットのサービス化
   - 新規関数案: `lib/services/playerService.ts` に:
     ```ts
     export async function resetPlayerReadyOnRoundChange(roomId: string, uid: string, nextRound: number): Promise<void> { ... }
     ```
   - もしくは `lib/services/roomService.ts` に統合してもよい。
   - `app/rooms/[roomId]/page.tsx` では `updateDoc` ではなく、この関数を呼ぶように変更。

2. `defaultTopicType` 再取得の整理
   - 可能であれば:
     - `MiniHandDock` に渡される props に `defaultTopicType` を含める（`RoomPageContent` 側で `room.options?.defaultTopicType` を渡す）。
   - どうしても Firestore 再読み込みが必要な場合は:
     - `lib/services/topicService.ts`（新規）に
       `fetchDefaultTopicType(roomId)` を作り、UI からはそれを呼ぶ。

3. `finalizeReveal` の経路統一
   - `CentralCardBoard` から `finalizeReveal` を直接呼んでいる場合:
     - 代わりに `sendRoomEvent({ type: "REVEAL_DONE" })` を使い、実際の Firestore 更新は `roomMachine` → `GameService.finalizeReveal` に任せる。
   - これにより、結果確定の経路を FSM に一本化できる。

4. テスト
   - 関連する UI の挙動（ラウンド跨ぎ / トピックボタン / リザルト → 次ゲーム）を Playwright で軽く確認。

---

## 6. フェーズ4: ゲームルールと永続化の分離 (MID)

※ ここは余力があれば。大きめのリファクタなので、フェーズ1〜3完了後に着手。

### 6-1. 目的

- `lib/game/room.ts` / `lib/services/roomService.ts` に散らばる「席順・配札・proposal 正規化」ロジックを、
  - Firestore に依存しない **純粋関数群** として整理。
- 将来、Cloud Functions 側にロジックを移したり、新ゲームモードを追加する際に再利用しやすくする。

### 6-2. 指示（概要）

- 新規ファイル: `lib/game/domain.ts`（名前は任意）
  - 例: `selectDealTargetPlayers`, `buildDealPayload`, `normalizeProposal`, `deriveSeatHistory` 等を移す。
- 既存の `dealNumbers` / `addCardToProposal` / `addLateJoinerToDeal` / `continueAfterFail` などは:
  - **「Firestore から読み → domain 関数を適用 → 書き戻す」だけ**の関数に寄せる。
- 必要に応じて Jest テストを追加（`domain` はユニットテスト向き）。

---

## 7. フェーズ5: プレゼンス / ロビーの純粋関数化 (LOW)

### 7-1. 指示（概要）

- `lib/hooks/useParticipants.ts` と `lib/hooks/useLobbyCounts.ts` 内で使っている純粋ロジックを分離:
  - ヘルススコア・バックオフ (`VerificationHealth`) 更新ロジック
  - `stableOnlineUids` 計算 (`__missingSince` を使ったグレース期間)
- 新規ファイル案: `lib/presence/model.ts` に関数として切り出す。
- Hook 側ではそれらを呼び出すだけにし、ロジックを Jest でテスト可能にする。

---

## 8. テスト・確認フロー（共通）

- 変更ごとに最低限以下を確認する:
  - `npm run typecheck`
  - Playwright（少なくとも以下のどれか）
    - `npx playwright test tests/roomMachine.spec.ts`
    - `npx playwright test tests/gameService.spec.ts`
    - 観戦・ホスト操作系シナリオ (`tests/spectatorFlow.spec.ts` 等) を時間の許す範囲で。
- ラグや体感を触る変更の場合:
  - `NEXT_PUBLIC_DEBUG_METRICS=1` で DebugMetricsHUD を出し、
  - `LAG_PLAYBOOK.md` に書かれたメトリクス（`hostAction.quickStart.latencyMs` など）を確認。

---

## 9. 今後この指示書を更新する際のルール

- 新しいエージェントは:
  - 着手前に **どのフェーズ・どのタスクをやるか** を簡単に追記する（例: 「2025-11-20 AgentX: フェーズ1–3-3 を実装」）。
  - 完了したら `(DONE)` やチェックボックスを更新し、必要なら「注意点」「既知の制約」を箇条書きで残す。
- 大きな方針変更があった場合は、ドキュメント最上部に「v2」「v3」などと明示してから書き換える。

