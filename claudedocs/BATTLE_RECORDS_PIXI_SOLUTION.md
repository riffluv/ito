# 🎯 Battle Records Pixi背景 - 解決策と次ステップ

## 📊 **現状の問題**

Battle Records (MVP Ledger) モーダルにPixi.jsで背景を描画する実装が**ほぼ完成**していますが、最後の問題が残っています：

### **症状**
1. ✅ **Pixi描画は成功している** - 赤い四角のデバッグ描画は正常に動作
2. ✅ **位置・サイズも正しい** - `usePixiLayerLayout`が正しく同期している
3. ❌ **アニメーション中**: ボックス全体が真っ赤に見える
4. ❌ **アニメーション後**: 黒いフィルターの下に赤い背景が薄く透けて見える

### **原因**
**オーバーレイ（`overlayRef`）の背景色がPixiの上に重なっている**

- オーバーレイの背景: `bg="rgba(8, 9, 15, 0.88)"` （行307）
- このダークな半透明背景が、Pixi背景の上に重なっている
- zIndex: `overlayRef` (120) > `PixiHudStage` (110)

---

## 🔧 **すでに完了した修正**

### 1. **zIndexの階層構造** ✅
```
overlayRef (zIndex: 120) - 最前面のオーバーレイ
  ├─ boardRef (zIndex: relative) - モーダル本体
  │   ├─ ヘッダー (zIndex: 20)
  │   ├─ テーブル (zIndex: 20)
  │   └─ フッター (zIndex: 20)
  └─ PixiHudStage (zIndex: 110) - 背景
      └─ Graphics (zIndex: -10)
```

### 2. **Pixi描画の位置調整** ✅
- `usePixiLayerLayout`から Container の `position.set()` を削除
- Graphics の `position.set(layout.x, layout.y)` で直接配置
- これにより、位置の二重適用問題を解決

### 3. **CSS背景の透明化** ✅
- `boardRef` の `bg`: `transparent`
- パーティメンバーの行の `bg`: `"rgba(0,0,0,0.3)"` → `"transparent"`
- ヘッダー/テーブル/フッターの `bg`: `transparent`

### 4. **Pixi v8 API対応** ✅
- `battleRecordsBackground.ts`の全描画コードを修正
- `graphics.rect().fill()` のメソッドチェーン形式に変更
- 各シェイプごとに個別に `fill()` を呼ぶ

---

## 🚨 **残っている問題と解決策**

### **問題: オーバーレイの背景がPixiを隠している**

**ファイル**: `components/ui/MvpLedger.tsx` 行302-310

```tsx
<Box
  ref={overlayRef}
  position="fixed"
  inset={0}
  zIndex={120}
  bg="rgba(8, 9, 15, 0.88)"  // ← この黒い背景がPixiの上に！
  backdropFilter="blur(6px)"
  onClick={onClose}
>
```

### **解決策A: オーバーレイのzIndexを下げる**

PixiHudStageより下に配置する：

```tsx
<Box
  ref={overlayRef}
  position="fixed"
  inset={0}
  zIndex={100}  // 120 → 100 (PixiHudStageより下)
  bg="rgba(8, 9, 15, 0.88)"
  backdropFilter="blur(6px)"
  onClick={onClose}
>
```

**そして、PixiHudStageのzIndexを調整**：

`components/ClientProviders.tsx` 行32:
```tsx
<PixiHudStage zIndex={105}>  // 110 → 105
```

**新しい階層**:
```
overlayRef (100) - 背景オーバーレイ
PixiHudStage (105) - Pixi背景
boardRef (relative) - モーダル本体（CSS要素 zIndex: 20）
```

### **解決策B: オーバーレイの背景をPixi側で描画**

オーバーレイの`bg`を削除し、Pixi側でフルスクリーンの背景を描画：

1. **オーバーレイの背景を削除**:
```tsx
<Box
  ref={overlayRef}
  position="fixed"
  inset={0}
  zIndex={120}
  bg="transparent"  // rgba(8, 9, 15, 0.88) → transparent
  backdropFilter="blur(6px)"
  onClick={onClose}
>
```

2. **Pixiで2つのレイヤーを描画**:
   - Layer 1: フルスクリーンの暗い背景（`rgba(8, 9, 15, 0.88)`）
   - Layer 2: モーダルボックスの装飾的な背景（現在の `battleRecordsBackground.ts`）

3. **`MvpLedger.tsx`の修正** (行273-286):
```tsx
// 背景を再描画
graphics.clear();

// Graphics の position を絶対座標で設定
graphics.position.set(layout.x, layout.y);

// Layer 1: フルスクリーン背景（オーバーレイの代わり）
graphics
  .rect(-layout.x, -layout.y, window.innerWidth, window.innerHeight)
  .fill({ color: 0x08090f, alpha: 0.88 });

// Layer 2: モーダルの装飾背景
import("pixi.js").then((pixi) => {
  drawBattleRecordsBoard(pixi, graphics, {
    width: layout.width,
    height: layout.height,
    dpr: layout.dpr,
  });
});
```

---

## 📝 **推奨する実装手順**

### **ステップ1: 解決策Aを試す** (簡単・リスク小)

1. `components/ui/MvpLedger.tsx` 行306を修正:
   ```tsx
   zIndex={100}  // 120 → 100
   ```

2. `components/ClientProviders.tsx` 行32を修正:
   ```tsx
   <PixiHudStage zIndex={105}>  // 110 → 105
   ```

3. ブラウザで確認

### **ステップ2: 解決策Aが失敗したら、解決策Bを試す**

1. オーバーレイの`bg`を`transparent`に
2. Pixiでフルスクリーン背景を追加描画
3. `backdropFilter`の効果を確認（Pixiと干渉する可能性あり）

