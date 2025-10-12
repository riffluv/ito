# 🚨 Battle Records (MVP Ledger) Pixi背景 修正タスク - 緊急

## 📋 **現状の問題**

`MvpLedger`コンポーネント（Battle Records / PARTY RECORDSモーダル）のPixi背景が**真っ暗**で、パーティーメンバーの行（テーブルの内容）が表示されない。

**現在の状態**:
- ✅ PixiHudStageは正しく動作している（赤いテスト四角は表示された）
- ✅ Pixiの描画関数`drawBattleRecordsBoard`は呼ばれている（ログ確認済み）
- ✅ PixiHudStageはProviderツリーに追加済み（`components/ClientProviders.tsx`）
- ✅ `usePixiLayerLayout`は正しく動作している（ログ確認済み）
- ❌ **背景が真っ暗で、CSS要素（パーティーメンバーの行）が見えない**

## 🎯 **達成すべき目標**

**ドラクエ+オクトパストラベラー風**の重厚感のある背景デザイン:

1. **外周の深い影**（多層グロー）
2. **太い白枠**（3px）
3. **ゴールドのコーナー装飾**（L字型）
4. **内側の繊細な二重枠**
5. **リッチブラック背景**
6. **内側シャドウ**（上下）
7. **外枠の立体感**（ハイライト+シャドウ）

**重要**: CSS要素（パーティーメンバーの行）が**Pixi背景の上に表示される**こと！

## 🔍 **問題の原因（推測）**

### 1. **zIndexの問題**
Pixi背景がCSS要素の**上**に来ている可能性が高い。

**現在の設定**:
- `PixiHudStage`: `zIndex: 150`（`ClientProviders.tsx:32`）
- Pixi Graphics: `zIndex: 10`（`MvpLedger.tsx:238`）
- CSS要素: `zIndex: 1`（`MvpLedger.tsx:319`など）

**問題**: PixiHudStageのzIndexが150で、モーダル全体（`zIndex: 120`）より高いため、Pixiが最前面に来てしまっている！

### 2. **背景の透明度問題**
- 背景のalpha値が高すぎて、真っ黒に見える
- レイヤーが重なりすぎている

## 🛠️ **修正手順（最優先）**

### ✅ **ステップ1: zIndexを正しく設定する**

#### 1-1. PixiHudStageのzIndexを下げる
**`components/ClientProviders.tsx:32`**
```tsx
// 現在
<PixiHudStage zIndex={150}>

// ↓ 修正: モーダルのzIndex(120)より下にする
<PixiHudStage zIndex={110}>
```

#### 1-2. Pixi GraphicsのzIndexを最背面にする
**`components/ui/MvpLedger.tsx:238`**
```tsx
// 現在
const graphics = new Graphics();
graphics.zIndex = 10;

// ↓ 修正: 最背面にする
graphics.zIndex = -10;
```

#### 1-3. CSS要素のzIndexを上げる
**`components/ui/MvpLedger.tsx:319, 364, 372`**

すべてのコンテンツ要素（ヘッダー、テーブル、フッター）に:
```tsx
position="relative"
zIndex={20}  // 現在は1 → 20に上げる
```

具体的には:
- 行319: ヘッダー `<Flex>` に `zIndex={20}`
- 行364: テーブル `<Box>` に `zIndex={20}`
- 行372: フッター `<Flex>` に `zIndex={20}`

### ✅ **ステップ2: Pixi Containerのzindexを設定**

**`components/ui/MvpLedger.tsx:58-61`**
```tsx
// 現在
const pixiContainer = usePixiHudLayer(
  "battle-records-board",
  { zIndex: 115 }
);

// ↓ 修正: もっと低く
const pixiContainer = usePixiHudLayer(
  "battle-records-board",
  { zIndex: 5 }  // CSS要素より低く
);
```

### ✅ **ステップ3: 背景の透明度を調整**

