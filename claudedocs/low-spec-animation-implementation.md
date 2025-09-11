# 🎯 低スペPC対応アニメーション実装指示書

## 📋 **実装目的**

低スペック環境プログラムの仲間（ノートPC、CPU内蔵グラフィック使用）でも快適にカードめくりアニメーションを楽しめるように、GPU性能検出システムと代替アニメーション機能を実装する。

## 🚨 **重要な前提知識**

### **現在の状況**
- **高性能PC**: 3Dアニメーション（`rotateY`）が正常動作
- **低スペPC**: 3Dアニメーションが発火せず、カードが数字のまま表示される
- **原因**: CPU内蔵グラフィック（Intel HD/UHD）でCSS 3D transformが正しく動作しない

### **求められる動作**
1. **自動GPU性能検出** - WebGL情報から低スペPCを判定
2. **代替アニメーション** - 低スペPCでは表示切り替えによるカードめくり
3. **設定UI統合** - 既存設定モーダルにタブ追加（縦長回避）
4. **手動切り替え可能** - 自動検出 + 手動オーバーライド機能

## 🎮 **実装対象ファイル**

### **新規作成ファイル**
1. `lib/hooks/useGPUPerformance.ts` - GPU性能検出とアニメーション設定管理
2. `claudedocs/low-spec-animation-implementation.md` - この指示書

### **編集対象ファイル**  
1. `components/ui/GameCard.tsx` - デュアルアニメーション対応
2. `components/SettingsModal.tsx` - タブ追加とアニメーション設定UI

## 💻 **詳細実装仕様**

### **1. GPU性能検出システム (`lib/hooks/useGPUPerformance.ts`)**

```typescript
export type GPUCapability = "high" | "low";
export type AnimationMode = "auto" | "3d" | "simple";

export interface GPUPerformanceHook {
  gpuCapability: GPUCapability;
  animationMode: AnimationMode;
  effectiveMode: "3d" | "simple";
  setAnimationMode: (mode: AnimationMode) => void;
}

// 実装要件:
// - WebGL renderer情報から Intel HD/UHD を検出
// - localStorage で設定永続化
// - 低性能パターン: /intel.*hd/i, /intel.*uhd/i, /intel.*iris/i, /amd.*radeon.*r[2-5]/i
```

### **2. GameCard.tsx デュアルアニメーション対応**

#### **3Dモード（高性能PC）**
```typescript
// 従来通りのrotateY アニメーション
if (effectiveMode === "3d") {
  flipTransform = flipped ? "rotateY(180deg)" : "rotateY(0deg)";
  frontStyle = { backfaceVisibility: "hidden" };
  backStyle = { backfaceVisibility: "hidden", transform: "rotateY(180deg)" };
}
```

#### **シンプルモード（低スペPC）**  
```typescript
// 表示切り替えによるカードめくり
if (effectiveMode === "simple") {
  frontStyle = { display: flipped ? "none" : "block" };
  backStyle = { display: flipped ? "block" : "none" };
  // transform は使用しない
}
```

#### **⚠️ 注意事項**
- **条件分岐の競合回避**: 3Dモードとシンプルモードで異なるCSS プロパティを使用
- **パフォーマンス**: `will-change` は必要時のみ適用
- **アクセシビリティ**: カード内容の表示/非表示を適切に制御

### **3. SettingsModal.tsx タブ統合**

#### **タブ構成**
- **Game Settings**: 既存のゲーム設定（音声、振動など）
- **Graphics Settings**: 新規追加のアニメーション設定

#### **アニメーション設定UI**
```typescript
const animationOptions = [
  { value: "auto", label: "自動おすすめ設定", description: "PCの せいのうに あわせて さいてき" },
  { value: "3d", label: "高品質 3D", description: "3D回転アニメーション" },
  { value: "simple", label: "シンプル", description: "軽量表示切り替え" }
];
```

