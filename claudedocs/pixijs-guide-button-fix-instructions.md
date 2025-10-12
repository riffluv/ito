# PixiJS ガイドボタン配置修正 完全指示書

## 🎯 目的

PixiJSで実装したショートカットガイドボタン（SPACEキー、Eキー）の位置が完全に間違っているため、正しい位置に配置する。

---

## 📋 現状の問題

### 問題1: SPACEガイドの位置が左下に固定されている
- **現在**: 画面左下の隅に表示されている
- **正しい位置**: 画面下部の連想ワード入力フィールドの**真上**（矢印↓で入力欄を指す）

### 問題2: 配置計算ロジックが機能していない
- `PixiGuideButtons.tsx`の`updatePositions()`関数内の座標計算が間違っている
- PixiJSの座標系（左上原点、Y軸下向き）を正しく扱えていない

---

## 🎨 デザイン仕様（完成済み - 変更不要）

### ボタンデザイン ✅
- **背景色**: リッチブラック `rgba(8,9,15,0.92)`
- **枠線**: 太い白枠 `3px solid rgba(255,255,255,0.9)`
- **サイズ**: `220px × 46px`
- **テキスト**:
  - キー部分（`▶ SPACE`, `▶ E`）: 特別な色（ゴールド `0xfcda6c` / ブルー `0x6cc6fc`）
  - 説明部分（`で入力`, `/ ドラッグ`）: 白色 `0xffffff`
- **矢印**:
  - SPACEガイド: `▼`（下向き）
  - Eガイド: `▲`（上向き）

---

## 📍 正しい配置仕様

### 画面レイアウト（下から上に）

```
┌─────────────────────────────────────────┐
│                                         │
│           [ゼーの！] ボタン              │  ← せーの！ボタン（中央、オレンジ）
│                                         │
│              ↑ E / ドラッグ             │  ← Eガイド（中央）
│                                         │
│     [カードドック（手札）]               │  ← 画面下部、MiniHandDock
│                                         │
│  ▶ SPACE で入力                         │  ← SPACEガイド（左寄せ）
│       ↓                                 │
│  [連想ワード入力欄]                      │  ← 入力フィールド（黒背景）
└─────────────────────────────────────────┘
```

### 配置詳細

#### SPACEガイド
- **X座標**: 画面左端から `30px`（デスクトップ）/ `16px`（モバイル）
- **Y座標**: 連想ワード入力フィールドの**真上**
  - 入力フィールドのY座標を取得して、そこから`ガイド高さ + 矢印高さ + マージン`分上に配置
  - **重要**: 画面下部からの計算ではなく、**入力フィールドの位置を基準**にする

#### Eガイド
- **X座標**: 画面中央（`(width - 220) / 2`）
- **Y座標**: カードドックの**真上**
  - カードドック（MiniHandDock）のY座標を取得して、そこから`ガイド高さ + 矢印高さ + マージン`分上に配置
  - **せーの！ボタンより下**に配置（干渉しないように）

---

## 🔧 修正が必要なファイル

### `components/ui/pixi/PixiGuideButtons.tsx`

#### 現在の問題コード（78-115行目）

```typescript
const updatePositions = () => {
  // ... 中略 ...

  // ❌ この計算が完全に間違っている
  const spaceY = height - 149;  // 画面下部からの固定値計算
  const spaceX = 30;
  spaceGuide.position.set(spaceX, spaceY);

  const eY = height - 279;
  const eX = (width - GUIDE_WIDTH) / 2;
  eGuide.position.set(eX, eY);
};
```

#### 修正方針

**重要**: DOM要素の位置を直接参照するか、既知の固定値を使う

##### 方法1: DOM要素の位置を取得（推奨）

```typescript
const updatePositions = () => {
  // 連想ワード入力欄のDOM要素を取得
  const inputElement = document.querySelector('[data-testid="association-input"]') ||
                       document.querySelector('input[placeholder*="連想ワード"]');

  // カードドック要素を取得
  const cardDockElement = document.querySelector('[data-dock="mini-hand"]') ||
                          document.querySelector('.mini-hand-dock');

  if (inputElement && spaceGuide) {
    const inputRect = inputElement.getBoundingClientRect();
    // 入力欄の真上に配置
    const spaceY = inputRect.top - 60; // ガイド高さ46px + 矢印8px + マージン6px
    const spaceX = 30; // 左端から30px
    spaceGuide.position.set(spaceX, spaceY);
  }

  if (cardDockElement && eGuide) {
    const dockRect = cardDockElement.getBoundingClientRect();
    // カードドックの真上に配置
    const eY = dockRect.top - 60;
    const eX = (width - 220) / 2; // 中央配置
    eGuide.position.set(eX, eY);
  }
};
```

##### 方法2: 既知の固定レイアウト値を使用

