# Chakra UI v3 フルスクリーン型 UI への完全移行指示（Agent向け）

本書は「center型（中央寄せ）レイアウト」から「フルスクリーン型アプリシェル」へ移行するための完全指示です。先に骨格（App Shell）を確立し、その上にモックの見た目を段階適用する方針です。Chakra UI v3 の System/トークン/レシピに準拠します。

---

## ゴール（Why/What）
- ブラウザ全体を常時活用し、どの解像度でも破綻しない三層構造「上（操作）/中（共有+場）/下（自分）」を実現する。
- スクロールと余白の基盤を安定化してから、モックの見た目（配色・影・角丸・演出）を段階的に反映できる状態にする。
- Chakra UI v3（System+トークン+レシピ）の流儀で再設計し、拡張・差分適用を容易にする。

非ゴール（Out of scope）
- ゲームロジックやFirestore更新の仕様変更。
- 一度に全画面のビジュアルを完成させること（見た目は骨格確定後に段階適用）。

---

## 参照（一次情報・ソース）
- Chakra UI Docs: Getting Started
  - https://chakra-ui.com/docs/getting-started
- Chakra UI Docs: Theming（v3 System 概要・トークン）
  - https://chakra-ui.com/docs/theming
- Chakra UI Docs: Components（`Box`/`Stack`/`Grid`/`Button` など）
  - https://chakra-ui.com/docs/components
- Chakra UI Docs: Layout（`Grid`/`Flex` レイアウト）
  - https://chakra-ui.com/docs/layout
- Chakra UI Docs: ScrollArea
  - https://chakra-ui.com/docs/components/scroll-area
- Chakra UI Docs: Accessibility
  - https://chakra-ui.com/docs/accessibility
- Chakra UI GitHub（v3の実装や議論の参照元）
  - https://github.com/chakra-ui/chakra-ui

注: v3 の System/semantic tokens/recipes は上記の Theming/Components 各節に分散。構文は下記の実装セクションの通り。

---

## 成功条件（DoD）
- ルーム画面は常に 100dvh を占有し、以下の 3×3 グリッドを満たす。
  - 行: `56px（header） / 1fr（center） / 160px（hand）`
  - 列: `280px（left） / 1fr（center） / 340px（right）`
  - エリア: `'header header header' / 'left center right' / 'hand hand hand'`
- 縦スクロールは `center` と `right` のみで発生し、`header`/`hand` は常に表示。
- 主要操作（連想更新/出す）は `hand` に集約。視線誘導は「上→中→下」で自然。
- 余白・角丸・境界線はトークンで統一。ブレークポイント（sm/md/lg）で破綻しない。
- 二重スクロール/不自然な空白/切れがない。

---

## 設計原則（骨格 → 装飾）
- 中央寄せのラッパー（`Container maxW`等）は排除し、最上位をフルスクリーングリッド化。
- 固定高/固定幅は「header/hand/left/right」に限定。`center` は柔軟（1fr）。
- スクロール多重禁止。`overflowY="auto"` は `center`/`right` のみ。中間コンテナは `minH={0}` を付けて伸縮を許容。
- レスポンシブは `md` を境に `3カラム→1カラム（header/center/hand）`。右（チャット）は後日ボトムシート化。

---

## 実装タスク（手順）

### 1) アプリシェルのグリッド化（ルーム画面）
- `app/rooms/[roomId]/page.tsx` の最上位ルートを以下に置換（擬似コード）：

```tsx
import { Box, Stack } from "@chakra-ui/react";

export default function RoomPage() {
  return (
    <Box
      h="100dvh"
      display="grid"
      gridTemplateRows={{ base: "56px 1fr auto", md: "56px 1fr 160px" }}
      gridTemplateColumns={{ base: "1fr", md: "280px 1fr 340px" }}
      gridTemplateAreas={{
        base: `'header' 'center' 'hand'`,
        md: `'header header header' 'left center right' 'hand hand hand'`,
      }}
      gap={3}
      p={{ base: 2, md: 3 }}
    >
      <Box gridArea="header">{/* TopBar */}</Box>
      <Stack gridArea="left" overflowY="auto" minH={0}>{/* Participants/Options */}</Stack>
      <Box gridArea="center" overflowY="auto" minH={0}>{/* Shared + Table */}</Box>
      <Box gridArea="right" overflowY="auto" minH={0}>{/* Chat */}</Box>
      <Box gridArea="hand">{/* HandBar */}</Box>
    </Box>
  );
}
```

- `components/site/Header.tsx` は `/rooms` では非表示（全画面をUIに割当て）。

### 2) スロットへの既存要素の挿入
- `header`: TopBar（部屋名＋お題変更/配布/開始/リセット等）。
- `left`: Participants/Options（サブ情報）。
- `center`: 上=SharedBoard（お題/演出/ガイド）、中=Table（`PlayBoard`/`SortBoard`）。内部に `templateRows="auto 1fr auto"` を使っても良い。
- `right`: ChatPanel（`height="100%"` で親の `overflowY` に任せる）。
- `hand`: HandBar（自分の数字・連想・主要操作）。

