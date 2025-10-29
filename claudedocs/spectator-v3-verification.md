# Spectator Mode V3 実装検証指示書

このドキュメントは、Codex（Coding Agent）が観戦モードV3の実装を検証するための指示書です。

---

## 検証の目的

**最初の依頼（`お願い.md`）の内容が正しく実装されているか、かつ旧観戦モードのコードが綺麗に削除されているかを確認してください。**

---

## 📋 検証チェックリスト

### 1. データモデル（型定義）✅

**確認箇所**: `lib/types.ts`

- [ ] `RoomDoc.ui.recallOpen?: boolean` が追加されている
- [ ] コメントで「観戦者の入席許可フラグ」と説明されている
- [ ] 旧フラグ `spectatorRecall` や `spectatorRecallAt` への参照が**ない**こと

**期待される実装**:
```typescript
ui?: {
  /**
   * 観戦者の入席許可フラグ (Spectator V3)
   * true: リセット後の waiting 状態のみ（観戦者が「席に戻る」を許可）
   * false: ゲーム中・次ゲーム準備中など（観戦者の入席を拒否）
   */
  recallOpen?: boolean;
};
```

---

### 2. サーバ側ゲート（入席制御）✅

**確認箇所**: `lib/services/roomService.ts` の `ensureMember` 関数（108行目付近）

- [ ] `room.ui.recallOpen` をチェックしている
- [ ] `status !== "waiting"` で入席拒否
- [ ] `status === "waiting" && recallOpen === false` で入席拒否
- [ ] `traceAction("join.blocked", ...)` でトレースしている
- [ ] V3フラグチェック（`NEXT_PUBLIC_SPECTATOR_V3`）が**ない**こと

**期待される実装**:
```typescript
const recallOpen = room?.ui?.recallOpen ?? false;

// ゲーム進行中は入席拒否（ホスト以外）
if (!isHost && status && status !== "waiting") {
  traceAction("join.blocked", { roomId, uid, status, reason: "inProgress" });
  return { joined: false, reason: "inProgress" } as const;
}

// waiting でも recallOpen=false なら入席拒否（ホスト以外）
if (!isHost && status === "waiting" && !recallOpen) {
  traceAction("join.blocked", { roomId, uid, status, recallOpen });
  return { joined: false, reason: "inProgress" } as const;
}
```

---

### 3. Host操作での制御✅

#### 3-1. ゲーム開始時

**確認箇所**: `lib/game/room.ts` の `startGame` 関数（80行目付近）

- [ ] `updateDoc` で `"ui.recallOpen": false` をセットしている
- [ ] V3フラグチェックが**ない**こと（直接セット）

**期待される実装**:
```typescript
await updateDoc(ref, {
  status: "clue",
  result: null,
  deal: null,
  order: null,
  mvpVotes: {},
  lastActiveAt: serverTimestamp(),
  "ui.recallOpen": false,
});
```

#### 3-2. リセット時

**確認箇所**: `lib/firebase/rooms.ts` の `resetRoomWithPrune` 関数（318行目付近）

- [ ] `tx.update` で `"ui.recallOpen": opts?.recallSpectators === true` をセットしている
- [ ] V3フラグチェックが**ない**こと
- [ ] 旧実装の `ui.spectatorRecall`, `ui.spectatorRecallAt` への参照が**ない**こと

**期待される実装**:
```typescript
tx.update(roomRef, {
  status: "waiting",
  result: null,
  deal: null,
  order: null,
  round: 0,
  topic: null,
  topicOptions: null,
  topicBox: null,
  closedAt: null,
  expiresAt: null,
  "ui.recallOpen": opts?.recallSpectators === true,
});
```

---

### 4. クライアント側の観戦判定（V3ロジック）✅

**確認箇所**: `app/rooms/[roomId]/page.tsx` （1250行目付近）

- [ ] 観戦判定がシンプルになっている（`!isMember && !isHost` のみ）
- [ ] `shouldShowSpectator` が2行以内で定義されている
- [ ] 以下の複雑な変数・ロジックが**削除されている**こと：
  - `spectatorEligibilityReady`
  - `spectatorDelayRef`
  - `spectatorImmediate`
  - `spectatorDelayReady`
  - `SPECTATOR_ACTIVATION_DELAY_MS`
  - タイマー処理のuseEffect

**期待される実装**:
```typescript
// Spectator V3: シンプルな観戦判定
const shouldShowSpectator =
  uid !== null && !isMember && !isHost && presenceReady && !loading;
const isSpectatorMode = shouldShowSpectator;
```

---

### 5. 席に戻るのガード✅

**確認箇所**: `lib/game/service.ts` の `requestSeat` 関数（220行目付近）

- [ ] `room.ui.recallOpen` をチェックしている
- [ ] `status !== "waiting" || !recallOpen` でエラーを投げている
- [ ] `traceAction("spectator.requestSeat.blocked", ...)` でトレースしている
- [ ] V3フラグチェックが**ない**こと

**期待される実装**:
```typescript
// Spectator V3: recallOpen チェック
const roomRef = doc(db!, "rooms", roomId);
const roomSnap = await getDoc(roomRef);
if (!roomSnap.exists()) {
  throw new Error("部屋が見つかりません");
}
const room: any = roomSnap.data();
const recallOpen = room?.ui?.recallOpen ?? false;
const status = room?.status;

if (status !== "waiting" || !recallOpen) {
  traceAction("spectator.requestSeat.blocked", { roomId, uid, status, recallOpen });
  throw new Error("現在は席に戻ることができません");
}
```

---

### 6. 観戦遷移時のトレースと状態初期化✅

**確認箇所**: `app/rooms/[roomId]/page.tsx` （1288行目付近の useEffect）