#### **UI要件**
- **ラジオボタン**: 3つの選択肢を排他選択
- **説明テキスト**: 各モードの説明を表示
- **現在のモード表示**: 自動検出結果も表示
- **ドラクエ風統一**: 既存のデザインシステムに準拠

## 🔧 **実装ステップ**

### **Step 1: GPU検出フックの作成**
```bash
# ファイル作成
touch lib/hooks/useGPUPerformance.ts

# 実装内容
- WebGL コンテキストから renderer 情報取得
- Intel HD/UHD/Iris, AMD R2-R5 を低性能GPU として判定  
- localStorage で設定永続化 (key: "gpu-animation-mode")
- React hook として export
```

### **Step 2: GameCard.tsx の修正**
```bash
# 修正対象: components/ui/GameCard.tsx (variant === "flip" のセクション)

# 修正内容
1. useGPUPerformance フックをimport
2. effectiveMode による条件分岐実装
3. 3Dモード: 従来のrotateY アニメーション
4. シンプルモード: display プロパティによる表示制御
```

### **Step 3: SettingsModal.tsx への統合**
```bash
# 修正対象: components/SettingsModal.tsx

# 修正内容  
1. タブシステム追加 (Game Settings / Graphics Settings)
2. Graphics Settings タブにアニメーション設定UI実装
3. useGPUPerformance フックとの連携
4. 縦長UI問題の解決
```

### **Step 4: 動作テスト**
```bash
# テストケース
1. 高性能PC: 3D アニメーション動作確認
2. 設定変更: シンプルモードに切り替えテスト  
3. 自動検出: GPU判定ロジックの確認
4. 設定永続化: リロード後の設定保持確認
```

## 📚 **既存コードとの統合**

### **ImportMap**
```typescript
// GameCard.tsx に追加
import { useGPUPerformance } from "@/lib/hooks/useGPUPerformance";

// SettingsModal.tsx に追加  
import { useGPUPerformance } from "@/lib/hooks/useGPUPerformance";
```

### **既存デザインシステム活用**
- `UNIFIED_LAYOUT` サイズ定数
- `CARD_FLIP_EASING` アニメーション定数
- ドラクエ風カラーパレット（紫、青、白）
- `getDragonQuestStyle` 関数

## 🎯 **成功基準**

### **機能要件**
- ✅ 低スペPCでカード内容（連想ワード ↔ 数字）が正しく切り替わる
- ✅ 高スペPCでは従来の3Dアニメーションを維持
- ✅ 自動GPU検出が正確に動作する
- ✅ 手動設定で各モードを強制選択可能  
- ✅ 設定がリロード後も保持される

### **UI/UX要件**
- ✅ 設定モーダルが縦長にならない（タブ分割）
- ✅ ドラクエ風デザインシステムに統一
- ✅ 設定項目の説明が分かりやすい
- ✅ 現在のモード状態が明確

### **パフォーマンス要件**  
- ✅ GPU判定処理が初回のみ実行される
- ✅ 不要なre-renderが発生しない
- ✅ アニメーション処理が軽量

## ⚠️ **注意すべきポイント**

### **技術的制約**
- **CSS Transform混在禁止**: 3DモードとシンプルモードでCSS プロパティを明確分離
- **State管理**: flipped 状態とアニメーション状態の同期
- **WebGL互換性**: 一部ブラウザでWebGL無効時の fallback

### **ユーザビリティ**
- **説明テキスト**: 技術的でない日本語で表現
- **デフォルト設定**: 初回は必ず "auto" モード
- **エラー処理**: GPU判定失敗時は安全側（シンプルモード）へfallback

## 🚀 **期待される結果**

**この実装により、低スペック環境プログラムの仲間全員が**:
1. **カードめくりアニメーション**を体験できる
2. **快適な操作感**でゲームを楽しめる  
3. **設定の迷い**なく最適なモードを選択できる
4. **高性能PC組**も従来通りの体験を維持できる

**最終的に、PCスペックに関係なく全員が同じゲーム体験を共有できる状態を実現する。**