# 🎮 モダンゲームUI設計ガイドライン 2025

## 📊 調査結果: Border問題の根本原因

### 現在の問題

- **Border Overload**: 隣接するコンテナすべてにborderが存在
- **視覚的ノイズ**: 境界線が重なって太く見える
- **階層感の欠如**: 同レベル要素のみを表現し、情報階層が不明確

### モダンゲームUIトレンド (2025年)

1. **Shadow-based Elevation** - borderの代わりにboxShadowで階層表現
2. **Strategic Spacing** - 適切な余白で要素を分離
3. **Subtle Backgrounds** - 微細な背景色変化で領域を区別
4. **Minimal Borders** - 必要最小限のbordered要素のみ

## 🎯 設計哲学: "Borderless First"

### Core Principles

#### 1. Elevation Over Borders

```tsx
// ❌ Border-heavy (旧式)
<Box borderWidth="1px" borderColor="gray.300">
  <Box borderWidth="1px" borderColor="gray.300">
    Content
  </Box>
</Box>

// ✅ Shadow-based Elevation (モダン)
<Box boxShadow={UNIFIED_LAYOUT.ELEVATION.PANEL.BASE}>
  <Box boxShadow={UNIFIED_LAYOUT.ELEVATION.CARD.RAISED}>
    Content
  </Box>
</Box>
```

#### 2. Contextual Separation

```tsx
// ❌ 機械的な境界線
<Box borderTopWidth="1px" />

// ✅ 文脈的な分離
<Box bg={UNIFIED_LAYOUT.SURFACE.PANEL_SUBTLE} p={4} />
```

#### 3. Hierarchy Through Design

```tsx
// ❌ 平坦な情報構造
<Stack>
  <Box border="1px solid gray">Header</Box>
  <Box border="1px solid gray">Content</Box>
  <Box border="1px solid gray">Footer</Box>
</Stack>

// ✅ 階層的な情報構造
<Stack>
  <Box bg={UNIFIED_LAYOUT.SURFACE.ELEVATED}
       boxShadow={UNIFIED_LAYOUT.ELEVATION.PANEL.DISTINCT}>
    Header
  </Box>
  <Box bg={UNIFIED_LAYOUT.SURFACE.BASE}>
    Content
  </Box>
  <Box bg={UNIFIED_LAYOUT.SURFACE.PANEL_SUBTLE}>
    Footer
  </Box>
</Stack>
```

## 🛠️ 実装ガイド

### Border除去の優先順位

#### Phase 1: 完全除去対象

- ✅ **フッターのtopBorder** - 不要な分離線
- ✅ **参加者パネルとセンターの間のborder** - 視覚的ノイズ
- ✅ **お題とカードボードのborder** - 情報階層の混乱

#### Phase 2: 代替手法移行

- 🔄 **チャットメッセージのborder** → `boxShadow + bg変化`
- 🔄 **参加者カードのborder** → `elevation + spacing`
- 🔄 **ゲーム制御パネル境界** → `background差分`

#### Phase 3: 必要最小限保持

- 🟡 **フォーム入力要素** - UX上必要
- 🟡 **アクティブ状態の強調** - フィードバック必須

### 具体的な置換パターン

#### パターン1: Panel Separation

```tsx
// Before: Heavy borders
<Box borderTopWidth="1px" borderColor="borderDefault" pt={4}>
  Content
</Box>

// After: Subtle background + spacing
<Box bg={UNIFIED_LAYOUT.SURFACE.PANEL_SUBTLE} p={4} mt={2}>
  Content
</Box>
```

#### パターン2: Card Elements

```tsx
// Before: Sharp borders
<Box borderWidth="1px" borderColor="borderDefault" p={4}>
  Card Content
</Box>

// After: Soft elevation
<Box
  boxShadow={UNIFIED_LAYOUT.ELEVATION.CARD.RAISED}
  bg={UNIFIED_LAYOUT.SURFACE.PANEL}
  p={4}
  borderRadius="lg"
>
  Card Content
</Box>
```

#### パターン3: Game Elements

```tsx
// Before: Multiple borders
<HStack>
  <Box borderWidth="1px">Player 1</Box>
  <Box borderWidth="1px">Player 2</Box>
</HStack>

// After: Spaced elevation
<HStack gap={3}>
  <Box boxShadow={UNIFIED_LAYOUT.ELEVATION.GAME.BOARD_CARD} p={3}>
    Player 1
  </Box>
  <Box boxShadow={UNIFIED_LAYOUT.ELEVATION.GAME.BOARD_CARD} p={3}>
    Player 2
  </Box>
</HStack>
```

## 🎨 デザインシステム連携

### Elevation階層

```tsx
// Level 0: Flat surfaces
boxShadow: UNIFIED_LAYOUT.ELEVATION.PANEL.BASE(none);

// Level 1: Subtle separation
boxShadow: UNIFIED_LAYOUT.ELEVATION.PANEL.SUBTLE;

// Level 2: Clear distinction
boxShadow: UNIFIED_LAYOUT.ELEVATION.PANEL.DISTINCT;

// Level 3: Floating elements
boxShadow: UNIFIED_LAYOUT.ELEVATION.CARD.FLOATING;

// Level 4: Modal/prominent
boxShadow: UNIFIED_LAYOUT.ELEVATION.CARD.ELEVATED;
```

### Surface階層

```tsx
// Base canvas
bg: UNIFIED_LAYOUT.SURFACE.BASE;

// Panel background
bg: UNIFIED_LAYOUT.SURFACE.PANEL;

// Subtle panel
bg: UNIFIED_LAYOUT.SURFACE.PANEL_SUBTLE;

// Game-specific
bg: UNIFIED_LAYOUT.SURFACE.GAME_AREA;
bg: UNIFIED_LAYOUT.SURFACE.HAND_AREA;
bg: UNIFIED_LAYOUT.SURFACE.BOARD_AREA;
```

## 🚀 実装計画

### Step 1: Infrastructure Setup ✅

- ELEVATION system in UNIFIED_LAYOUT
- SURFACE system in UNIFIED_LAYOUT
- Design guidelines documentation

### Step 2: Critical Border Removal

- 🎯 Footer top border removal
- 🎯 Participant-center separator removal
- 🎯 Game board border cleanup

### Step 3: Component Migration

- 🔄 ChatPanel border → shadow
- 🔄 Participants border → elevation
- 🔄 Game controls → background differentiation

### Step 4: Quality Assurance

- 🔍 Visual hierarchy validation
- 🔍 Accessibility compliance check
- 🔍 Cross-device testing

## 📈 期待される効果

### UX改善

- **視覚的クリーンさ**: 不要な境界線の削除
- **情報階層の明確化**: elevation-based hierarchy
- **現代的な外観**: 2025年トレンド準拠

### 技術的メリット

- **保守性向上**: 統一されたdesign system
- **一貫性**: predictableなvisual language
- **スケーラビリティ**: 新機能追加時の設計指針

### パフォーマンス

- **レンダリング最適化**: border計算削減
- **CSS最適化**: shadow-basedはGPU加速
- **レスポンシブ対応**: fluid elevation system

## 🎮 ゲーム特化考慮事項

### カードゲームUI特性

- **手札の視認性**: elevation differenceで所有権を表現
- **場の状況把握**: background variationで領域区別
- **アクション可能性**: hover/active stateをshadowで表現

### インタラクション設計

- **ホバー効果**: `ELEVATION.CARD.FLOATING`に変化
- **アクティブ状態**: `ELEVATION.GAME.ACTIVE_AREA`使用
- **選択状態**: combined elevation + color accent
