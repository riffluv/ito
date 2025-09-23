# 🚨 CRITICAL FIXES REQUIRED - Online ITO プロジェクト

## 📋 **概要**

このドキュメントは、Online ITO プロジェクトで確認された**重要な潜在的問題**の修正指示書です。
実際にエミュレーター環境で「連想ワード提出不可バグ」が発生しており、緊急修正が必要です。

**⚠️ 重要**: コードの既存機能を破壊しないよう、テスト後に修正を適用してください。

---

## 🎯 **修正対象の問題一覧**

### **1. 🔴 CRITICAL: 連想ワード提出不可バグ**
- **影響度**: ゲーム進行完全停止
- **発生条件**: バッチ処理の部分失敗、同時更新競合
- **対象ファイル**: `lib/game/topicControls.ts`
- **症状**: リセットするまで連想ワードが提出できない

### **2. 🟡 HIGH: 評価システムの人数不整合**
- **影響度**: 評価ボタンが無効化され進行不可
- **発生条件**: presence情報とplayers情報の不一致
- **対象ファイル**: `lib/host/hostActionsModel.ts`

### **3. 🟡 MEDIUM: 退出処理の競合状態**
- **影響度**: 部屋にゴーストプレイヤーが残留
- **発生条件**: 同時退出、ネットワーク切断
- **対象ファイル**: `lib/firebase/rooms.ts`, `lib/server/roomActions.ts`

---

## 📝 **修正指示 - 詳細**

### **修正1: 連想ワード提出システムの堅牢化** 🔴

#### **対象ファイル**: `lib/game/topicControls.ts`

#### **問題箇所**:
```typescript
// 行139: バッチ処理が部分失敗する可能性
await batch.commit();
```

#### **修正内容**:
1. **エラー時のロールバック機構の追加**
2. **プレイヤー状態の検証・修復機能**
3. **失敗時の自動リトライ**

#### **実装要件**:
```typescript
// 修正後のイメージ
try {
  await batch.commit();
  // 成功確認
  await verifyPlayerStatesCleared(roomId);
} catch (error) {
  // ロールバック処理
  await emergencyResetPlayerStates(roomId);
  throw new Error("バッチ処理失敗: 緊急リセット実行");
}
```

---

### **修正2: 評価システムの人数算出統一** 🟡

#### **対象ファイル**: `lib/host/hostActionsModel.ts`

#### **問題箇所**:
```typescript
// 行55-56: presence と players の不整合
const effectiveActive = typeof _onlineCount === "number" ? _onlineCount : players.length;
```

#### **修正内容**:
1. **effectiveActive算出ロジックの共通化**
2. **不整合検出時の自動修復**
3. **フォールバック機構の強化**

#### **実装要件**:
```typescript
// 新規ユーティリティ関数の作成
function calculateEffectiveActive(
  onlineCount: number | undefined,
  playersCount: number,
  maxDrift: number = 2
): number {
  if (typeof onlineCount !== "number") return playersCount;

  // 大幅な不整合検出
  const drift = Math.abs(onlineCount - playersCount);
  if (drift > maxDrift) {
    console.warn("Presence/Players大幅不整合検出", { onlineCount, playersCount });
    return Math.max(onlineCount, playersCount); // 安全側に倒す
  }

  return onlineCount;
}
```

---

### **修正3: 退出処理の排他制御強化** 🟡

#### **対象ファイル**: `lib/firebase/rooms.ts` (行42-130)

#### **問題箇所**:
```typescript
// 複数の非同期処理が並行実行され競合する可能性
try { await forceDetachAll(...) } catch { }
try { await deleteDoc(...) } catch { }
await runTransaction(...)
```

#### **修正内容**:
1. **退出処理実行フラグの導入**
2. **重複実行防止機構**
3. **失敗時の状態復旧**

#### **実装要件**:
```typescript
// グローバル実行管理
const leavingUsers = new Set<string>();

export async function leaveRoom(roomId: string, userId: string, displayName: string | null | undefined) {
  const userKey = `${roomId}:${userId}`;

  // 重複実行防止
  if (leavingUsers.has(userKey)) {
    console.warn("退出処理重複実行をブロック", { roomId, userId });
    return;
  }

  leavingUsers.add(userKey);
  try {
    // 既存の退出処理
    // ...
  } finally {
    leavingUsers.delete(userKey);
  }
}
```

---

## 🧪 **テスト要件**

### **修正前テスト**:
1. **現在の動作確認**: エミュレーターで提出不可バグを再現
2. **既存機能テスト**: 正常な提出フローが動作することを確認

### **修正後テスト**:
1. **提出バグ修正確認**: 同じ条件で提出が成功することを確認
2. **競合状態テスト**: 複数プレイヤーの同時操作をテスト
3. **エッジケーステスト**: ネットワーク切断、同時退出等

### **テストシナリオ**:
```bash
# 1. 基本フロー
npm run dev
# → ルーム作成 → プレイヤー参加 → ゲーム開始 → 連想ワード提出

# 2. 競合テスト
# → 複数ブラウザで同時に連想ワード提出
# → ホストがお題変更中に他プレイヤーが提出

# 3. 障害テスト
# → ネットワーク切断中の提出
# → ブラウザ強制終了時の退出処理
```

---

## 📁 **追加作成が必要なファイル**

### **1. エラー復旧ユーティリティ**
- **ファイル名**: `lib/utils/emergencyRecovery.ts`
- **機能**: 状態不整合の検出と自動修復

### **2. 人数算出ユーティリティ**
- **ファイル名**: `lib/utils/playerCount.ts`
- **機能**: effectiveActive算出の統一化

### **3. 退出処理管理**
- **ファイル名**: `lib/utils/leaveManager.ts`
- **機能**: 重複実行防止とフラグ管理

---

## ✅ **修正完了の確認項目**

- [ ] 連想ワード提出バグが完全に修正されている
- [ ] 評価ボタンの無効化問題が解決されている
- [ ] 退出時のゴーストプレイヤー残留が防止されている
- [ ] 既存の正常動作が維持されている
- [ ] エラーログが適切に出力されている
- [ ] 本番環境でのテストが完了している

---

## 🚨 **緊急度と優先順位**

1. **🔴 最優先**: 連想ワード提出バグ（ゲーム進行停止）
2. **🟡 高優先**: 評価システム不整合（進行阻害）
3. **🟡 中優先**: 退出処理競合（残骸問題）

---

## 📞 **完了報告**

修正完了時は以下を報告してください：

1. **修正内容の要約**
2. **テスト結果**
3. **新規作成したファイル一覧**
4. **既存ファイルの変更箇所**

---

**⚠️ 注意**: このプロジェクトは**本番稼働中**のため、慎重な修正と十分なテストが必要です。