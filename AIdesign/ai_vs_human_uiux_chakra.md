
# 「AIっぽさ」を消して“一流UI/UX”に仕上げる実践ガイド（**Chakra UI v3** 版）

最終更新: 2025-09-03

このドキュメントは、**AIっぽいUIの兆候**を整理し、**人の手による一流UI/UX**の特徴をまとめ、それらを **Chakra UI v3** で実装するためのレシピとチェックリストを提供します。  
（以前のTailwind/shadcn版の内容を**Chakra向けに最適化**）

---

## 1) 「AIが作ったっぽい」見た目の兆候
- **テンプレ既定値のまま**：デフォ配色/角丸/影/間隔が未調整で、どこかで見たUIに収束。
- **強グラデ/ガラス/ネオン頼み**：可読性/コントラストが落ちがち。
- **フラットすぎて押せるか不明**：ホバー/フォーカス/押下の状態差が弱い。
- **汎用3Dイラスト多用**：文脈のないビジュアルで埋める。
- **意味のないアニメ**：状態説明や注意誘導に寄与しない動き。
- **ジェネリックなコピー**：ブランドの声色になっていない文言。

---

## 2) 一流UI/UXデザイナーの仕事の特徴
- **メンタルモデル基点の情報設計**（ユーザーの言葉・期待に合うラベル/順序）。
- **原則→検証→反復**（ヒューリスティック/ガイドライン→ユーザビリティテスト）。
- **意味のあるマイクロインタラクション**（状態通知・エラー予防・完了の喜び）。
- **アクセシビリティ前提**（コントラスト、キーボード、フォーカス可視、Reduced Motion）。
- **“らしさ”のトークン化**（色・角丸・影・余白・モーションの数値化）。
- **批評の進め方がうまい**（観点・目標・制約で合意形成）。

---

## 3) Chakra実装レシピ（“AIっぽさ”回避）

### 3-1. 最初に **semanticTokens** を整える（独自性の土台）
```ts
// src/theme/index.ts
import { extendTheme, ThemeConfig } from "@chakra-ui/react";

const config: ThemeConfig = {
  initialColorMode: "light",
  useSystemColorMode: false,
};

const theme = extendTheme({
  config,
  semanticTokens: {
    colors: {
      bg:        { default: "white", _dark: "gray.900" },
      text:      { default: "gray.900", _dark: "gray.100" },
      primary:   { default: "teal.600", _dark: "teal.300" },
      muted:     { default: "gray.100", _dark: "gray.800" },
      ring:      { default: "teal.500", _dark: "teal.300" },
      danger:    { default: "red.600", _dark: "red.300" },
      success:   { default: "green.600", _dark: "green.300" },
    },
    radii: {
      brand: "6px", // 角丸を“揃えた個性”に
    },
    shadows: {
      elevation: "0 6px 16px rgba(0,0,0,0.08)", // ぼかし控えめ
    },
    sizes: {
      container: "1200px",
    },
  },
  styles: {
    global: {
      "@media (prefers-reduced-motion: reduce)": {
        "*": { animation: "none !important", transition: "none !important" },
      },
      ":focus-visible": {
        outline: "2px solid var(--chakra-colors-teal-500)",
        outlineOffset: "3px",
      },
      "html, body": { bg: "bg", color: "text" },
    },
  },
});
export default theme;
```

**ポイント**
- デフォの“紫〜灰”系から**色相をずらす**だけで既視感が消える。
- 影は**薄く・少なく**、**余白と階層**でメリハリを作る。
- radii/shadows/sizes を**一貫**させると“人の手感”が出る。

---

### 3-2. 状態差の強化（アフォーダンス回復）
```ts
// Button, Input, Link など代表系の状態差を設計
const theme = extendTheme({
  components: {
    Button: {
      baseStyle: {
        borderRadius: "brand",
        _focusVisible: { boxShadow: "0 0 0 3px var(--chakra-colors-teal-300)" },
        _active: { transform: "translateY(1px)" },
      },
      variants: {
        solid: {
          bg: "primary",
          color: "white",
          _hover: { filter: "brightness(1.05)" },
          _disabled: { opacity: 0.5, cursor: "not-allowed" },
        },
        subtle: {
          bg: "muted",
          _hover: { bg: { base: "gray.200", _dark: "gray.700" } },
        },
      },
    },
    Input: {
      variants: {
        outline: {
          field: {
            borderRadius: "brand",
            _focusVisible: {
              boxShadow: "0 0 0 3px var(--chakra-colors-teal-300)",
              borderColor: "teal.500",
            },
          },
        },
      },
    },
    Link: {
      baseStyle: {
        textDecoration: "none",
        _hover: { textDecoration: "underline" },
        _focusVisible: { boxShadow: "0 0 0 3px var(--chakra-colors-teal-300)" },
      },
    },
  },
});
```

