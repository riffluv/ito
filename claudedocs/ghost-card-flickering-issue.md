# ゴーストカード点滅問題 - 修正指示書

## 🐛 問題の概要

**症状**: 待機エリア（WaitingArea）のカードを空きスロット以外の位置にドラッグすると、元の位置にゴーストカード（残像）が点滅表示される

**発生条件**:
- 待機エリアからカードをドラッグ
- 空きスロット以外の無効な位置（例: スロットエリアの外側）にドラッグ
- ドラッグ中のカードは少し透明になり、元の位置にゴーストカードが高速で点滅

**影響度**:
- ゲームプレイには支障なし（空きスロットに直接ドラッグすれば問題ない）
- 視覚的な違和感あり

## ⚠️ 重要な制約事項

### 過去の失敗例
前回、以下のアプローチで修正を試みたが、**重大なバグを引き起こした**:

```typescript
// ❌ この方法は useLobbyCounts.ts でエラーを引き起こす
// ReferenceError: queuedUpdates is not defined at useLobbyCounts.ts:811:38

// WaitingAreaCard.tsx に activeId prop を追加
interface WaitingAreaCardProps {
  player: PlayerDoc & { id: string };
  isDraggingEnabled?: boolean;
  meId?: string;
  optimisticReset?: boolean;
  activeId?: string | null; // ❌ これを追加すると問題発生
}

// React.memo でラップ
export default React.memo(WaitingAreaCard); // ❌ これも問題を引き起こす

// display: "none" を使用
const style: React.CSSProperties = isBeingDragged
  ? { display: "none" } // ❌ これも効果なし
  : { ... };
```

**この修正は git reset で完全に取り消されました。**

### 安全な現状
- `CentralCardBoard.tsx` の親Box に `width="100%"` を追加（ドロップゾーン幅問題の解決）
- この修正はコミット済みで正常動作中
- **ゴーストカード問題の修正は一切適用されていない**

## 🔍 技術的な分析

### 関連ファイル
1. **`components/ui/WaitingAreaCard.tsx`** (Lines 1-68)
   - 個別の待機カードコンポーネント
   - `useDraggable` フックを使用
   - ドラッグ中は `opacity: 0` で非表示にしている（Line 37）

2. **`components/CentralCardBoard.tsx`**
   - `DndContext` を管理
   - `DragOverlay` でドラッグ中のカードを表示
   - `handleDragEnd` で無効なドロップ処理（Lines 412-418）

### 現在の実装（WaitingAreaCard.tsx）

```typescript
// Lines 34-47: ドラッグ中のスタイル
const style: React.CSSProperties = isDragging
  ? {
      // DragOverlay を使うため、元要素は動かさず不可視にする
      opacity: 0,              // ← ゴーストが見える原因？
      pointerEvents: "none",
      cursor: "grabbing",
      transition: "none",
    }
  : {
      // 非ドラッグ時は通常の見た目
      cursor:
        isDraggingEnabled && ready && meId === player.id ? "grab" : "default",
      transition: "transform 0.2s ease",
    };
```

### DragOverlay の仕組み（CentralCardBoard.tsx）

```typescript
// Lines 562-582: DragOverlay
<DragOverlay dropAnimation={null} style={{ zIndex: 9999 }}>
  {activeId && draggingPlayer ? (
    <GameCard
      index={null}
      name={draggingPlayer.name || ""}
      clue={draggingPlayer.clue1 || ""}
      number={null}
      state={draggingPlayer.clue1 ? "ready" : "default"}
      waitingInCentral={true}
    />
  ) : null}
</DragOverlay>
```

## 💡 推奨される調査アプローチ

### 1. @dnd-kit のベストプラクティス確認
- `DragOverlay` 使用時の元要素の隠し方
- `opacity: 0` vs `visibility: "hidden"` vs `transform: "scale(0)"`
- 他の実装例を参照

### 2. レンダリングサイクルの調査
- なぜ `opacity: 0` でも点滅するのか
- React の再レンダリングタイミング
- `isDragging` フラグの更新頻度

### 3. CSS のみでの解決を検討
```css
/* 可能性のある解決策 */
[data-dragging="true"] {
  position: absolute;
  top: -9999px;
  left: -9999px;
  /* または */
  clip-path: circle(0);
  /* または */
  transform: scale(0);
}
```

### 4. 条件付きレンダリングの検討
```typescript
// activeId をコンポーネント全体で管理
{!isDragging && (
  <Box ref={setNodeRef} {...}>
    <GameCard ... />
  </Box>
)}
```

## 📋 実装チェックリスト

修正を行う際は、以下を必ず確認してください:

- [ ] `useLobbyCounts.ts` でエラーが発生しないか
- [ ] ルーム作成時にホストになれるか
- [ ] ドラッグ&ドロップの基本動作に影響がないか
- [ ] 待機エリアのドロップゾーン幅が維持されているか
- [ ] 他のコンポーネントで予期しない再レンダリングが発生しないか
- [ ] `git status` で意図しないファイル変更がないか

## 🚀 段階的な実装手順

### Step 1: 現状の動作確認
```bash
# 現在のブランチとステータス確認
git status
git branch

# 問題を再現
# 1. ゲーム開始
# 2. 待機エリアからカードをドラッグ
# 3. 空きスロット外にドロップ
# 4. ゴーストカードの点滅を確認
```

### Step 2: CSS のみでの修正を試す
```typescript
// WaitingAreaCard.tsx
const style: React.CSSProperties = isDragging
  ? {
      visibility: "hidden", // opacity の代わりに visibility を試す
      pointerEvents: "none",
      cursor: "grabbing",
      transition: "none",
    }
  : { ... };
```

### Step 3: テスト
- [ ] ゴーストカードが消えるか
- [ ] DragOverlay は正常に表示されるか
- [ ] ルーム作成・ホスト機能は正常か

### Step 4: 失敗した場合、transform を試す
```typescript
const style: React.CSSProperties = isDragging
  ? {
      transform: "scale(0)", // または translateY(-9999px)
      pointerEvents: "none",
      transition: "none",
    }
  : { ... };
```

### Step 5: それでも失敗した場合、条件付きレンダリング
```typescript
// ⚠️ 慎重に: これは activeId prop が必要になる可能性がある
{!isDragging && (
  <GameCard ... />
)}
```

## 📝 報告フォーマット

修正後は以下の情報を報告してください:

### 成功した場合
- 使用した解決策（CSS プロパティまたはロジック変更）
- 変更したファイルと行番号
- テスト結果（ゴーストカード消失、機能正常性）

### 失敗した場合
- 試した方法
- 発生したエラー（あれば）
- エラーが発生したファイルと行番号
- 次に試すべきアプローチの提案

## 🔗 参考リソース

- [@dnd-kit 公式ドキュメント](https://docs.dndkit.com/)
- [DragOverlay API](https://docs.dndkit.com/api-documentation/draggable/drag-overlay)
- [CSS 非表示手法の比較](https://developer.mozilla.org/en-US/docs/Web/CSS/visibility)

---

**最終更新**: 2025-10-02
**作成者**: Claude 4.5
**優先度**: 中（視覚的な問題だが、ゲームプレイには支障なし）
