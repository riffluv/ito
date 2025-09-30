# 数字再配布バグ調査報告

## 調査日時
2025-09-30

## 問題の概要
1. **数字再配布が動かない**: 「ゲーム開始」後に「数字を配る」ボタンを押しても、新しい数字が配られない
2. **連続配布バグ**: 修正後、ゲーム開始時に数字が連続で配られ続ける

---

## 根本原因の特定

### 1. 数字再配布が動かない原因

**場所**: `app/rooms/[roomId]/page.tsx` 572-588行目

```typescript
useEffect(() => {
  if (!room || !uid || !me) return;
  if (typeof me.number === "number") return; // ★問題箇所
  if (room.status !== "clue") return;
  if (!room.deal || !room.deal.seed) return;
  if (!Array.isArray(room.deal.players) || !room.deal.players.includes(uid)) return;

  assignNumberIfNeeded(roomId, uid, room).catch(() => void 0);
}, [
  room?.status,
  room?.deal?.seed, // seedが変わっても...
  room?.deal?.players,
  uid,
  roomId,
  me?.id,
  me?.number,
]);
```

**問題点**:
- **574行目**: `if (typeof me.number === "number") return;`
- この条件により、**既に数字を持っているプレイヤーには何もしない**
- `room?.deal?.seed`が依存配列に含まれているが、`me.number`が既に存在する場合は早期リターン
- 結果: **seedが変わっても、数字を持っているプレイヤーには再配布されない**

**フロー**:
1. ゲーム開始 → `dealNumbers()` → `deal.seed`生成
2. クライアント → useEffect発火 → `assignNumberIfNeeded()` → `me.number`に数字設定
3. ホストが「数字を配る」ボタン押下 → `dealNumbers()` → **新しいseed生成**
4. クライアント → useEffect発火するが、**574行目でreturn**
5. `assignNumberIfNeeded()`が呼ばれない → 数字が更新されない

---

### 2. 連続配布バグの原因

**修正内容** (`lib/services/roomService.ts`):
```typescript
const currentSeed = me.assignedSeed || null;
if (me.number !== myNum || currentSeed !== deal.seed) {
  await updateDoc(doc(db!, "rooms", roomId, "players", uid), {
    number: myNum,
    assignedSeed: deal.seed, // 新規追加
    // ...
  });
}
```

**問題点**:
1. Firestoreの`players/{uid}`が更新される
2. `useRoomState`フックがリアルタイムでFirestoreを監視
3. `me`オブジェクトが更新される
4. **page.tsxのuseEffectの依存配列に`me?.number`が含まれている**
5. もし`me.number`の値が変わったら（nullから数字へ、または数字から別の数字へ）、useEffectが再実行される
6. ただし、**574行目の`if (typeof me.number === "number") return;`があるので、2回目以降は実行されないはず**

**では、なぜ連続配布が起きたのか？**

考えられる原因:
- `assignedSeed`フィールドの追加により、Firestoreのドキュメント全体が更新扱いになる
- `useRoomState`がドキュメント全体を再取得
- **`me`オブジェクトの参照が変わる**
- もし依存配列に`me`自体が含まれていたら、無限ループになる可能性

しかし、実際には`me?.number`しか依存配列にない。

**別の可能性**:
- `room?.deal?.seed`が依存配列にある
- `dealNumbers()`が複数回呼ばれている
- または、`assignNumberIfNeeded`内の条件`currentSeed !== deal.seed`が常にtrueになり、毎回更新が走る

---

## 安全な修正案

### 方針
**page.tsxのuseEffectの条件を修正する**ことで、seedが変わった時に再配布を許可する。

### 修正案1: useEffectの条件を変更

```typescript
// app/rooms/[roomId]/page.tsx 572-588行目
useEffect(() => {
  if (!room || !uid || !me) return;
  // ★条件を変更: numberがあってもseedが変わったら再実行
  if (room.status !== "clue") return;
  if (!room.deal || !room.deal.seed) return;
  if (!Array.isArray(room.deal.players) || !room.deal.players.includes(uid)) return;

  // seedが変わったかチェック
  const currentAssignedSeed = (me as any).assignedSeed || null;
  if (typeof me.number === "number" && currentAssignedSeed === room.deal.seed) {
    // 既に同じseedで割り当て済み → スキップ
    return;
  }

  assignNumberIfNeeded(roomId, uid, room).catch(() => void 0);
}, [
  room?.status,
  room?.deal?.seed,
  room?.deal?.players,
  uid,
  roomId,
  me?.id,
  me?.number,
  (me as any)?.assignedSeed, // ★追加
]);
```

**この修正の利点**:
- seedが変わった時に必ず`assignNumberIfNeeded`が呼ばれる
- `assignNumberIfNeeded`内の条件と一致
- 無限ループを防ぐ（`assignedSeed`が一致したらスキップ）

**懸念点**:
- `(me as any).assignedSeed`が依存配列にあるため、Firestoreの更新後に再度useEffectが発火する可能性
- しかし、上記の条件で`currentAssignedSeed === room.deal.seed`の時はスキップするので、1回だけ実行されるはず

---

### 修正案2: シンプルにassignNumberIfNeeded内で完結させる

**page.tsxの条件はそのままにして、`assignNumberIfNeeded`だけを修正**