- [ ] `traceAction("spectator.enter", ...)` が呼ばれている
- [ ] `optimisticMe` がクリアされている
- [ ] `seatRequestState` がリセットされている
- [ ] V3フラグチェックが**ない**こと

**期待される実装**:
```typescript
if (isSpectatorMode && uid) {
  traceAction("spectator.enter", {
    roomId,
    uid,
    reason: versionMismatchBlocksAccess
      ? "version-mismatch"
      : room?.status === "waiting"
      ? "waiting"
      : "mid-game",
  });

  // 観戦遷移時の状態初期化を厳密化
  if (optimisticMe) {
    setOptimisticMe(null);
  }
  if (seatRequestState.status !== "idle") {
    setSeatRequestState({
      status: "idle",
      source: null,
      requestedAt: null,
      error: null,
    });
  }
}
```

---

### 7. 既存の空きスロット修正が維持されている✅

**確認箇所**:
- `lib/game/selectors.ts` （112行目付近）
- `app/rooms/[roomId]/page.tsx` （2549行目付近の呼び出し）

- [ ] `playerIds` フィルタが**変更されていない**
- [ ] 観戦者を除外するロジックが**そのまま維持**されている

---

## 🗑️ 旧観戦モードコードの削除確認

### 削除されているべきもの

**確認箇所**: `app/rooms/[roomId]/page.tsx`

- [ ] ❌ `SPECTATOR_ACTIVATION_DELAY_MS` 定数
- [ ] ❌ `recallV2Enabled` 変数とその参照
- [ ] ❌ `rejoinSessionKey` 変数とその参照
- [ ] ❌ `sessionStorage.setItem/getItem/removeItem` の呼び出し
- [ ] ❌ `spectatorEligibilityReady` 変数
- [ ] ❌ `spectatorDelayRef` 変数
- [ ] ❌ `spectatorImmediate` 変数
- [ ] ❌ `spectatorDelayReady` 状態
- [ ] ❌ タイマー処理のuseEffect（遅延表示）
- [ ] ❌ 複雑な `canAccess` 計算（シンプル版のみ残る）

**確認箇所**: 環境変数ファイル

- [ ] ❌ `.env.local` に `NEXT_PUBLIC_SPECTATOR_V3=1` が**ない**こと
- [ ] ❌ `.env.local` に `NEXT_PUBLIC_RECALL_V2=1` が**ない**こと
- [ ] ❌ `types/env.d.ts` に `NEXT_PUBLIC_SPECTATOR_V3` が**ない**こと

**確認箇所**: サーバ側

- [ ] ❌ `lib/services/roomService.ts` にV3フラグチェックが**ない**こと
- [ ] ❌ `lib/firebase/rooms.ts` に `ui.spectatorRecall`, `ui.spectatorRecallAt` への参照が**ない**こと
- [ ] ❌ `lib/game/room.ts` にV3フラグチェックが**ない**こと
- [ ] ❌ `lib/game/service.ts` にV3フラグチェックが**ない**こと

---

## ✅ ビルド・動作確認

### ビルドチェック

```bash
npm run typecheck
npm run build
```

- [ ] 型チェックがエラーなく通る
- [ ] ビルドが成功する

### 動作確認（ローカル）

```bash
npm run dev
```

#### 観戦UIの表示
- [ ] mid-gameに入室 → 観戦UIが安定表示される（チラつかない）
- [ ] 退出→再入室（3回）→ 毎回観戦UIが表示される

#### 席に戻るボタン
- [ ] mid-game時: ボタンが disabled
- [ ] waiting（次のゲーム準備中）: ボタンが disabled
- [ ] waiting（リセット後）: ボタンが active になり、クリックで申請できる

#### 空きスロット
- [ ] プレイヤー数と一致（観戦者で増えない）

---

## 📊 検証結果レポート

検証完了後、以下の形式でレポートを作成してください：

```markdown
# Spectator Mode V3 検証結果

## 実装状況
- [ ] データモデル: ✅/❌
- [ ] サーバ側ゲート: ✅/❌
- [ ] Host操作: ✅/❌
- [ ] クライアント観戦判定: ✅/❌
- [ ] 席に戻るガード: ✅/❌
- [ ] トレース・初期化: ✅/❌
- [ ] 空きスロット維持: ✅/❌

## 旧コード削除状況
- [ ] sessionStorage削除: ✅/❌
- [ ] 複雑な判定削除: ✅/❌
- [ ] フラグ削除: ✅/❌
- [ ] タイマー削除: ✅/❌

## ビルド・動作確認
- [ ] 型チェック: ✅/❌
- [ ] ビルド: ✅/❌
- [ ] 観戦UI安定性: ✅/❌
- [ ] 席に戻る動作: ✅/❌

## 問題点（あれば）
（記述）

## 総合評価
✅ 完全実装 / ⚠️ 一部問題あり / ❌ 未実装
```

---

## 📝 注意事項

1. **ゲームロジックへの影響確認**
   - カード提出・判定・スコア計算が変更されていないこと
   - `lib/game/` 配下の主要ファイルが影響を受けていないこと

2. **既存機能の維持**
   - 空きスロット修正（`lib/game/selectors.ts:112`）が変更されていないこと
   - プレイヤーのゲーム進行に影響がないこと

3. **クリーンなコード**
   - デッドコード（到達不能なコード）が残っていないこと
   - 未使用の変数・定数が残っていないこと
   - コメントアウトされたコードが残っていないこと

---

## 🎯 検証の流れ

1. このチェックリストに従って、各項目を順番に確認
2. 問題を発見したら、該当箇所と期待される実装を記録
3. ビルド・動作確認を実施
4. 検証結果レポートを作成
5. 問題がなければ ✅ 完全実装と判定

---

**以上で検証は完了です。お疲れ様でした！**