### 3) スクロールの最終確認
- `center`/`right` のみ縦スクロール。`header`/`hand` はスクロールしない。
- 子コンテナに不必要な `overflow: hidden` を付けない。中間には `minH={0}` を付与。

### 4) テーマ（System/トークン）整理
- `theme/index.ts` は v3 の System で統一（例）：

```ts
import { createSystem, defaultConfig } from "@chakra-ui/react";

export const system = createSystem(defaultConfig, {
  preflight: true,
  theme: {
    tokens: {
      breakpoints: { sm: { value: "30em" }, md: { value: "48em" }, lg: { value: "62em" }, xl: { value: "80em" } },
      fonts: {
        heading: { value: "Inter, ui-sans-serif, system-ui, ..." },
        body: { value: "Inter, ui-sans-serif, system-ui, ..." },
      },
      radii: { xs: { value: "4px" }, sm: { value: "6px" }, md: { value: "8px" }, lg: { value: "12px" }, xl: { value: "16px" }, full: { value: "9999px" } },
      shadows: { card: { value: "0 4px 12px rgba(0,0,0,0.12)" }, cardHover: { value: "0 6px 18px rgba(0,0,0,0.18)" } },
      colors: {
        brand: { 400: { value: "#38B2AC" }, 500: { value: "#319795" } },
        orange: { 400: { value: "#FF8F3D" }, 500: { value: "#FF7A1A" } },
        table: { bg: { value: "#0F1116" }, slot: { value: "#1A1F2A" } },
        card: { bg: { value: "#12161D" }, border: { value: "#2A3240" } },
      },
    },
    semanticTokens: {
      colors: {
        canvasBg: { value: { base: "gray.50", _dark: "#0B0D10" } },
        panelBg: { value: { base: "white", _dark: "#11151A" } },
        panelSubBg: { value: { base: "gray.50", _dark: "#161A20" } },
        fgDefault: { value: { base: "gray.800", _dark: "#E8EDF4" } },
        fgMuted: { value: { base: "gray.600", _dark: "#A9B4C2" } },
        borderDefault: { value: { base: "gray.200", _dark: "whiteAlpha.200" } },
        tableBg: { value: { base: "gray.50", _dark: "{colors.table.bg}" } },
        tableSlot: { value: { base: "gray.100", _dark: "{colors.table.slot}" } },
        cardBg: { value: { base: "white", _dark: "{colors.card.bg}" } },
        cardBorder: { value: { base: "gray.200", _dark: "{colors.card.border}" } },
        accent: { value: { base: "{colors.brand.500}", _dark: "{colors.brand.400}" } },
      },
    },
  },
});
export default system;
```

- `ChakraProvider` は `value={system}` を使用（v3）。
- `colorPalette`（v3プロップ）は、ボタンやバッジの配色を「意味」で指定（例: `colorPalette="orange"`）。

### 5) アクセシビリティ（最低限）
- 共有スクリーン/テーブルに `role="region"` と `aria-label` を付与。
- 状態変更（開始/成功/失敗）は `aria-live` で告知（`polite`/`assertive` を適切に）。
- キーボード操作で主要ボタンに到達可。フォーカスリングはトークンで見やすく。

### 6) レスポンシブ確認
- `md` 下で 1カラム化（`header`→`center`→`hand`）。
- 右（チャット）は後続PRでボトムシート（`Drawer`/`BottomSheet`相当）に切替予定。

---

## モック寄せ（骨格確定後の段階）
- パネル：角丸/影/境界線/背景グラデのトーン統一（トークン優先、必要箇所は`style`許容）。
- テーブル：破線エリア/並びライン/差し込みガイドの視覚化。
- カード：74×104px・角丸・影・順序バッジ・ラベル。`card/cardHover`影トークンを活用。
- モーション：配布（手札へ流入）/吸着/成功発光/失敗シェイク（Framer Motion併用可）。

---

## チェックリスト（運用）
- [ ] ルートが `100dvh grid` になっている
- [ ] `header/hand` が固定、`center/right` のみ `overflowY:auto`
- [ ] `minH={0}` を中間に付与してスクロール切れがない
- [ ] コンテナ二重スクロールなし
- [ ] 主要操作は `hand`、補助情報は `left/right` に収まっている
- [ ] トークンで配色/角丸/影が統一されている
- [ ] `md` 下でも破綻しない

---

## 付記（拡張性のための指針）
- 変更多発箇所（配色・角丸・影・余白）はトークン化し、直接値は極力局所に限定。
- 汎用レイアウト（TopBar/HandBar/SharedBoard/Table/Chat）は独立コンポーネント化。
- 先に構図（密度/余白/階層）を整え、装飾（色/影/グラデ）は最後に一括適用。
- 大きな変更は「AppShell → 各スロット → ビジュアル」の順にPRを分割しレビュー容易化。

---

## 備考
- 既存の center型ラッパー（`Container maxW` 等）が残っていると、横幅制限・余白の副作用で破綻します。最上位のグリッドに統一してください。
- ルーム以外の画面（ロビー等）は段階対応で構いません。まずはもっとも破綻が起きやすいルーム画面から移行します。

***
本指示に従えば、フルスクリーン型の堅牢なアプリシェルが先に確立され、その後のモック寄せ・演出の導入が安全かつ素早く行えます。
***

