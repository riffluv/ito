# DragonQuestParty レイアウト安定化 完全修正指示書

## 🚨 現在の問題状況

### 問題の詳細
- **DragonQuestParty.tsx**で「決定」ボタンを押すと、**アバターとゲージバーが下にずれる**
- **連想ワード入力前後でレイアウトが動的に変化**している
- **皮肉にも、下にずれた後の方が見た目が美しく収まっている**
- 固定高さ`h="72px"`を設定済みだが、内部コンテンツが動的に変化

### 技術的背景
- **GSAP アニメーション実装済み** - カード提出時の黄色フラッシュ効果
- **3行レイアウト構造**: 名前行 + 連想ワード行 + ゲージバー行
- **Chakra UI v3** + CSS-in-JS併用
- **固定高さ試行済み**: `h="72px"`, `lineHeight`指定, `overflow="hidden"`

## 🔍 調査すべき箇所

### 1. レイアウトシフトの根本原因特定
```typescript
// 疑わしい箇所の調査
// File: components/ui/DragonQuestParty.tsx

// 第1行 (line 374-404)
<Box h="18px" mb="2px" display="flex" alignItems="center">
  // 名前 + ホストマーク

// 第2行 (line 407-422)
<Box h="14px" mb="2px" display="flex" alignItems="center">
  // 連想ワード表示

// 第3行 (line 425-450)
<Box display="flex" alignItems="center" gap={2}>
  // ゲージバー
```

### 2. チェックすべき競合要因

#### A. CSS-in-JSとChakra UI競合
```typescript
// 現在の設定 (line 328-334)
px="16px"
py="12px"
css={{
  cursor: canTransfer ? "pointer" : "default",
  backdropFilter: "blur(8px)",
  background: "linear-gradient(...)",
}}
```

#### B. 条件付きコンテンツ変化
```typescript
// 連想ワード表示ロジック (line 416-420)
{isSubmitted && hasClue
  ? `"${fresh.clue1.trim()}"`
  : hasClue
  ? "準備中..."
  : "---"}
```

#### C. フレックスボックス競合
```typescript
// 親コンテナ (line 372)
<Box flex={1} minW={0}>

// 各行のflex設定
display="flex" alignItems="center"
```

## 🎯 修正方針

### 1. 完全固定レイアウト実装
- **全行の高さを絶対固定**（動的変化を完全排除）
- **padding/margin の数値検証**
- **フレックスボックス設定の見直し**

### 2. 美しいレイアウトの採用
- **現在「下にずれた状態」が美しい**との報告
- この状態の**数値を測定**して正式採用
- **意図的にこのレイアウトに統一**

### 3. CSS競合の完全解消
- **Chakra UI props vs CSS-in-JS**の競合チェック
- **!important**が必要な箇所の特定
- **z-index, position**関連の競合調査

## 📋 実行手順

### Step 1: 現状分析
1. **ブラウザDevTools**で「決定」前後のレイアウト変化を詳細測定
2. **各行の実際の高さ**をピクセル単位で記録
3. **marginやpadding**の計算値を確認
4. **美しく見える状態の数値**を正確に取得

### Step 2: 根本原因特定
1. **CSS cascade**の順序チェック
2. **Chakra UIのdefault styles**との競合調査
3. **フレックスボックスのflex-grow/shrink**設定確認
4. **条件付きレンダリング**が引き起こすDOM変化の特定

### Step 3: 完全修正実装
1. **測定した美しいレイアウトを基準値**として採用
2. **全行を絶対固定値**で統一
3. **CSS-in-JSからChakra UI props**への完全移行
4. **ビルド&動作テスト**で検証

### Step 4: 検証項目
- [ ] 連想ワード入力前後でレイアウト不変
- [ ] 「決定」ボタン押下後でレイアウト不変
- [ ] アバター位置の完全固定
- [ ] ゲージバー位置の完全固定
- [ ] TypeScriptビルドエラーなし
- [ ] 視覚的美しさの保持

## 🔧 技術的ヒント

### CSS Debugging Commands
```bash
# Chrome DevTools Console
document.querySelectorAll('[data-player-id]').forEach(el => {
  console.log('Player card height:', el.offsetHeight);
  console.log('Computed styles:', getComputedStyle(el));
});
```

### 疑わしいCSS Properties
- `flex-basis`, `flex-grow`, `flex-shrink`
- `min-height`, `max-height` vs `height`
- `line-height` vs `fontSize`
- `box-sizing: border-box` vs `content-box`
- `transform`, `translate` による位置変化

### Chakra UI特有の確認事項
- `SystemStyleProps`の優先順位
- `responsive values`の影響
- `theme tokens`のdefault値
- `CSS reset`との競合

## 📄 関連ファイル

- **メインファイル**: `components/ui/DragonQuestParty.tsx` (line 374-450)
- **テーマ設定**: `theme/index.ts`, `theme/semantic/colors.ts`
- **UI tokens**: `theme/layout.ts`
- **アニメーション**: GSAP実装部分 (line 200-250付近)

## 🎯 成功条件

**「決定」ボタンを何度押しても、アバターとゲージバーが微動だにしない状態**

現在は技術的制約により解決困難。新しいアプローチでの根本解決を求む。

---

**重要**: この問題は単純な高さ指定では解決せず、CSS cascade、フレックスボックス設計、Chakra UI内部実装との深い競合が疑われる。表面的な修正ではなく、**レイアウトシステムの根本的見直し**が必要。