### **ステップ3: デバッグコードの削除**

成功したら、以下のデバッグコードを削除：

**`components/ui/MvpLedger.tsx`**:
- 行252-257: `console.log("[DEBUG] usePixiLayerLayout setup:", ...)`
- 行268-271: `console.log("[DEBUG] Pixi layout:", ...)` など
- 行279: `console.log("[DEBUG] Drawing red rect at position:", ...)`
- 行286: `console.log("[DEBUG] Red rect drawn successfully, ...)`

**現在のデバッグコード** (行282-284):
```tsx
// デバッグ: シンプルな赤い四角を直接描画（Pixi v8 API）
graphics
  .rect(0, 0, layout.width, layout.height)
  .fill({ color: 0xff0000, alpha: 1.0 }); // 完全不透明の赤
```

**これを削除して、実際の背景描画に置き換える**:
```tsx
// Pixi.js を動的インポート（型のために）
import("pixi.js").then((pixi) => {
  drawBattleRecordsBoard(pixi, graphics, {
    width: layout.width,
    height: layout.height,
    dpr: layout.dpr,
  });
});
```

### **ステップ4: 最終確認**

1. ✅ Battle Recordsモーダルを開く
2. ✅ アニメーション中も背景が正しく表示される
3. ✅ アニメーション後、ドラクエ風の背景が見える（太い白枠、ゴールドコーナー装飾）
4. ✅ パーティメンバーの行がクリアに見える
5. ✅ テキストが読みやすい
6. ✅ MVP投票ボタンが正しく動作する

---

## 🗂️ **関連ファイル一覧**

### **修正が必要なファイル**
1. `components/ui/MvpLedger.tsx` - メインのモーダルコンポーネント
   - 行306: overlayRef の zIndex
   - 行252-286: デバッグコードの削除
   - 行282-284: 赤い四角を実際の背景に置き換え

2. `components/ClientProviders.tsx` - PixiHudStage の zIndex
   - 行32: PixiHudStage の zIndex 調整

### **すでに完成しているファイル**
1. ✅ `lib/pixi/battleRecordsBackground.ts` - 背景描画関数（Pixi v8対応済み）
2. ✅ `components/ui/pixi/PixiHudStage.tsx` - Pixi Provider
3. ✅ `components/ui/pixi/usePixiLayerLayout.ts` - DOM同期フック（Container position削除済み）

---

## 🎨 **完成イメージ**

### **期待される見た目**
- **外周の深い影** - 多層グロー効果
- **太い白枠（3px）** - ドラクエの象徴的な枠
- **ゴールドのコーナー装飾** - L字型の装飾
- **内側の繊細な二重枠**
- **リッチブラック背景** (`0x08090f`)
- **内側シャドウ** - 上下に影
- **外枠の立体感** - ハイライト + シャドウ

### **背景の色**
- メイン背景: `rgba(8, 9, 15, 0.92)` (`0x08090f`)
- 外周グロー: `0x0a0d1f`, `0x0d1128`, `0x0f1530`
- 白枠: `0xffffff` (alpha: 0.92)
- ゴールド: `0xffd700` (alpha: 0.75)

---

## ⚠️ **重要な注意事項**

### **zIndexの階層を守る**
- オーバーレイ < PixiHudStage < CSS要素（ヘッダー/テーブル/フッター）
- CSS要素は必ず `zIndex: 20` を維持

### **Pixi v8 API を使用**
- `graphics.rect().fill()` のメソッドチェーン形式
- `Graphics#beginFill` と `Graphics#endFill` は廃止

### **位置設定**
- Container の `position.set()` は使わない
- Graphics の `position.set(layout.x, layout.y)` で直接配置

### **アニメーションとの競合**
- GSAPアニメーション中もPixi背景が正しく追従するか確認
- `usePixiLayerLayout`が`requestAnimationFrame`で連続更新している

---

## 🐛 **トラブルシューティング**

### **問題: まだ背景が見えない**
→ ブラウザ開発者ツール (F12) で確認:
1. Elements タブで `<canvas>` 要素を探す
2. Canvas の `z-index` を確認
3. Canvas の `width` と `height` を確認
4. Console タブで `[DEBUG]` ログを確認

### **問題: 背景が二重に見える**
→ Container と Graphics の両方で `position.set()` していないか確認

### **問題: 位置がずれている**
→ `usePixiLayerLayout.ts` の Container position設定がコメントアウトされているか確認

### **問題: アニメーション後に消える**
→ GSAPアニメーションの `onComplete` コールバックで何か破棄していないか確認

---

## 📦 **現在のデバッグ状態**

### **デバッグログが有効**
```tsx
console.log("[DEBUG] usePixiLayerLayout setup:", ...);
console.log("[DEBUG] Pixi layout:", layout);
console.log("[DEBUG] Graphics parent:", graphics.parent?.label);
console.log("[DEBUG] Graphics position:", graphics.position.x, graphics.position.y);
console.log("[DEBUG] Graphics worldTransform:", ...);
console.log("[DEBUG] Drawing red rect at position:", ...);
console.log("[DEBUG] Red rect drawn successfully, ...);
```

### **デバッグ描画が有効**
```tsx
// 完全不透明の赤い四角
graphics
  .rect(0, 0, layout.width, layout.height)
  .fill({ color: 0xff0000, alpha: 1.0 });
```

**これらは成功後に削除すること！**

---

## 🚀 **次のエージェントへ**

このドキュメントを読んでから、以下の順序で作業してください：

1. **解決策Aを試す** (zIndexの調整)
2. **成功したらデバッグコードを削除**
3. **赤い四角を実際の背景に置き換え**
4. **動作確認**（アニメーション中・後）
5. **失敗したら解決策Bを試す**

頑張ってください！🎯
