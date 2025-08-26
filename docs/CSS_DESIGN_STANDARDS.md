# 📐 CSS設計標準 - ITO プロジェクト

## 🎯 目的

この文書は、agentが一貫性のある、予測可能で、保守しやすいCSSを生成するための設計標準を定義します。

## 🏗️ 統一アーキテクチャ

### 1. レイアウトシステム

- **唯一の真実**: `theme/layout.ts` の `UNIFIED_LAYOUT` を使用
- **禁止**: CSS変数の重複定義、ハードコードされたピクセル値
- **原則**: すべてのレイアウト値は統一システムから取得

```typescript
// ✅ 正しい
import { UNIFIED_LAYOUT } from "@/theme/layout";
w={UNIFIED_LAYOUT.CARD.MIN_WIDTH}

// ❌ 間違い
w="120px"
w={{ base: "80px", md: "88px" }}
```

### 2. CSS設計原則

#### 🔹 統一性 (Consistency)

- Chakra UIのプロパティシステムを優先使用
- インラインスタイル (`style={}`) の使用禁止
- テーマトークンの活用

#### 🔹 予測可能性 (Predictability)

- agentが正確に計算できる明確な値
- 複雑なCSS変数の上書きを避ける
- DPIスケール対応は自動化

#### 🔹 保守性 (Maintainability)

- レガシーなGridレイアウトを避ける
- Flexboxベースの統一レイアウト
- 明確な責任分離

## 📋 実装ガイド

### レイアウトコンポーネント

- `GameLayout`: すべてのゲーム画面の基盤
- `Panel`: 再利用可能なパネルコンポーネント
- `ScrollableArea`: 一貫したスクロール動作

### サイズとスペーシング

```typescript
// 統一レイアウトシステム使用例
const UNIFIED_LAYOUT = {
  HEADER_HEIGHT: "clamp(48px, 4vh, 64px)",
  SIDEBAR_WIDTH: "clamp(240px, 22vw, 300px)",
  RIGHT_PANEL_WIDTH: "clamp(280px, 26vw, 360px)",
  HAND_AREA_HEIGHT: "clamp(100px, 12vh, 150px)",

  DPI_125: {
    HEADER_HEIGHT: "clamp(44px, 3.5vh, 58px)",
    HAND_AREA_HEIGHT: "clamp(80px, 8vh, 120px)",
  },

  CARD: {
    MIN_WIDTH: "clamp(60px, 8vw, 120px)",
    MIN_HEIGHT: "clamp(80px, 10vh, 140px)",
  },

  BORDER_WIDTH: "1px",
};
```

### DPIスケール対応

- 125% DPIスケール: 自動最適化
- 流動的サイズ: `clamp()` 関数使用
- メディアクエリ: 統一システムから取得

## 🚫 禁止事項

### CSS変数の重複

```css
/* ❌ 禁止 - globals.cssでの重複定義 */
:root {
  --game-header-height: clamp(48px, 4vh, 64px);
}

/* ✅ 正しい - theme/layout.tsで統一管理 */
```

### ハードコードされた値

```tsx
// ❌ 禁止
<Box w="200px" h="120px" borderWidth="1px" />

// ✅ 正しい
<Box
  w={UNIFIED_LAYOUT.CARD.MIN_WIDTH}
  h={UNIFIED_LAYOUT.CARD.MIN_HEIGHT}
  borderWidth={UNIFIED_LAYOUT.BORDER_WIDTH}
/>
```

### レガシーレイアウト

```tsx
// ❌ 禁止 - Grid/GridItem
<Grid templateColumns="1fr 320px">
  <GridItem>...</GridItem>
</Grid>

// ✅ 正しい - Flexbox
<Flex direction={{ base: "column", lg: "row" }}>
  <Box flex="1">...</Box>
</Flex>
```

### インラインスタイル

```tsx
// ❌ 禁止
<div style={{ padding: "8px", border: "1px solid #ccc" }} />

// ✅ 正しい
<Box p={2} borderWidth={UNIFIED_LAYOUT.BORDER_WIDTH} borderColor="borderDefault" />
```

## 🎨 デザインシステム連携

### Chakra UIテーマ統合

- セマンティックトークンの活用
- カラーパレットの一貫性
- コンポーネントレシピの使用

### レスポンシブ設計

- ビューポートベースの流動的サイズ
- DPIスケール自動対応
- 明確なブレークポイント

## ✅ チェックリスト

### 新規コンポーネント作成時

- [ ] `UNIFIED_LAYOUT` システムを使用している
- [ ] ハードコードされた値がない
- [ ] インラインスタイルを使用していない
- [ ] Chakra UIプロパティを適切に使用している
- [ ] DPIスケール対応が考慮されている

### 既存コンポーネント修正時

- [ ] レガシーなGridレイアウトを削除した
- [ ] CSS変数の重複を解消した
- [ ] 統一レイアウトシステムに移行した
- [ ] 型エラーがない
- [ ] コンソールエラーがない

## 📚 関連ファイル

### コアファイル

- `theme/layout.ts` - 統一レイアウトシステム
- `theme/index.ts` - Chakra UIテーマ設定
- `app/globals.css` - グローバルベーススタイル
- `components/ui/GameLayout.tsx` - レイアウト基盤

### UI コンポーネント

- `components/ui/Panel.tsx` - パネルベース
- `components/ui/ScrollableArea.tsx` - スクロール領域
- `components/ui/GameCard.tsx` - ゲームカード
- `components/ui/SelfNumberCard.tsx` - 手札カード

## 🔄 アップデート履歴

### 2025-08-25 - 初期版作成

- CSS変数の重複解消
- 統一レイアウトシステム導入
- レガシーGridレイアウト除去
- インラインスタイル統一
- DPIスケール対応強化

---

この標準に従うことで、「誰が触っても壊れにくいCSS」を実現し、agentが予測可能で一貫性のあるコードを生成できるようになります。