プロジェクトのレイアウトを確認し、各要素の固定位置を使用：

```typescript
const updatePositions = () => {
  const width = window.innerWidth;
  const height = window.innerHeight;

  // 連想ワード入力欄: 画面最下部から約70-80px上
  // SPACEガイド: 入力欄の上（入力欄Y - 60px）
  const inputFieldY = height - 70; // 入力欄の位置
  const spaceY = inputFieldY - 60; // ガイド + 矢印 + マージン
  const spaceX = 30;
  spaceGuide.position.set(spaceX, spaceY);

  // カードドック: 画面下部から約150-180px上
  // Eガイド: カードドックの上（ドックY - 60px）
  const cardDockY = height - 150; // カードドックの位置
  const eY = cardDockY - 60;
  const eX = (width - 220) / 2;
  eGuide.position.set(eX, eY);
};
```

---

## 🧪 デバッグ方法

### 座標確認コンソールログ

```typescript
const updatePositions = () => {
  console.log('🎯 PixiJS Guide Button Positions:');
  console.log('Screen:', { width: window.innerWidth, height: window.innerHeight });

  // 位置計算
  const spaceX = 30;
  const spaceY = /* 計算結果 */;
  const eX = (width - 220) / 2;
  const eY = /* 計算結果 */;

  console.log('SPACE Guide:', { x: spaceX, y: spaceY });
  console.log('E Guide:', { x: eX, y: eY });

  spaceGuide.position.set(spaceX, spaceY);
  eGuide.position.set(eX, eY);
};
```

### DOM要素の位置確認

ブラウザコンソールで実行：

```javascript
// 連想ワード入力欄の位置
const input = document.querySelector('input[placeholder*="連想ワード"]');
console.log('Input position:', input?.getBoundingClientRect());

// カードドックの位置
const dock = document.querySelector('[class*="MiniHandDock"]');
console.log('Dock position:', dock?.getBoundingClientRect());
```

---

## ✅ 完成条件

- [ ] SPACEガイドが連想ワード入力欄の真上に表示される
- [ ] SPACEガイドの矢印↓が入力欄を指している
- [ ] Eガイドがカードドックの真上に表示される
- [ ] Eガイドの矢印↑がカードドックを指している
- [ ] 両方とも「せーの！」ボタンより下にある（干渉しない）
- [ ] リサイズ時も正しい位置を維持する

---

## 📝 補足情報

### 関連ファイル
- `components/ui/pixi/PixiGuideButtons.tsx` - 配置ロジック（要修正）
- `lib/pixi/GuideButton.ts` - ガイドボタンクラス（デザイン完成、修正不要）
- `app/rooms/[roomId]/page.tsx` - ゲームページ（ガイド使用箇所）

### PixiJS座標系の注意点
- 原点: 左上 `(0, 0)`
- X軸: 右に増加
- Y軸: **下に増加**（HTMLのCSSと同じ）
- `position.set(x, y)` で座標設定

### MiniHandDockの位置
- `components/ui/MiniHandDock.tsx` を参照
- 画面下部に固定配置されている
- レスポンシブ対応済み

### 連想ワード入力欄の位置
- `app/rooms/[roomId]/page.tsx` 内のInput要素
- 画面最下部に配置
- `bottom: 20px` などのスタイル

---

## 🚀 作業手順

1. **DOM要素の位置を確認**
   - ブラウザでゲーム画面を開く
   - コンソールで入力欄とカードドックの位置を確認

2. **updatePositions関数を修正**
   - DOM要素のBoundingRectを取得
   - 正しいY座標を計算（要素のtop - ガイド高さ - マージン）

3. **デバッグログで確認**
   - console.logで座標を出力
   - 画面上の実際の位置と比較

4. **微調整**
   - マージン値を調整して最適な配置にする

---

## 🎨 デザインは完璧なので触るな！

以下は**完成済み**なので絶対に変更しないこと：
- ✅ テキストの色分け（キー=特別色、説明=白）
- ✅ 矢印の向き（SPACE=↓、E=↑）
- ✅ HD-2D風のデザイン
- ✅ ボックスサイズとスタイル

**配置（X/Y座標）だけを修正すること！！！**

---

## 📸 参考画像

ユーザーが提供したスクリーンショットを参照：
- SPACEガイド: 左下の連想ワード入力欄の上
- Eガイド: 中央のカードドックの上
- 両方とも「ゼーの！」ボタンより下

---

## 💡 最終アドバイス

**画面下部からの固定値計算は諦めろ！**

DOM要素の実際の位置（`getBoundingClientRect()`）を使うか、
各要素のスタイル定義から正確な位置を計算すること。

現在の `height - 149` みたいな適当な計算では絶対に合わない。

Good luck! 🍀
