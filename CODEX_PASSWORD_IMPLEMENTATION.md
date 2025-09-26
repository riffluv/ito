# 🎮 4桁ドラクエ風パスワード入力UI実装指示書

## 📋 **実装概要**
現在のパスワード入力を4桁のゲーム風UIに置き換える

### **現在の問題**
- 既存実装でデバッグログ確認済み：入力イベントは発火するが数字が認識されない
- `replace(/[^0-9]/g, '')` の処理で入力が空になっている
- おそらく入力値の型またはイベントハンドリングに問題

## 🎯 **要件定義**

### **デザイン要件**
- **4個の独立した60x60pxボックス**
- **ドラクエ風スタイル**: 角ばった・太いborder・monospaceフォント
- **白背景・黒文字** で視認性確保
- **エラー時は赤いborder**

### **機能要件**
- **数字のみ入力可能** (0-9)
- **自動フォーカス移動**: 入力後に次のボックスへ
- **キーボードナビ**: 矢印キー・Backspaceでの移動
- **ペースト対応**: 4桁をまとめて貼り付け
- **既存パスワード機能との完全互換**

### **バリデーション**
- **4桁数字のみ** (`/^\d{4}$/`)
- **確認入力との一致チェック**
- **エラー表示**: "4桁の数字を入力してください"

## 🔧 **技術仕様**

### **コンポーネント構造**
```typescript
interface GamePasswordInputProps {
  value: string;           // "1234" 形式
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
}
```

### **使用場所**
`components/CreateRoomModal.tsx` の以下の部分を置き換え：

```typescript
// 置き換え対象（長い Input コンポーネント2個）
<Input type="text" placeholder="パスワード (4文字以上)" ... />
<Input type="text" placeholder="もう一度入力" ... />

// ↓ 新しいUI
<GamePasswordInput value={password} onChange={setPassword} error={!!passwordError} />
<GamePasswordInput value={passwordConfirm} onChange={setPasswordConfirm} error={!!passwordError} />
```

### **バリデーション変更**
```typescript
// 現在
if (trimmed.length < 4) {
  setPasswordError("パスワードは4文字以上で設定してください");

// ↓ 変更後
if (trimmed.length !== 4 || !/^\d{4}$/.test(trimmed)) {
  setPasswordError("4桁の数字を入力してください");
```

## 🎨 **ドラクエ風スタイル仕様**

### **ボックススタイル**
```css
width: 60px
height: 60px
fontSize: 2rem
fontWeight: bold
fontFamily: monospace
color: black
background: white
border: 3px solid rgba(255,255,255,0.9)
borderRadius: 0  /* 角ばり */
textAlign: center
boxShadow: 2px 2px 0 rgba(0,0,0,0.8)  /* ドラクエ風影 */
```

### **状態別スタイル**
```css
/* 通常 */
background: white

/* hover */
background: #f0f0f0

/* focus */
background: #f8f8f8
boxShadow: 追加のglow効果

/* error */
border: 3px solid #EF4444
```

## 🚨 **重要な注意点**

### **既存バグの回避**
- **状態管理の循環参照を避ける**
- `useEffect`での親の`value`からの自動更新は慎重に
- `digits`ローカル状態と親の`value`の同期タイミング

### **入力処理の確実な実装**
- 現在のデバッグで`newValue`が数字として処理されていない問題を解決
- `e.target.value`の型・内容を確認
- 必要に応じて`String()`で型変換

### **既存システムとの互換性**
- パスワード暗号化処理は変更不要
- Firebase認証部分は既存のまま
- 4桁文字列として渡せばOK

## 📝 **実装手順**

1. **新しいコンポーネント作成**: `components/ui/GamePasswordInput.tsx`
2. **CreateRoomModalに組み込み**: import & 既存Input置き換え
3. **バリデーション修正**: 4桁数字チェックに変更
4. **ラベル修正**: "4桁の ひみつ ばんごう" / "もういちど にゅうりょく"
5. **動作確認**: 入力→確認→ルーム作成→パスワード認証

## 🎮 **期待される結果**
- モダンゲーム風の直感的なパスワード入力
- ドラクエテーマとの完全統一
- セキュリティ機能の保持
- UX向上（入力しやすさ・エラーの分かりやすさ）

---
**実装者**: codex
**参考**: 既存のGamePasswordInput実装あり（バグ修正要）
**期限**: 来月15日発表前まで