---

### 3-3. 強グラデ/ガラスは**用途限定**
- 本文やフォームでは**使わない**。装飾帯/ヒーロー/ナビ背景など**低情報密度**の領域だけに。
- グラデは**2色 + 微変化**まで。角度はレイアウトの主軸に合わせる。

---

### 3-4. モーションは**意味ファースト**
- **出現/移動/解消**の3類型で**距離・時間**を統一（例: 180–220ms と 240–280ms の2レンジ）。
- `prefers-reduced-motion` で**静的代替**。  
- Chakraでアニメする場合は Framer Motion 連携を使い、**同じeasingを全体で共有**。

---

### 3-5. マイクロコピーの運用
- ラベルは**行動＋結果**（例「部屋を作成」→「新しい部屋を作って合流」）。
- エラーは**原因＋解決策**をセットに（例「通信に失敗→再試行」「手札が未選択→選んで確定」）。
- 口調は**ブランドの声色**（一人称/語尾/丁寧さ）を決めて統一。

---

### 3-6. 画像・イラストの方針
- **画面キャプチャ/実カード写真/手描きスケッチ**など文脈素材を混ぜる。
- AI画像は**文字・対称性・指**などの破綻をレタッチ。

---

## 4) 出荷前チェックリスト（Chakra版）

**見た目**
- [ ] `semanticTokens` の**色相/彩度**を既定から外した  
- [ ] `radii/shadows/spacing` の**一貫**がある  
- [ ] 強グラデ/ガラスは**装飾域のみ**に限定

**操作性**
- [ ] Button/Input/Link の **hover/focus/active/disabled** が明確  
- [ ] キーボード操作とフォーカス移動が**全フロー**で可能

**情報設計 & コピー**
- [ ] ラベル/順序が**ユーザーの言葉**に合致  
- [ ] 見出しと余白で**視線誘導**ができている  
- [ ] エラー文が**原因＋解決策**で統一

**アクセシビリティ**
- [ ] 背景と文字の**コントラストAA以上**  
- [ ] `prefers-reduced-motion` 対応  
- [ ] 画像/アイコンに**代替テキスト**あり

**モーション**
- [ ] 目的（理解/注意/手続き支援）がある動きのみ  
- [ ] 時間レンジ/イージングを**体系化**

**開発運用**
- [ ] トークン化（色/半径/影/モーション）済み  
- [ ] StorybookやProp表で**状態網羅**  
- [ ] E2Eで**キーボード操作**を1本でも担保

---

## 5) 「ito」向けUIヒント（Chakraで実装）
- **誤操作防止**：`useDisclosure` + `AlertDialog` で **選択→確定** の二段構え。  
- **ターン把握**：`Badge` と `Progress` で **現在の手番** と **残り時間** を常時表示。  
- **視線誘導**：`SimpleGrid` / `Grid` で **手札＞場札＞ターン＞チャット**の優先を固定。  
- **通知**：`useToast` を**控えめな位置/時間**で。重要イベントは `Alert`。  
- **観戦UI**：`Card` + `Accordion` で**直近イベントのハイライトログ**を別レイヤーに。

---

## 6) スニペット集

### 6-1. アクセシブルなフォーカスリング（全体）
```ts
styles: {
  global: {
    ":focus-visible": {
      outline: "2px solid var(--chakra-colors-teal-500)",
      outlineOffset: "3px",
    },
  },
}
```

### 6-2. Reduced Motion（全体）
```ts
styles: {
  global: {
    "@media (prefers-reduced-motion: reduce)": {
      "*": { animation: "none !important", transition: "none !important" },
    },
  },
}
```

### 6-3. 決定→確定の二段階（概念例）
```tsx
const { isOpen, onOpen, onClose } = useDisclosure();
const confirmAction = () => { /* 確定処理 */ onClose(); };

<Button onClick={onOpen}>この手で進行</Button>
<AlertDialog isOpen={isOpen} onClose={onClose}>
  <AlertDialogOverlay>
    <AlertDialogContent borderRadius="brand">
      <AlertDialogHeader>この手で確定しますか？</AlertDialogHeader>
      <AlertDialogBody>確定後は取り消せます（1手のみ）</AlertDialogBody>
      <AlertDialogFooter>
        <Button onClick={onClose} variant="subtle">戻る</Button>
        <Button onClick={confirmAction} colorScheme="teal">確定</Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialogOverlay>
</AlertDialog>
```

---


## まとめ
- **トークン調整→状態差→意味のあるモーション→A11y** の順で“AIっぽさ”を脱出。  
- 原則はフレームワーク非依存。Chakraでは **semanticTokens と component theme** を要に。  
- 合理・一貫・文脈の3点で、“人の手の仕上げ”に近づける。


