# 🏗️ CSS設計 徹底分析レポート (2025-10-02)

## 📋 実行サマリー

**調査日時**: 2025-10-02
**調査範囲**: プロジェクト全体のCSS/スタイル実装
**目的**: Chakra UI v3ベストプラクティス準拠チェック + 黒いフィルター問題の根本原因特定

---

## ✅ 良好な点

### 1. **最新のCSS Layers アーキテクチャ採用**

`app/globals.css` で **CSS Cascade Layers** を正しく実装：

```css
@layer reset, tokens, base, dpi-responsive, utilities;
```

**評価**: ✅ Chakra UI v3 + 2025年のベストプラクティスに完全準拠

**理由**:
- スタイルの優先順位が明確
- メンテナンス性が高い
- 詳細度の競合を回避

### 2. **テーマシステムの階層構造が正しい**

```
theme/
├── index.ts (createSystem)
├── premiumGameTheme.ts (tokens + semanticTokens)
├── layout.ts (UI_TOKENS)
└── recipes/ (button.recipe.ts, card.recipe.ts)
```

**評価**: ✅ Tokens → Semantic Tokens → Recipes の3層構造を実現

### 3. **DPI対応が体系的**

```css
/* 125% DPI */
@media (resolution >= 1.25dppx)

/* 150% DPI */
@media (resolution >= 1.5dppx)
```

**評価**: ✅ Windows標準スケーリング + 高DPI環境に完全対応

---

## ⚠️ 改善が必要な点

### 1. **`bg="transparent"` の大量重複 (14箇所)**

#### 発見箇所:
- `GameCard.tsx`: 3箇所
- `WaitingArea.tsx`: 2箇所
- `WaitingAreaCard.tsx`: 1箇所
- `GameLayout.tsx`: 2箇所
- `MiniHandDock.tsx`: 2箇所
- その他: 4箇所

#### 問題:
- **重複コードによる保守性低下**
- **パフォーマンス**: 同じスタイルが何度も生成される
- **CSS詳細度の混乱**: propsとcss propの混在

#### 推奨解決策:

**A. Chakra Factory + Recipe パターン**

```typescript
// theme/recipes/transparent-container.recipe.ts
export const transparentContainerRecipe = defineRecipe({
  className: "transparent-container",
  base: {
    bg: "transparent",
  },
});
```

```tsx
// 使用例
<Box recipe="transparentContainer">
```

**B. Semantic Token化**

```typescript
// theme/premiumGameTheme.ts
semanticTokens: {
  colors: {
    containerBg: { value: "transparent" }, // 👈 追加
  }
}
```

```tsx
// 使用例
<Box bg="containerBg">
```

**推奨**: **B案 (Semantic Token化)** - より意味的で拡張性が高い

---

### 2. **`css={{}}` と `style={{}}` の混在 (95箇所)**

#### 統計:
- `css={{}}` prop: 74箇所 ✅ (Chakra UI v3推奨)
- `style={{}}` inline: 21箇所 ⚠️ (React標準だが非推奨)

#### 問題:
- **パフォーマンス**: `style={{}}` は毎レンダリングで新しいオブジェクト生成
- **一貫性**: スタイリング手法が統一されていない
- **テーマ非対応**: `style` はChakra tokensにアクセスできない

#### 推奨解決策:

**全ての `style={{}}` を `css={{}}` または Chakra props に移行**

```tsx
// ❌ 悪い例
<Box style={{ background: "transparent" }}>

// ✅ 良い例 (Option 1: Chakra prop)
<Box bg="transparent">

// ✅ 良い例 (Option 2: css prop)
<Box css={{ background: "transparent" }}>
```

**優先順位**:
1. **Chakra prop** (最速・最もシンプル)
2. **css prop** (複雑なスタイルや擬似セレクタが必要な場合)
3. **style prop** (動的な値でやむを得ない場合のみ)

---

### 3. **CSS Modules の限定的な使用 (2箇所のみ)**

#### 発見箇所:
- `GameCard.module.css` (cardMetaクラスのみ)

#### 問題:
- **統一性の欠如**: ほぼ全てがCSS-in-JSなのに、1ファイルだけCSS Modules
- **必要性が不明確**: `.cardMeta` は普通にChakra propsで実現可能

#### 推奨解決策:

**CSS Modules を完全に廃止し、全てChakra UI v3のスタイルシステムに統一**

```tsx
// Before (CSS Modules)
import styles from "./GameCard.module.css";
<span className={styles.cardMeta}>

// After (Chakra Text Style)
<Text textStyle="caption" fontWeight={700}>
```

---

### 4. **黒いフィルター問題の根本原因**

#### 調査結果:

**原因**: `<body>` タグの背景色 `rgb(14, 15, 19)` が、透明な要素の隙間(gap)から見えている

**検証コマンド実行結果**:
```javascript
// WaitingArea の親要素を遡った結果
Found black background: <body style="overflow: hidden;">
background: rgb(14, 15, 19)
```

**問題の構造**:
```
<body bg="canvasBg"> // rgb(14, 15, 19)
  └─ <WaitingArea>
       └─ <Box gap="16px" bg="transparent">  // 👈 gap の隙間から body が見える
            ├─ <WaitingAreaCard bg="transparent">
            ├─ <WaitingAreaCard bg="transparent">
            └─ <WaitingAreaCard bg="transparent">
```

#### 推奨解決策:

**Option A: WaitingArea に明示的な背景色を設定**