```typescript
// lib/services/roomService.ts
if (room.status === "clue") {
  if (!Array.isArray(deal.players)) return;
  const idx = (deal.players as string[]).indexOf(uid);
  if (idx < 0) return;

  const { generateDeterministicNumbers } = await import("@/lib/game/random");
  const nums = generateDeterministicNumbers(
    deal.players.length,
    min,
    max,
    deal.seed
  );
  const myNum = nums[idx];

  // ★修正: numberが変わった、またはseedが変わったら更新
  const shouldUpdate = me.number !== myNum;

  if (shouldUpdate) {
    await updateDoc(doc(db!, "rooms", roomId, "players", uid), {
      number: myNum,
      clue1: me.clue1 || "",
      ready: false,
      orderIndex: 0,
    });
  }
}
```

**しかし、これでは元の問題が解決しない！**
- page.tsxの574行目で`typeof me.number === "number"`の時にreturnしているため、そもそも`assignNumberIfNeeded`が呼ばれない

---

### 修正案3: 最もシンプルで安全な方法

**page.tsxの条件を削除して、`assignNumberIfNeeded`内で全て制御**

```typescript
// app/rooms/[roomId]/page.tsx 572-588行目
useEffect(() => {
  if (!room || !uid || !me) return;
  if (room.status !== "clue") return;
  if (!room.deal || !room.deal.seed) return;
  if (!Array.isArray(room.deal.players) || !room.deal.players.includes(uid)) return;

  // ★574行目の条件を削除
  assignNumberIfNeeded(roomId, uid, room).catch(() => void 0);
}, [
  room?.status,
  room?.deal?.seed,
  room?.deal?.players,
  uid,
  roomId,
  me?.id,
]);
```

**`assignNumberIfNeeded`内で重複チェック**:
```typescript
// lib/services/roomService.ts
const myNum = nums[idx];

// 既に同じ数字が割り当てられている場合はスキップ
if (me.number === myNum) return;

await updateDoc(doc(db!, "rooms", roomId, "players", uid), {
  number: myNum,
  clue1: me.clue1 || "",
  ready: false,
  orderIndex: 0,
});
```

**利点**:
- page.tsxがシンプルになる
- `assignNumberIfNeeded`が毎回呼ばれるが、内部で重複チェック
- seedが変わったら必ず新しい数字が計算され、異なる場合のみ更新

**懸念点**:
- seedが変わっても、たまたま同じ数字が割り当てられる可能性がある
- その場合、数字が更新されない（ただし、seedが変わっているので実際には新しい配布）

---

## 推奨修正

**修正案3が最もシンプルで安全**

### 実装手順

#### 1. page.tsxを修正

```typescript
// app/rooms/[roomId]/page.tsx 572-588行目
useEffect(() => {
  if (!room || !uid || !me) return;
  // ★この行を削除
  // if (typeof me.number === "number") return;
  if (room.status !== "clue") return;
  if (!room.deal || !room.deal.seed) return;
  if (!Array.isArray(room.deal.players) || !room.deal.players.includes(uid)) return;

  assignNumberIfNeeded(roomId, uid, room).catch(() => void 0);
}, [
  room?.status,
  room?.deal?.seed,
  room?.deal?.players,
  uid,
  roomId,
  me?.id,
  // ★me?.numberを依存配列から削除（無限ループ防止）
]);
```

#### 2. roomService.tsはそのまま（元のコード）

```typescript
// lib/services/roomService.ts 284-291行目
const myNum = nums[idx];
if (me.number !== myNum) {
  await updateDoc(doc(db!, "rooms", roomId, "players", uid), {
    number: myNum,
    clue1: me.clue1 || "",
    ready: false,
    orderIndex: 0,
  });
}
```

### この修正の動作

1. **ゲーム開始時**:
   - `dealNumbers()` → `deal.seed`生成
   - useEffect発火 → `assignNumberIfNeeded()` → `me.number`設定

2. **数字再配布時**:
   - `dealNumbers()` → **新しいseed**生成
   - `room?.deal?.seed`が変わる → useEffect発火
   - `assignNumberIfNeeded()` → 新しい数字を計算
   - `me.number !== myNum`なら更新

3. **無限ループ防止**:
   - 依存配列から`me?.number`を削除
   - `assignNumberIfNeeded`内で`me.number !== myNum`チェック
   - 同じ数字なら更新しない → Firestoreが変わらない → useEffectが再発火しない

---

## テストケース

### 1. 通常のゲーム開始
- [ ] ゲーム開始ボタンを押す
- [ ] 数字が配られる
- [ ] 各プレイヤーに異なる数字が割り当てられる

### 2. 数字の再配布
- [ ] ゲーム開始後、「数字を配る」ボタンを押す
- [ ] 新しい数字が配られる
- [ ] 古い数字とは異なる数字になる（高確率）

### 3. 複数プレイヤー
- [ ] 2人以上でゲーム開始
- [ ] 全員に数字が配られる
- [ ] 再配布時、全員の数字が変わる

### 4. エッジケース
- [ ] 数字が同じになった場合でも更新されない（Firestore書き込み削減）
- [ ] オフラインプレイヤーには配られない
- [ ] 途中参加プレイヤーにも配られる

---

## まとめ

- **原因**: page.tsxの574行目で`typeof me.number === "number"`の時にreturnしていたため、再配布時に`assignNumberIfNeeded`が呼ばれなかった
- **連続配布バグ**: 修正案で`assignedSeed`を追加したことで、Firestoreの更新ループが発生した可能性
- **推奨修正**: page.tsxの条件を削除し、`assignNumberIfNeeded`内で重複チェック
- **副作用**: なし（既存の動作を維持しつつ、再配布を可能にする）
