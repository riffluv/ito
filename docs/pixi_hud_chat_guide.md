# チャット欄 PixiHUD化 - 完全実装指示書

> **🎯 このドキュメントを読んだら即座に実装を開始すること**
>
> この指示書だけで実装が完了できるように設計されている。
> 他のドキュメントを参照する必要はない。

## タスク概要

チャット欄（`MinimalChat` / `ChatPanelImproved`）にPixiJS背景を導入する。
オクトパストラベラー風のHD-2D感を維持しつつ、テキスト選択やスクロールなどDOM機能はそのまま残す。

**作業時間の目安**: 30-45分

**成果物**:
1. `lib/pixi/chatPanelBackground.ts` - 新規作成
2. `components/ui/ChatPanelImproved.tsx` - 修正
3. 動作確認完了

---

## 現状の構造

```
MinimalChat (トグルボタン + パネル)
├─ ChatPanelImproved (メインUI)
│   ├─ メッセージリスト（ScrollableArea）
│   │   └─ ChatMessageRow × N
│   └─ 入力フォーム
│       ├─ Input（テキスト入力）
│       └─ AppButton（送信）
```

**既存の背景** (CSS):
- `bg="rgba(8,9,15,0.95)"`
- `border="3px solid rgba(255,255,255,0.9)"`
- 立体感のある`boxShadow`

---

## PixiHUD化の方針

### 維持すべきもの
- メッセージの**テキスト選択・コピー**
- 入力欄の**フォーカス・IME対応**
- スクロールの**自動追従**
- Firebase購読の**リアルタイム更新**

### Pixi化するもの
- 背景パネル（リッチブラック + 白枠 + 内側の光沢）
- 外周のグロー（淡い影）
- ベゼル（立体感の演出）

---

## 🚀 実装手順（この順番で作業すること）

### ステップ1: 背景描画関数の作成

**ファイル**: `lib/pixi/chatPanelBackground.ts` （新規作成）

**作業内容**: 以下のコードをそのままコピーして新規ファイルを作成する

```typescript
import type * as PIXI from "pixi.js";
import { drawPanelBase } from "./panels/drawPanelBase";

export interface ChatPanelBackgroundOptions {
  width: number;
  height: number;
  dpr?: number;
}

/**
 * チャットパネルのPixi背景
 *
 * オクトパストラベラー風のHD-2Dパネル:
 * - リッチブラック背景（深み）
 * - 太い白枠（3px）
 * - 淡い外周グロー（控えめ）
 * - 内側の繊細なハイライト
 */
export function drawChatPanelBackground(
  pixi: typeof PIXI,
  graphics: PIXI.Graphics,
  options: ChatPanelBackgroundOptions
): void {
  const { width, height } = options;

  graphics.clear();

  drawPanelBase(graphics, {
    width,
    height,
    glow: [
      { padding: 8, color: 0x08090f, alpha: 0.5 },
    ],
    background: { color: 0x08090f, alpha: 0.95 },
    border: { color: 0xffffff, alpha: 0.9, width: 3 },
    bezel: {
      thickness: 1,
      highlight: { color: 0xffffff, alpha: 0.2 },
      shadow: { color: 0x000000, alpha: 0.3 },
    },
    innerHighlights: [
      {
        orientation: "horizontal",
        position: "start",
        inset: 3,
        thickness: 1,
        color: 0xffffff,
        alpha: 0.12,
      },
      {
        orientation: "vertical",
        position: "start",
        inset: 3,
        thickness: 1,
        color: 0xffffff,
        alpha: 0.12,
      },
    ],
  });
}
```

**ポイント:**
- グローは**1層のみ**（チャットは控えめ）
- 背景のalphaは`0.95`（メッセージが読みやすく）
- 内側ハイライトは**淡く細く**（HD-2D感）

---

### ステップ2: ChatPanelImprovedの修正

**ファイル**: `components/ui/ChatPanelImproved.tsx`

#### 2-1. ファイル冒頭のimport部分に追加

**場所**: 既存のimport文の最後に追加

