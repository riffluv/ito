# 🏗️ Border Management System - ベストプラクティス設計

## 📊 現在の実装問題分析

### 🔴 Problem 1: 設計システムの自己矛盾

```typescript
// ❌ 問題のある現在の設計
UNIFIED_LAYOUT = {
  BORDER_WIDTH: "1px", // 定義されているが...
  ELEVATION: { /* borderの代替 */ }, // borderless推奨？
}

// 実装では完全除去
borderWidth={UNIFIED_LAYOUT.BORDER_WIDTH} // 使われない
```

### 🔴 Problem 2: 競合リスク

- 将来border追加時の予測不可能な動作
- 統一定数と実装の乖離
- コンポーネント間の一貫性欠如

### 🔴 Problem 3: 拡張性の欠如

- 新機能でのborder要求対応困難
- 条件付きborderの管理複雑化
- 設計意図の不透明性

## ✅ 推奨解決策: Context-Aware Border System

### 1. Border Context Enum

```typescript
// 明確な意図表現
export enum BorderContext {
  NONE = "none", // 完全borderless
  INTERACTIVE = "interactive", // hover/focus時のみ
  SEMANTIC = "semantic", // 意味的分離
  DECORATIVE = "decorative", // 装飾的
}

export const BORDER_SYSTEM = {
  WIDTH: {
    NONE: "0px",
    THIN: "1px",
    MEDIUM: "2px",
    THICK: "3px",
  },

  CONTEXT: {
    [BorderContext.NONE]: {
      default: "0px",
      hover: "0px",
      focus: "0px",
    },
    [BorderContext.INTERACTIVE]: {
      default: "0px",
      hover: "2px",
      focus: "2px",
    },
    [BorderContext.SEMANTIC]: {
      default: "1px",
      hover: "1px",
      focus: "2px",
    },
    [BorderContext.DECORATIVE]: {
      default: "1px",
      hover: "1px",
      focus: "1px",
    },
  },
};
```

### 2. Smart Border Helper

```typescript
interface BorderProps {
  context: BorderContext;
  state?: 'default' | 'hover' | 'focus';
  override?: string;
}

export const getBorderWidth = ({ context, state = 'default', override }: BorderProps): string => {
  if (override) return override;
  return BORDER_SYSTEM.CONTEXT[context][state];
}

// 使用例
<Box
  borderWidth={getBorderWidth({ context: BorderContext.INTERACTIVE })}
  _hover={{
    borderWidth: getBorderWidth({ context: BorderContext.INTERACTIVE, state: 'hover' })
  }}
>
```

### 3. Component-Specific Border Strategy

```typescript
// 各コンポーネントの明確な戦略定義
export const COMPONENT_BORDER_STRATEGY = {
  GameLayout: {
    header: BorderContext.NONE,
    sidebar: BorderContext.NONE,
    footer: BorderContext.NONE,
    panels: BorderContext.NONE,
  },

  GameCard: {
    default: BorderContext.NONE,
    hover: BorderContext.INTERACTIVE,
    selected: BorderContext.SEMANTIC,
  },

  ChatMessage: {
    default: BorderContext.NONE, // elevation-based
    system: BorderContext.DECORATIVE,
  },

  FormElements: {
    input: BorderContext.SEMANTIC, // UX必須
    button: BorderContext.INTERACTIVE,
  },

  BoardArea: {
    default: BorderContext.NONE,
    dragOver: BorderContext.INTERACTIVE, // 動的表示
  },
} as const;
```

### 4. Type-Safe Implementation

```typescript
type ComponentName = keyof typeof COMPONENT_BORDER_STRATEGY;
type BorderState<T extends ComponentName> = keyof typeof COMPONENT_BORDER_STRATEGY[T];

export const getComponentBorder = <T extends ComponentName>(
  component: T,
  state: BorderState<T>
): string => {
  const context = COMPONENT_BORDER_STRATEGY[component][state];
  return getBorderWidth({ context });
}

// 使用例 - 型安全
<Box borderWidth={getComponentBorder('GameCard', 'hover')}>
```

## 🎨 Migration Strategy

### Phase 1: System Definition

- [ ] BORDER_SYSTEM定数定義
- [ ] getBorderWidth関数実装
- [ ] COMPONENT_BORDER_STRATEGY定義

### Phase 2: Gradual Migration

```typescript
// Before (問題のある実装)
<Box> // borderWidth完全除去

// After (ベストプラクティス)
<Box borderWidth={getComponentBorder('GameLayout', 'header')}>
```

### Phase 3: Validation

- [ ] 型チェック通過
- [ ] 視覚的regression test
- [ ] パフォーマンス検証

## 💡 Key Benefits

### ✅ 1. 設計意図の明確化

- 各コンポーネントのborder戦略が文書化
- 将来の変更時の影響範囲が明確
- 新規開発者の理解促進

### ✅ 2. 競合リスクの回避

- 統一システムと実装の整合性保証
- 予測可能なborder動作
- テーマ変更時の一括対応

### ✅ 3. 拡張性の確保

- 新しいborderパターンの容易な追加
- A/Bテストでの柔軟なborder切り替え
- 将来仕様変更への対応力

### ✅ 4. パフォーマンス最適化

- 不要なborderレンダリング回避
- CSS最適化による描画性能向上
- メモリ使用量削減

## 🚀 Implementation Example

```typescript
// components/ui/GameCard.tsx
export const GameCard = ({ variant, isSelected, isHover, ...props }) => {
  const borderContext = isSelected
    ? BorderContext.SEMANTIC
    : isHover
    ? BorderContext.INTERACTIVE
    : BorderContext.NONE;

  return (
    <Box
      borderWidth={getBorderWidth({ context: borderContext })}
      borderColor="borderDefault"
      boxShadow={UNIFIED_LAYOUT.ELEVATION.CARD.RAISED}
      {...props}
    />
  );
};
```

## 🎯 Conclusion

現在の「border完全除去」アプローチは短期的解決策としては有効ですが、**長期的な保守性と拡張性に問題**があります。

**推奨アプローチ:**

1. **Context-Aware Border System** の導入
2. **明確な設計戦略** の文書化
3. **段階的移行** による安全な実装
4. **型安全性** による品質保証

これにより、「必要な時にborderを適切に使える」柔軟で堅牢なシステムが構築できます。