**`lib/pixi/battleRecordsBackground.ts:60`**
```typescript
// 現在
graphics.rect(0, 0, width, height);
graphics.fill({ color: 0x08090f, alpha: 0.98 });

// ↓ 修正: もっと透明に
graphics.fill({ color: 0x08090f, alpha: 0.92 });
```

## 🧪 **デバッグ方法**

### 1. ブラウザ開発者ツール
1. **Elements**タブでPixiの`<canvas>`を探す
2. 位置、zIndex、opacityを確認
3. **Computed**タブで`z-index`の値を確認

### 2. CSS要素の確認
1. パーティーメンバーの行要素を選択
2. `z-index`と`position`を確認
3. `opacity`が0になっていないか確認

### 3. テスト用コード
`lib/pixi/battleRecordsBackground.ts`の最初に追加:
```typescript
// テスト: 半透明の緑の四角（CSS要素が見えるか確認）
graphics.rect(0, 0, width, height);
graphics.fill({ color: 0x00ff00, alpha: 0.3 });
return; // ここで終了
```

→ これで**緑の半透明背景**が表示され、その**上にパーティーメンバーの行が見える**はず！

## 📝 **修正完了後の作業**

### ⚠️ **必須: デバッグログの削除**

以下のファイルから`console.log`を**すべて削除**:

#### `components/ui/MvpLedger.tsx`
- 行242: `console.log("[MvpLedger] Graphics created, zIndex:", graphics.zIndex);`
- 行258: `console.log("[MvpLedger] Pixi layout update:", layout);`
- 行268: `console.log("[MvpLedger] Background drawn:", layout.width, "x", layout.height);`

#### `lib/pixi/battleRecordsBackground.ts`
- 行37: `console.log("[drawBattleRecordsBoard] START:", { width, height, dpr });`
- 行49: `console.log("[drawBattleRecordsBoard] Layer 1 drawn");`

### ✅ **動作確認**

1. Battle Recordsモーダルを開く
2. **背景が表示される**（ドラクエ+オクトパス風）
3. **パーティーメンバーの行が見える**（NO, なかま, 連想語, 数字, MVP列）
4. **白枠とゴールドのコーナー装飾が見える**
5. **内側シャドウと立体感がある**
6. **テーブルの行がクリック/ホバーできる**（MVP投票ボタンが動作する）

## 🔗 **関連ファイル**

- `components/ui/MvpLedger.tsx` - モーダル本体（zIndex調整が必要）
- `components/ClientProviders.tsx` - PixiHudStageのzIndex調整
- `components/ui/pixi/PixiHudStage.tsx` - Pixi Provider
- `components/ui/pixi/usePixiLayerLayout.ts` - DOM同期フック
- `lib/pixi/battleRecordsBackground.ts` - 背景描画関数

## 💡 **重要なヒント**

### zIndexの階層構造
```
モーダルオーバーレイ (zIndex: 120)
  ├─ CSS要素 (zIndex: 20) ← 最前面
  └─ Pixi背景 (zIndex: 5) ← 最背面
```

PixiHudStage全体のzIndex(110)は、モーダル(120)より低くする！

### Portalの影響
`MvpLedger`は`<Portal>`を使用しているため、通常のReactツリーの外にレンダリングされる。zIndexの調整が非常に重要！

### GSAP アニメーション
モーダルは右からスライドインするアニメーションがある。Pixiコンテナが正しく追従しているか確認（すでにOK）。

## 🎨 **元のデザイン参考**

以前のCSS実装（これと同じ見た目をPixiで再現する）:
```css
bg: "rgba(8, 9, 15, 0.9)"
border: "3px solid rgba(255,255,255,0.9)"
boxShadow: "複数の影"
```

---

## 🚨 **最優先タスク**

**1. zIndexを修正する**（上記ステップ1）
**2. テストして、CSS要素が見えるか確認**
**3. 背景の透明度を調整**
**4. デバッグログを削除**

---

**🔥 緊急度: 最高**
**⏱️ 優先度: 最優先**
**😤 ユーザーの期待: ドラクエ+オクトパス風のかっこいい背景 + パーティーメンバーが見える！**

頑張ってください! 🚀