```typescript
import { usePixiHudLayer } from "@/components/ui/pixi/PixiHudStage";
import { usePixiLayerLayout } from "@/components/ui/pixi/usePixiLayerLayout";
import * as PIXI from "pixi.js";
import { drawChatPanelBackground } from "@/lib/pixi/chatPanelBackground";
```

#### 2-2. ChatPanel関数内にPixi関連のrefを追加

**場所**: `export function ChatPanel({ ... }) {` の直後、既存のuseRefの近く

**追加するコード**:
```typescript
  // Pixi HUD レイヤー（モーダル背景用）
  const chatRef = useRef<HTMLDivElement>(null);
  const pixiContainer = usePixiHudLayer("chat-panel", {
    zIndex: 15,
  });
  const pixiGraphicsRef = useRef<PIXI.Graphics | null>(null);
```

#### 2-3. Pixi背景の初期化useEffectを追加

**場所**: 既存のuseEffectの後ろ（playerMeta定義の直前あたり）

**追加するコード**:
```typescript
  // Pixi背景の描画とDOM同期
  useEffect(() => {
    if (!pixiContainer) {
      // Pixiコンテナがない場合はリソース破棄
      if (pixiGraphicsRef.current) {
        pixiGraphicsRef.current.destroy({ children: true });
        pixiGraphicsRef.current = null;
      }
      return;
    }

    // Graphicsオブジェクトを作成
    const graphics = new PIXI.Graphics();
    graphics.zIndex = -10; // 最背面に配置
    pixiContainer.addChild(graphics);
    pixiGraphicsRef.current = graphics;

    // クリーンアップ
    return () => {
      if (pixiGraphicsRef.current) {
        pixiGraphicsRef.current.destroy({ children: true });
        pixiGraphicsRef.current = null;
      }
    };
  }, [pixiContainer]);
```

#### 2-4. DOM同期のusePixiLayerLayoutを追加

**場所**: 上記のuseEffectの直後

**追加するコード**:
```typescript
  // DOM要素とPixiコンテナの位置・サイズ同期
  usePixiLayerLayout(chatRef, pixiContainer, {
    disabled: !pixiContainer,
    onUpdate: (layout) => {
      const graphics = pixiGraphicsRef.current;
      if (!graphics || layout.width <= 0 || layout.height <= 0) {
        return;
      }

      graphics.clear();
      graphics.position.set(layout.x, layout.y);
      drawChatPanelBackground(PIXI, graphics, {
        width: layout.width,
        height: layout.height,
        dpr: layout.dpr,
      });
    },
  });
```

#### 2-5. JSX部分の修正（return文内の`<Box>`）

**場所**: `return ( <Box` の部分

**修正前**:
```typescript
    <Box
      h="100%"
      maxH="300px"
      w="100%"
      maxW="400px"
      display="grid"
      gridTemplateRows="minmax(0,1fr) auto"
      overflow="hidden"
      minH={0}
      // ドラクエ風統一デザイン
      bg="rgba(8,9,15,0.95)"
      border="3px solid rgba(255,255,255,0.9)"
      borderRadius={0}
      boxShadow="0 8px 32px rgba(0,0,0,0.8), inset 0 1px 2px rgba(255,255,255,0.1)"
      position="relative"
      _before={{
        content: '""',
        position: "absolute",
        top: "-3px",
        left: "-3px",
        right: "-3px",
        bottom: "-3px",
        bg: "linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.05))",
        borderRadius: 0,
        zIndex: -1,
      }}
    >
```

**修正後**:
```typescript
    <Box
      ref={chatRef}
      data-pixi-target="chat-panel"
      h="100%"
      maxH="300px"
      w="100%"
      maxW="400px"
      display="grid"
      gridTemplateRows="minmax(0,1fr) auto"
      overflow="hidden"
      minH={0}
      // PixiHUD化: 背景を透明に
      bg="transparent"
      border="3px solid rgba(255,255,255,0.9)"
      borderRadius={0}
      boxShadow="none"
      position="relative"
      zIndex={20}
    >
```

**重要**: `_before`疑似要素を削除すること

---

### ステップ3: 動作確認

#### 3-1. ビルド確認

```bash
npm run build
npm run typecheck
```

エラーが出ないことを確認。

#### 3-2. 開発サーバー起動