```tsx
// WaitingArea.tsx
<Box
  bg="bgCanvas" // 👈 body と同じ色を指定
  gap={UNIFIED_LAYOUT.SPACING.CARD_GAP}
>
```

**Option B: gap を使わず、カード間の余白をカード側で管理**

```tsx
// カード自体に margin を持たせる
<WaitingAreaCard mr={UNIFIED_LAYOUT.SPACING.CARD_GAP}>
```

**Option C: CSS Grid で gap の代わりに explicit placement**

```tsx
<Box
  display="grid"
  gridTemplateColumns="repeat(auto-fit, minmax(100px, 1fr))"
  // gap を使わない
>
```

**推奨**: **Option A** - 最もシンプルで影響範囲が小さい

---

## 🔍 パフォーマンスボトルネック分析

### 1. **過剰な `useMemo` / `useCallback` (要確認)**

```tsx
// GameCard.tsx
export default memo(GameCard, (prev, next) => {
  // 12個のプロパティを個別比較
  if (prev.index !== next.index) return false;
  if (prev.name !== next.name) return false;
  // ... 10行続く
});
```

**問題**: カスタム比較関数は逆にパフォーマンス悪化の可能性

**推奨**: React.memo のデフォルト shallow comparison に任せる（ほとんどの場合で十分）

### 2. **GSAP の初期化が毎レンダリング**

```tsx
// GameCard.tsx L137-148
useLayoutEffect(() => {
  const el = threeDContainerRef.current;
  if (!el) return;
  if (!gsapInitialisedRef.current) {
    gsap.set(el, { /* 初期化 */ });
    gsapInitialisedRef.current = true;
    return;
  }
  // ...
}, [flipped, isResultPreset, playCardSlide]); // 👈 依存配列が多い
```

**問題**: `flipped` が変わるたびに useLayoutEffect 実行 → パフォーマンス低下

**推奨**: 初期化用と更新用を分離

```tsx
// 初期化 (マウント時のみ)
useLayoutEffect(() => {
  if (!threeDContainerRef.current) return;
  gsap.set(threeDContainerRef.current, { /* 初期化 */ });
}, []); // 👈 空依存配列

// 更新 (flipped変更時のみ)
useLayoutEffect(() => {
  if (!threeDContainerRef.current) return;
  gsap.to(threeDContainerRef.current, { /* アニメーション */ });
}, [flipped]);
```

---

## 📈 CSS設計スコアカード

| 項目 | スコア | 評価 |
|------|--------|------|
| **アーキテクチャ** | 9/10 | ✅ CSS Layers, 階層構造完璧 |
| **一貫性** | 6/10 | ⚠️ style/css混在, CSS Modules孤立 |
| **パフォーマンス** | 7/10 | ⚠️ 重複スタイル, 過剰memo |
| **保守性** | 7/10 | ⚠️ 14箇所のtransparent重複 |
| **拡張性** | 8/10 | ✅ Tokens/Recipes で拡張可能 |
| **ベストプラクティス準拠** | 8/10 | ✅ Chakra v3 推奨パターン使用 |

**総合スコア**: **45/60 (75%)** → **B評価**

---

## 🎯 優先度別アクションプラン

### 🔴 優先度 HIGH (即座に対応)

1. **黒いフィルター問題の解決**
   - `WaitingArea` に `bg="bgCanvas"` を追加
   - 推定工数: 5分

2. **`bg="transparent"` の重複削除**
   - Semantic Token `containerBg: transparent` を追加
   - 全14箇所を `bg="containerBg"` に統一
   - 推定工数: 30分

### 🟡 優先度 MEDIUM (近日中に対応)

3. **`style={{}}` → `css={{}}` 移行**
   - 全21箇所を順次移行
   - 推定工数: 2時間

4. **CSS Modules の廃止**
   - `GameCard.module.css` を削除
   - `.cardMeta` を Text Style に移行
   - 推定工数: 30分

### 🟢 優先度 LOW (リファクタリング時に対応)

5. **GSAP 初期化の最適化**
   - useLayoutEffect を分離
   - 推定工数: 1時間

6. **React.memo カスタム比較関数の見直し**
   - デフォルト比較に変更してベンチマーク
   - 推定工数: 1時間

---

## 📚 参考資料

### Chakra UI v3 公式ドキュメント
- [Styling Overview](https://chakra-ui.com/docs/styling/overview)
- [Recipes](https://chakra-ui.com/docs/theming/recipes)
- [Migration Guide](https://www.chakra-ui.com/docs/get-started/migration)

### CSS Layers (2025年標準)
- [MDN: @layer](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer)
- [CSS Cascade Layers Best Practices](https://web.dev/css-cascade-layers/)

### パフォーマンス
- [React.memo Performance](https://react.dev/reference/react/memo)
- [GSAP Performance Tips](https://gsap.com/docs/v3/GSAP/gsap.set())

---

## 🎬 結論

**現状のCSS設計は75%の水準で良好**だが、以下の改善で **90%以上 (A評価)** を目指せます：

1. ✅ CSS Layers による最新アーキテクチャ採用済み
2. ⚠️ スタイル実装の一貫性向上が必要 (style/css混在解消)
3. ⚠️ 重複コード削減でパフォーマンス向上
4. ⚠️ 黒いフィルター問題は簡単に解決可能

**次のステップ**: 優先度HIGHの2項目を実装 → ユーザーに確認してもらう

---

**作成者**: Claude Code
**最終更新**: 2025-10-02
