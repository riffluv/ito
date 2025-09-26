# 🔄 codex実装引き継ぎ: 4桁ドラクエ風パスワード入力UI

## 📋 **緊急バトンタッチ要請**

**日時**: 2025-09-26
**状況**: GamePasswordInputコンポーネントで入力バグが発生中
**期限**: 来月15日のプロジェクト発表前
**要請者**: hr-hm（ITスクール生）

---

## 🚨 **現在の問題状況**

### **バグの詳細**
- **症状**: 4桁パスワード入力ボックスで数字が入力できない
- **発生箇所**: `components/ui/GamePasswordInput.tsx`
- **既知の修正試行**: 型変換(`String()`)、useEffect同期を追加済み
- **問題継続**: 修正後も依然として入力不可

### **コンソールログ（最新）**
```
GamePasswordInput.tsx:23 入力イベント: Object
GamePasswordInput.tsx:28 処理後の数字:
GamePasswordInput.tsx:34 新しいdigits: Array(4)
GamePasswordInput.tsx:38 パスワード更新:
```

**分析**: 入力イベントは発火するが、数字処理で空文字になる問題が未解決

---

## 🎯 **実装要件**

### **機能要件**
- **4個の独立した60x60pxボックス**
- **数字のみ入力可能** (0-9)
- **自動フォーカス移動**: 入力後に次のボックスへ
- **キーボードナビゲーション**: 矢印キー・Backspaceでの移動
- **ペースト対応**: 4桁をまとめて貼り付け
- **既存パスワード機能との完全互換**

### **デザイン要件（ドラクエ風）**
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
- **通常**: `background: white`
- **エラー**: `border: 3px solid #EF4444`

---

## 🔧 **技術仕様**

### **コンポーネントインターface**
```typescript
interface GamePasswordInputProps {
  value: string;           // "1234" 形式
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
}
```

### **使用場所**
- **ファイル**: `components/CreateRoomModal.tsx`
- **統合済み**: 630行目、647行目で既にGamePasswordInput使用中

### **バリデーション（実装済み）**
```typescript
// CreateRoomModal.tsx:119行目
if (trimmed.length !== 4 || !/^\d{4}$/.test(trimmed)) {
  setPasswordError("4桁の数字を入力してください");
}
```

---

## 📁 **関連ファイル**

### **主要ファイル**
1. **`components/ui/GamePasswordInput.tsx`** - 問題のコンポーネント
2. **`components/CreateRoomModal.tsx`** - 統合先（630、647行目）
3. **`CODEX_PASSWORD_IMPLEMENTATION.md`** - 元の実装指示書

### **参考ファイル**
- **`components/RoomPasswordPrompt.tsx`** - 部屋入室時パスワード入力
- **`theme/layout.ts`** - UI_TOKENSスタイル定義
- **`console.md`** - デバッグログ記録

---

## 🛠 **既存実装の詳細**

### **現在のコード構造**
```typescript
export function GamePasswordInput({ value, onChange, disabled = false, error = false }) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [digits, setDigits] = useState<string[]>(['', '', '', '']);

  // 親のvalueプロパティとの同期
  useEffect(() => {
    if (value !== undefined) {
      const valueStr = String(value);
      const newDigits = valueStr.split('').concat(['', '', '', '']).slice(0, 4);
      setDigits(newDigits);
    }
  }, [value]);

  const handleDigitChange = useCallback((index: number, newValue: string) => {
    if (disabled) return;

    // 入力値の型を確実に文字列にする
    const valueStr = String(newValue || '');
    console.log('入力イベント:', { index, newValue, valueStr, type: typeof newValue });

    // 数字のみ受け付け（最後の一桁のみ）
    const digit = valueStr.replace(/[^0-9]/g, '').slice(-1);

    // ここで digit が空文字になる問題発生 ⚠️

    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);

    const password = newDigits.join('');
    onChange(password);

    if (digit && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  }, [digits, onChange, disabled]);

  return (
    <HStack spacing={3} justify="center">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => { inputRefs.current[index] = el; }}
          value={digit}
          onChange={(e) => handleDigitChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={index === 0 ? handlePaste : undefined}
          maxLength={1}
          disabled={disabled}
          type="text"
          inputMode="numeric"
          autoComplete="new-password"
          style={{...スタイル定義}}
        />
      ))}
    </HStack>
  );
}
```

### **既知の修正試行**
1. ✅ `String(newValue || '')` による型変換追加
2. ✅ `useEffect`による親コンポーネント同期追加
3. ✅ デバッグログの詳細化
4. ❌ **依然として入力不可**

---

## 🔍 **推定される問題の原因**

### **可能性1: イベントオブジェクト問題**
- `e.target.value`の取得でオブジェクトが返される
- `newValue`パラメータの型不整合

### **可能性2: React合成イベント問題**
- SyntheticEventの処理タイミング問題
- `onChange`イベントハンドラの競合

### **可能性3: 状態更新の競合**
- `digits`状態と親`value`の循環更新
- `useCallback`の依存配列問題

### **可能性4: HTML input要素との相性**
- Chakra UIとnative inputの混在問題
- `maxLength={1}`との相性問題

---

## 📝 **実装方針の提案**

### **アプローチ1: 完全刷新**
- 現在のコードを破棄
- シンプルな実装から再構築
- デバッグしやすい構造で作り直し

### **アプローチ2: 段階的修正**
- イベントハンドリングの根本見直し
- `onChange={(e) => handleDigitChange(index, e.target.value)}`の修正
- 状態管理ロジックの簡素化

### **アプローチ3: 参考実装の活用**
- `RoomPasswordPrompt.tsx`の動作確認済みInput参考
- Chakra UI Inputコンポーネントベースで再実装

---

## 🎮 **成功の定義**

### **必須機能**
- [ ] 数字0-9が正常に入力できる
- [ ] 4桁入力後に自動でフォーカス移動
- [ ] Backspace・矢印キーでのナビゲーション
- [ ] 4桁ペースト機能

### **UI要件**
- [ ] ドラクエ風60x60pxボックス表示
- [ ] エラー時の赤いボーダー表示
- [ ] 角ばったデザインの維持

### **統合要件**
- [ ] CreateRoomModalでの正常動作
- [ ] パスワード暗号化処理との連携
- [ ] 既存バリデーションとの互換性

---

## 🚀 **期待される結果**

### **ユーザー体験**
- モダンゲーム風の直感的なパスワード入力
- ドラクエテーマとの完全統一
- エラー時の分かりやすいフィードバック

### **技術的成果**
- セキュリティ機能の保持
- 既存システムとの完全互換
- 保守しやすいコード品質

---

## 📞 **連絡・質問事項**

**実装者**: codex
**元担当**: Claude Code Agent
**プロジェクト責任者**: hr-hm

### **重要事項**
- 来月15日の発表期限は絶対
- 既存のパスワード暗号化機能は変更禁止
- ドラクエデザイン統一は必須要件

### **デバッグ支援**
- `console.md`に既存ログあり
- 開発サーバー: http://localhost:3001 で動作確認可能
- Firebase接続済み・動作環境準備完了

---

**🎯 実装頑張って！この4桁パスワードUIでプロジェクトが完成します！**

---
*Generated: 2025-09-26 by Claude Code Agent*
*Handoff to: codex*
*Priority: HIGH - Presentation deadline approaching*