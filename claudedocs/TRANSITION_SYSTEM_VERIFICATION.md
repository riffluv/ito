# 🎯 画面遷移システム検証・修正指示書

## 📋 **指示概要**

このプロジェクトの**画面遷移システム**がベストプラクティスで完全実装されているかを検証してください。
もし不完全な場合は、商用ゲーム品質のベストプラクティスに修正してください。

---

## 🎮 **プロジェクト背景**

- **プロジェクト**: Online ITO - ドラゴンクエスト風数字カードゲーム
- **技術スタック**: Next.js 14 + Firebase Firestore + Chakra UI v3 + GSAP
- **目標**: ブラウザゲーム感を排除し、商用ゲーム品質の遷移システム実現

---

## 🔍 **検証項目チェックリスト**

### **1. システム基盤の存在確認**

以下のファイルが存在し、正しく実装されているか確認：

- [ ] `C:\Users\hr-hm\Desktop\codex\hooks\usePageTransition.ts`
- [ ] `C:\Users\hr-hm\Desktop\codex\components\ui\TransitionProvider.tsx`
- [ ] `C:\Users\hr-hm\Desktop\codex\components\ui\DragonQuestLoading.tsx`
- [ ] `C:\Users\hr-hm\Desktop\codex\components\ui\PageTransition.tsx`

### **2. アプリ全体統合の確認**

- [ ] `ClientProviders.tsx` で `TransitionProvider` が全アプリをラップしているか
- [ ] Context APIが正しく設定され、`useTransition()`フックが動作するか
- [ ] エラーハンドリングが適切に実装されているか

### **3. GSAP アニメーションの品質確認**

- [ ] DragonQuestLoadingで物理的なイージング使用 (`back.out`, `power1.out`)
- [ ] 適切なクリーンアップ処理 (`gsap.killTweensOf`)
- [ ] スムーズな入場・退場アニメーション実装
- [ ] パフォーマンス最適化 (`reduced-motion` 対応)

### **4. 実際の使用箇所確認**

以下の場所で遷移システムが正しく使用されているか：

- [ ] **メインページ** (`app/page.tsx`) - ルーム参加時
- [ ] **CreateRoomModal** - ルーム作成時
- [ ] **Firebase操作** - 適切なローディングステップ定義

### **5. ベストプラクティス実装確認**

#### **5.1 ローディングシステム**
```tsx
// 期待される実装
await transition.navigateWithTransition(
  `/rooms/${roomId}`,
  {
    direction: "fade",
    duration: 1.2,
    showLoading: true,
    loadingSteps: [
      { id: "firebase", message: "せつぞく中です...", duration: 1500 },
      { id: "room", message: "ルーム情報取得中...", duration: 2000 },
      { id: "player", message: "プレイヤー登録中...", duration: 1800 },
      { id: "ready", message: "じゅんびが かんりょうしました！", duration: 1000 }
    ]
  },
  firebaseOperation // Firebase処理
);
```

#### **5.2 遷移タイミング**
- [ ] Firebase操作完了後、早期にページ遷移開始
- [ ] ローディング画面表示中に背景で遷移実行
- [ ] ローディング完了時は単純に画面非表示（既に遷移済み）

#### **5.3 プログレス管理**
- [ ] 各ステップ完了時にプログレス更新
- [ ] 最終的に `setProgress(100)` で確実に100%設定
- [ ] 無限アニメーション防止

---

## 🚨 **必須修正項目**

### **問題1: 無限アニメーション**
もし「じゅんびが かんりょうしました！」で止まる場合：

```tsx
// usePageTransition.ts の修正必須
for (let i = 0; i < loadingSteps.length; i++) {
  const step = loadingSteps[i];
  setCurrentStep(step.id);

  // ステップ間の待機時間
  await new Promise(resolve => setTimeout(resolve, step.duration));

  // ステップ完了時にプログレスを更新
  elapsedTime += step.duration;
  const progress = Math.min((elapsedTime / totalDuration) * 100, 100);
  setProgress(progress);
}

// 最終的に100%を確実に設定
setProgress(100);
```

### **問題2: メインメニュー経由問題**
もし一瞬メインメニューが表示される場合：

```tsx
// 修正: ローディング中に背景で遷移
setTimeout(() => {
  router.push(href);
}, 200);

// completeLoading は単純化
const completeLoading = useCallback(() => {
  setIsLoading(false);
}, []);
```

---

## 📊 **品質基準**

### **商用ゲーム品質の条件**
1. **スムーズな遷移**: カクつきやフリーズ感なし
2. **適切なフィードバック**: Firebase操作中のローディング表示
3. **物理的アニメーション**: GSAPによる自然な動き
4. **ドラクエ風統一感**: ひらがなメッセージ + 立体的UI
5. **エラー耐性**: 接続失敗時の適切なハンドリング

### **技術品質の条件**
1. **型安全**: TypeScript完全対応
2. **メモリ効率**: 適切なクリーンアップ処理
3. **アクセシビリティ**: reduced-motion対応
4. **パフォーマンス**: 60fps維持

---

## 🛠️ **修正作業指示**

### **Step 1: システム検証**
1. 上記チェックリストを全項目確認
2. 実際にルーム作成・参加で動作テスト
3. 問題箇所の特定

### **Step 2: 問題修正**
1. 発見された問題を優先度順に修正
2. ベストプラクティスに沿った実装に変更
3. GSAP アニメーションの品質向上

### **Step 3: 最終検証**
1. 全遷移パターンの動作確認
2. エラーケースの検証
3. パフォーマンス測定

---

## 🎯 **期待される結果**

修正完了後、以下が実現されること：

✅ **Firebase操作時の美しいローディング演出**
✅ **カクつきやフリーズ感の完全排除**
✅ **商用ゲーム品質のスムーズな遷移**
✅ **ドラクエ風の統一された世界観**
✅ **エラー時の適切な回復処理**

---

## 📝 **報告要求**

作業完了時に以下を報告してください：

1. **検証結果**: チェックリストの結果
2. **発見された問題**: 具体的な問題点
3. **実施した修正**: 修正内容の詳細
4. **動作確認**: 実際のテスト結果
5. **追加提案**: さらなる改善案があれば

---

**重要**: このシステムはプロジェクトの核となる体験品質を決定します。妥協のない商用品質を目指してください。