```bash
npm run dev
```

#### 3-3. ブラウザで確認

1. ゲームルームに入る
2. チャットトグルボタン（💬）をクリック
3. チャットパネルが開く

**確認ポイント**:
- リッチブラック背景が表示される
- 太い白枠（3px）が表示される
- 外周に淡いグローが見える
- メッセージのテキスト選択ができる
- 入力欄にフォーカスできる
- チャット送信が動作する

#### 3-4. DevToolsで確認

1. F12でDevToolsを開く
2. Elements タブで `<canvas>` 要素を探す
3. チャットパネルのサイズに合わせてCanvasが配置されているか確認

---

## デザイン仕様（HD-2D感）

### 色定義
- **リッチブラック**: `0x08090f` (alpha: 0.95)
- **白枠**: `0xffffff` (alpha: 0.9, width: 3px)
- **グロー**: `0x08090f` (alpha: 0.5, padding: 8px)
- **ハイライト**: `0xffffff` (alpha: 0.12)
- **シャドウ**: `0x000000` (alpha: 0.3)

### レイヤー構造
```
1. 外周グロー（1層・淡く）
2. リッチブラック背景（深みのある黒）
3. 太い白枠（3px・くっきり）
4. ベゼル（上下左右の光沢と影）
5. 内側ハイライト（水平・垂直の微光）
```

### 既存UIとの調和
- Settings Modal: シンプル版（グロー2層）
- Battle Records: 重厚版（グロー3層 + ゴールド装飾）
- **Chat Panel**: 控えめ版（グロー1層・装飾なし）← バランス重視

---

## 注意事項

### DOM機能の維持
- メッセージの**テキスト選択**はDOMのまま
- 入力欄の**フォーカス・IME**はDOMのまま
- スクロールの**自動追従ロジック**は変更なし
- Firebase購読の**リアルタイム更新**は変更なし

### パフォーマンス
- チャットの開閉時にPixiリソースを**確実に破棄**
- `usePixiLayerLayout`の`disabled`で不要時は更新停止
- `ResizeObserver`は`PixiHudStage`側で一元管理

### デバッグ
- `data-pixi-target="chat-panel"`を`<Box>`に付与（識別用）
- DevToolsで`<canvas>`の位置を確認
- コンソールエラーがないか確認

---

## テストチェックリスト

### 機能確認
- [ ] チャット開閉でPixi背景が正しく表示・破棄される
- [ ] メッセージが追加されても背景が追従する
- [ ] メッセージのテキスト選択・コピーができる
- [ ] 入力欄でIME入力ができる
- [ ] 送信ボタンがクリックできる
- [ ] スクロールの自動追従が動作する

### 視覚確認
- [ ] リッチブラック背景が表示される
- [ ] 太い白枠（3px）が表示される
- [ ] 外周に淡いグローが見える
- [ ] 内側に微妙なハイライトが見える
- [ ] 既存のCSS版と比べて違和感がない

### パフォーマンス
- [ ] チャット開閉時にメモリリークがない
- [ ] `npm run build`でエラーが出ない
- [ ] `npm run typecheck`が通る

---

## 将来の拡張

### オプション機能
- メッセージ送信時のPixiエフェクト（控えめな光）
- 新着メッセージの淡い光の演出
- スクロール位置に応じた背景の微妙な変化

ただし、これらは**必須ではない**。
まずは基本的な背景のPixiHUD化を完成させること。

---

## 完成イメージ

```
┌─────────────────────────────┐
│  [Pixi背景: リッチブラック]  │ ← 深みのある黒（alpha: 0.95）
│  ┌─────────────────────┐   │
│  │                     │   │ ← 太い白枠（3px）
│  │  [メッセージリスト]  │   │ ← DOM（テキスト選択可能）
│  │   • プレイヤーA: ...│   │
│  │   • プレイヤーB: ...│   │ ← スクロール可能
│  │                     │   │
│  ├─────────────────────┤   │
│  │ [入力欄]  [送信]   │   │ ← DOM（フォーカス・IME対応）
│  └─────────────────────┘   │
└─────────────────────────────┘
 ↑ 外周に淡いグロー（8px、alpha: 0.5）
 ↑ 内側に微妙なハイライト（alpha: 0.12）
```

