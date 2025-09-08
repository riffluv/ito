# ボタンアニメーション実装ガイド

## 🎯 **重要な実装決定事項**

### **JSベースアニメーション採用理由**
- **CSS競合問題**: Chakra UI v3の`_active`/`_hover`擬似クラスがブラウザデフォルトCSS/内部CSSと競合
- **解決策**: JavaScript `onMouse*`イベントで`style.transform`を直接制御
- **利点**: CSS優先順位問題を完全回避、確実な動作保証

## 🔧 **現在の実装**

### **AppButton.tsx**
```typescript
// ✅ 統一されたアニメーションフック
export const useButtonAnimation = () => {
  const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = "translateY(0px)";  // 押し込み
  };
  
  const handleMouseUp = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = "translateY(-1px)"; // ホバーに戻る
  };
  
  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = "translateY(-1px)"; // 浮上
  };
  
  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = "translateY(0px)";  // 通常に戻る
  };

  return { handleMouseDown, handleMouseUp, handleMouseEnter, handleMouseLeave };
};
```

### **アニメーション動作フロー**
1. **通常状態**: `translateY(0px)` 
2. **ホバー**: `translateY(-1px)` → ボタンが浮く
3. **押下**: `translateY(0px)` → 元の位置（押し込み効果）
4. **離す**: `translateY(-1px)` → ホバー状態に復帰
5. **マウス離脱**: `translateY(0px)` → 通常状態に復帰

## ⚠️ **エージェント向け重要事項**

### **絶対にやらないこと**
```typescript
// ❌ CSS擬似クラス使用禁止（競合の原因）
_active: { transform: "translateY(0)" }
_hover: { transform: "translateY(-1px)" }

// ❌ !important使用禁止（アンチパターン）
transform: "translateY(0) !important"

// ❌ 二重実装禁止（CSS + JS同時使用）
_hover: { transform: "translateY(-1px)" }  // CSS
onMouseEnter={(e) => e.currentTarget.style.transform = "..."}  // JS
```

### **推奨パターン**
```typescript
// ✅ useButtonAnimationフック使用
const animation = useButtonAnimation();

<AppButton
  onMouseDown={animation.handleMouseDown}
  onMouseUp={animation.handleMouseUp}
  onMouseEnter={animation.handleMouseEnter}  
  onMouseLeave={animation.handleMouseLeave}
>
  ボタンテキスト
</AppButton>
```

### **新しいボタンコンポーネント作成時**
1. `AppButton`を継承する（`RPGButton`パターン参考）
2. `useButtonAnimation`は自動適用（`AppButton`内で実装済み）
3. 独自アニメーションが必要な場合のみ`useButtonAnimation`をimport

## 🚀 **拡張可能性**

### **将来の機能追加**
```typescript
// 例: アニメーション無効化オプション
export const useButtonAnimation = (disabled = false) => {
  if (disabled) return { 
    handleMouseDown: () => {}, 
    handleMouseUp: () => {}, 
    handleMouseEnter: () => {}, 
    handleMouseLeave: () => {} 
  };
  // ... 既存の実装
};
```

### **カスタムアニメーション**
```typescript
// 例: より強いアニメーション
const useStrongButtonAnimation = () => {
  const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = "translateY(2px) scale(0.98)";
  };
  // ... 他のハンドラー
};
```

## 📋 **トラブルシューティング**

### **アニメーションが効かない場合**
1. **CSS競合チェック**: 他のCSSが`transform`を上書きしていないか
2. **イベントハンドラー確認**: `onMouse*`が正しく設定されているか
3. **コンポーネント継承確認**: `AppButton`を使用しているか

### **デバッグ方法**
```typescript
const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
  console.log('MouseDown triggered', e.currentTarget.style.transform);
  e.currentTarget.style.transform = "translateY(0px)";
};
```

## 💡 **最終推奨事項**

1. **統一性**: 全てのボタンで`AppButton`使用
2. **拡張性**: 新機能は`useButtonAnimation`フック拡張
3. **保守性**: CSS/JSアニメーション混在回避
4. **テスト性**: アニメーション動作は手動で確認必須

**この実装により、CSS競合を回避し、確実なアニメーション動作を実現しています。**