オクトパストラベラーのUIのように、**深みと繊細さ**を両立させる。

---

## ⚠️ トラブルシューティング

### 問題: 背景が表示されない

**原因と対処**:
1. `PixiHudStage`が`app/rooms/[roomId]/page.tsx`に追加されているか確認
2. `chatRef`が正しく`<Box>`に設定されているか確認
3. DevToolsで`<canvas>`要素が存在するか確認
4. `pixiContainer`が`null`でないか確認（console.logで確認）

### 問題: ビルドエラー

**よくあるエラー**:
- `drawPanelBase is not defined` → `lib/pixi/panels/drawPanelBase.ts`が存在するか確認
- `usePixiHudLayer is not defined` → import文が正しいか確認
- TypeScript型エラー → `PIXI.Graphics`の型が正しいか確認

### 問題: チャットが開かない

**確認事項**:
- 既存の機能を壊していないか確認
- `MinimalChat`の修正は最小限にすること
- `ChatPanelImproved`のロジックを変更しないこと

---

## ✅ 完了チェックリスト

作業完了前に必ず確認すること:

### コード確認
- [ ] `lib/pixi/chatPanelBackground.ts`が作成されている
- [ ] `ChatPanelImproved.tsx`に4つのimportが追加されている
- [ ] `chatRef`, `pixiContainer`, `pixiGraphicsRef`が定義されている
- [ ] 2つのuseEffectが追加されている
- [ ] `usePixiLayerLayout`が追加されている
- [ ] `<Box>`の`ref={chatRef}`が設定されている
- [ ] `<Box>`の`bg="transparent"`に変更されている
- [ ] `<Box>`の`boxShadow="none"`に変更されている
- [ ] `_before`疑似要素が削除されている

### 動作確認
- [ ] `npm run build`が成功する
- [ ] `npm run typecheck`が成功する
- [ ] チャットが開く
- [ ] Pixi背景が表示される
- [ ] メッセージ送信ができる
- [ ] テキスト選択ができる
- [ ] チャットを閉じるとPixiリソースが破棄される（メモリリークなし）

### 視覚確認
- [ ] リッチブラック背景が表示される
- [ ] 太い白枠（3px）が表示される
- [ ] 外周に淡いグローが見える
- [ ] 内側に微妙なハイライトが見える
- [ ] 既存のCSS版と比べて違和感がない

---

## 📝 作業完了後の引き継ぎ

### 必須作業

1. **`docs/pixi_hud_next_steps.md`を更新**
   - チャット欄をPixiHUD化完了リストに追加

2. **動作確認スクリーンショット**
   - チャット開いた状態のスクリーンショットを撮影
   - `docs/screenshots/`に保存（任意）

3. **コミット**
   - コミットメッセージ: `feat: チャット欄をPixiHUD化`
   - 変更ファイル:
     - `lib/pixi/chatPanelBackground.ts` (新規)
     - `components/ui/ChatPanelImproved.tsx` (修正)
     - `docs/pixi_hud_next_steps.md` (更新)

---

## 📚 参考情報

### 既存のPixiHUD実装
- `components/SettingsModal.tsx` - シンプル版（参考）
- `components/ui/MvpLedger.tsx` - 重厚版（参考）
- `components/ui/InputModal.tsx` - 入力モーダル版（参考）

### 共通パネル描画
- `lib/pixi/panels/drawPanelBase.ts` - パネル描画の共通関数
- `lib/pixi/settingsModalBackground.ts` - Settings用背景
- `lib/pixi/battleRecordsBackground.ts` - BattleRecords用背景

### PixiHUDシステム
- `components/ui/pixi/PixiHudStage.tsx` - Pixi Applicationの管理
- `components/ui/pixi/usePixiLayerLayout.ts` - DOM同期フック

---

## 🎯 最終確認

この指示書に従って実装すれば、チャット欄のPixiHUD化は完了します。

**実装時間の目安**: 30-45分

何か問題が発生した場合は、トラブルシューティングセクションを参照してください。

**それでは実装を開始してください！** 🚀
