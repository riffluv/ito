# Claude用「AI感ゼロ」デザイン実装リファレンス  
**対象:** ドラゴンクエスト風オンライン数字カードゲーム / Next.js + Chakra UI v3 + GSAP / レトロRPG風ダークモード固定UI / 2–6人対戦（PC/スマホ）  
**目的:** Claude CodeがこのMDだけで**“AI臭”のない人間的デザイン**を着手・実装できるようにする。

> 本ガイドは、提示された調査観点（配色・余白/レイアウト・タイポ・シャドウ、インタラクション、情報設計、実装・アクセシビリティ）を**実装手順**に落としこんだものです。

---

## 0. 使い方（最短ルート）
1. **意図を書く（90秒）** — 画面/要素ごとに「機能優先度・雰囲気・参照元」を3行で記す。  
2. **トークンを決める（5分）** — 本ガイドの**色/余白/タイポ/モーション**の推奨値から“使うものだけ”を選び、`theme`に登録。  
3. **コンポーネントの骨格（10分）** — 「カード/ボタン/トースト/モーダル/ハブ（HUD）」の**レシピ**を流用して土台を置く。  
4. **人間味の注入（10分）** — “AI臭検知表”の**NG**を避けつつ、“人間化レバー”を最低3つ当てる。  
5. **UX通電（5分）** — GSAPで**意味のある動き**だけを最小限付与（初期/反応/完了）。  
6. **チェックアウト（5分）** — “Definition of Done”の**14項目**を満たす。

---

## 1. 原則（AI臭を消す4つの態度）
- **意図 > 均整**：完璧な左右対称/機械的均等は避け、**優先度に応じた非対称**で視線を導く。  
- **節度 > 盛り**：グラデ/影/ノイズは**一貫した光源と材質**の下で必要最小限。  
- **差分 > 反復**：状態・階層・意味に応じて**数値や筆圧を変える**（一律200ms禁止、半径8px統一禁止）。  
- **可読 > 装飾**：情報の理解速度を最優先。**文字・余白・コントラスト**で勝つ。

---

## 2. ビジュアル設計（トークンとレシピ）

### 2.1 配色（レトロRPG・ダーク固定）
**光源想定:** 画面上部やや左。**背景は寒色の深い闇**、**UIは温色の金属/革**でアクセント。

**推奨パレット（Hex / HSL）**
- `brand.navy` `#0F1A2B` / `hsl(212, 47%, 12%)` … キャンバス基調（闇）
- `brand.ink` `#0B0F16` / `hsl(215, 34%, 6%)` … さらに深い面（HUD土台）
- `brand.gold` `#E0C36E` / `hsl(45, 64%, 66%)` … 主アクセント（装飾/ボタン）
- `brand.crimson` `#B33A3A` / `hsl(0, 50%, 46%)` … 警告/強調
- `brand.teal` `#3A9FA1` / `hsl(182, 47%, 44%)` … 交互アクセント（リンク/選択）
- `bone` `#E9E4D0` / `hsl(45, 38%, 86%)` … 文字ハイライト/アイコン
- `muted` `#7C8594` / `hsl(215, 11%, 53%)` … 二次情報

**使い方ルール**
- **同時使用は最大3色**（基調1+アクセント1+補助1）。
- ゴールドは**成功/主ボタン/レア**に限定。常用禁止。
- 背景は**純黒NG（#000）**。最低でも`#0B0F16`以上の**深い青黒**に。  
- グラデは**1方向**のみ、**角度固定（-15°〜-25°）**。多用禁止。

**Chakra semanticTokens（抜粋）**
```ts
// theme/semantic-tokens.ts
export const semanticTokens = {
  colors: {
    'bg.canvas': { default: '#0B0F16' },
    'bg.surface': { default: 'rgba(255,255,255,0.03)' },
    'stroke.dim': { default: 'rgba(0,0,0,0.4)' },
    'text.primary': { default: '#E6E8EB' },
    'text.muted': { default: '#97A1B3' },
    'brand.navy': { default: '#0F1A2B' },
    'brand.gold': { default: '#E0C36E' },
    'brand.crimson': { default: '#B33A3A' },
    'brand.teal': { default: '#3A9FA1' },
  }
}
```

---

### 2.2 余白・レイアウト
- **ベースグリッド**: 8px系を基準にしつつ、**主役要素のみ±2px/±4pxでズラす**（例: 24 → 26px）。
- **比率**: 黄金比の**過度依存NG**。**1:1.2 / 1:1.4 / 1:1.6**の3比率を使い分け、**カード/手札/HUD**で差をつける。
- **群れの中の1点**: リストやカード列は、**1つだけ余白/高さ/角度**を変え**視線の起点**を作る（毎回同じではなく意味のある箇所）。
- **折返し**: モバイルでは**カード幅を優先**、HUDは下段にまとめ**チャットはスライドイン**。

**測定値（例）**
- カード間: 12px（密）/ 16px（標準）/ 20px（広）  
- 手札の端マージン: 10–14px（固定値禁止、画面幅に応じて3段階）  
- HUDセクション間: 18 / 22 / 26px（ランダムではなく**階層で切替**）

---

### 2.3 タイポグラフィ
- **役割ごとに差**: `H1/H2/H3/Body/Meta/Mono`を**倍率で固定しない**。  
- **推奨比率**:  
  - H1 = 22–24px（tracking -1%）  
  - H2 = 18–20px（tracking -0.5%）  
  - Body = 14–16px（tracking 0%）  
  - Meta = 12–13px（uppercase, 2% letter-spacing）  
  - Mono（数値/ログ）= 13–14px（等幅）
- **見出しのインク色**は`bone`寄り（完全白は発光しすぎ）。
- **フォント混植**: 見出しは角張り/レトロ感、本文は可読性優先。**2書体まで**。

**Chakra設定（抜粋）**
```ts
// theme/typography.ts
export const fonts = {
  heading: "var(--font-retro), system-ui",
  body: "var(--font-readable), system-ui",
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace"
}
export const textStyles = {
  h1: { fontSize: ['22px','24px'], letterSpacing: '-0.01em', fontWeight: 800 },
  h2: { fontSize: ['18px','20px'], letterSpacing: '-0.005em', fontWeight: 800 },
  body: { fontSize: ['14px','16px'], lineHeight: 1.5 },
  meta: { fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.02em' },
  mono: { fontFamily: 'mono', fontSize: ['13px','14px'] }
}
```

---

### 2.4 シャドウ・材質・アウトライン
- **光源**: 画面上部やや左。**すべての影/ハイライトがこの前提に一致**しているかをレビュー。
- **影は2層まで**（環境 + 接地）。**色: 影=ネイビー系 / ハイライト=ボーン色の透明**。  
- **インナーライン**: レトロ感の決め手。**内側1pxの暗線**（`rgba(0,0,0,0.45)`）。
- **アウトライン**: アクセント要素のみ**外側1px**、色は背景に応じた濃紺/金。

**影のプリセット**
```ts
export const shadows = {
  // うっすら浮かす
  'elev.1': '0 1px 0 rgba(255,255,255,0.05), 0 6px 14px rgba(0,0,0,0.45)',
  // 押しボタン（下押し）
  'press': 'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -2px 0 rgba(0,0,0,0.45)',
}
```

---

## 3. インタラクション & 動き（GSAP）

### 3.1 モーション原則
- **意味のない装飾禁止**。**状態の理解に寄与**しない動きは外す。  
- **一律200ms禁止**。**110ms / 180ms / 270ms / 360ms**の**4段階**を使い分け。  
- **入=速く/出=遅く**、**完了=短く**（勝利演出は別枠）。  
- **easing表**:  
  - **操作応答**: `cubic-bezier(.17,.67,.3,1)`  
  - **出現**: `cubic-bezier(.16,1,.3,1)`  
  - **退場**: `cubic-bezier(.4,0,.2,1)`（短め）

### 3.2 代表モーション（コード）
**カード選択（応答）**
```ts
import { gsap } from 'gsap';

export const selectCard = (el: HTMLElement) => {
  gsap.to(el, { 
    duration: 0.18, 
    y: -6, 
    scale: 1.02, 
    ease: 'cubic-bezier(.17,.67,.3,1)' 
  });
};
```

**カードめくり（状態遷移）**
```ts
export const flipCard = (front: HTMLElement, back: HTMLElement) => {
  const tl = gsap.timeline({ defaults: { ease: 'power2.out' }});
  tl.to(front, { rotateY: 90, duration: 0.18 })
    .set(front, { visibility: 'hidden' })
    .set(back, { visibility: 'visible' })
    .fromTo(back, { rotateY: -90 }, { rotateY: 0, duration: 0.27 });
  return tl;
};
```

**ターン終了（完了通知）**
```ts
export const pulseHUD = (el: HTMLElement) => {
  gsap.fromTo(el, { scale: 0.98 }, { scale: 1, duration: 0.11, repeat: 2, yoyo: true });
};
```

---

## 4. 情報設計（ゲーム特化）
- **優先順位**: ①現在のターン/手番 → ②自身の手札と出せる選択肢 → ③相手の状態 → ④履歴/ログ → ⑤チャット。  
- **手札表示**: **出せるカード**を**色/浮き/アウトライン**で明快に区別。出せないカードは**彩度-40%/透明度-10%**。  
- **盤面密度**: スマホは**1画面1目的**（対戦 → 選択 → 結果）の**3段階**。  
- **ログ**: **等幅/12–13px/2行まで**、詳細は折りたたみ。  
- **チュートリアル**: **操作1回で学べる**クエストを**3つ**用意（出す/パス/必殺）。

**通知設計**
- **トースト**: **2秒/1行/アイコン付き**、重ね禁止。  
- **モーダル**: **ターン外イベント**のみ。**ESC/外側クリックで閉じない**（誤操作防止）。  
- **インライン検証**: その場で**小さな赤/金**のヒント + **再入力で即消える**。

---

## 5. 実装（Chakra UI v3 / Next.js）

### 5.1 テーマ骨格
```ts
// theme/index.ts
import { extendTheme, ThemeConfig } from '@chakra-ui/react';
import { semanticTokens } from './semantic-tokens';
import { fonts, textStyles } from './typography';
import { components } from './recipes';
import { shadows } from './shadows';

const config: ThemeConfig = { initialColorMode: 'dark', useSystemColorMode: false };

export const theme = extendTheme({
  config,
  semanticTokens,
  fonts,
  textStyles,
  shadows,
  styles: { global: {
    'html, body': { bg: 'bg.canvas', color: 'text.primary' }
  }},
  components
});
```

### 5.2 コンポーネント・レシピ（抜粋）
```ts
// theme/recipes.ts
export const components = {
  Button: {
    baseStyle: { fontWeight: 800, letterSpacing: '0.01em' },
    sizes: {
      md: { h: 40, px: 16, rounded: '6px' },
      lg: { h: 44, px: 18, rounded: '8px' }
    },
    variants: {
      primary: {
        bg: 'brand.gold', color: 'bg.canvas', boxShadow: 'press',
        _hover: { filter: 'brightness(1.05)' },
        _active: { transform: 'translateY(1px)' },
        _disabled: { bg: 'rgba(224,195,110,0.4)', cursor: 'not-allowed' }
      },
      ghost: {
        bg: 'transparent', color: 'bone',
        _hover: { bg: 'rgba(255,255,255,0.04)' },
        _active: { bg: 'rgba(255,255,255,0.06)' }
      }
    },
    defaultProps: { size: 'md', variant: 'primary' }
  },
  Card: {
    baseStyle: {
      bg: 'bg.surface', position: 'relative',
      _before: { content: '""', position: 'absolute', inset: 0, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.45)', pointerEvents: 'none' }
    }
  },
  Toast: {
    baseStyle: { bg: 'brand.navy', color: 'bone', border: '1px solid', borderColor: 'stroke.dim' }
  },
  Modal: {
    baseStyle: {
      dialog: { bg: 'brand.navy', border: '1px solid', borderColor: 'stroke.dim', boxShadow: 'elev.1' }
    }
  }
};
```

### 5.3 レスポンシブ & A11y
- **ブレークポイント**: `sm=360, md=480, lg=768, xl=1024`（モバイル優先）。  
- **タッチ領域**: 最小44×44px。手札は**指1本**で選択可。  
- **コントラスト**: 文字/背景コントラスト**4.5:1以上**（Metaは3:1以上）。  
- **キーボード**: `Tab`移動順は**視線順**に一致。`Space/Enter`で主要操作。  
- **SR文言**: 必殺/ターン状態は**aria-live="polite"**で変化通知。

---

## 6. “AI臭”検知表（NGパターンと対策）
| 匂い | 典型 | 対策 |
|---|---|---|
| 一律な数値 | 余白=8/16/24固定、200ms固定 | 主役±2〜4pxズラし、110/180/270/360msの**4段階**で運用 |
| 既定シャドウ | `0 4px 16px rgba(0,0,0,.2)`連発 | **2層まで**・色は**ネイビー寄り**・**光源一貫** |
| 完全対称 | 全要素中央/均等 | **1点だけ**ズラす（高さ/角度/余白）= 視線の起点 |
| 角丸8px教 | 何もかも8px | 要素の**役割で半径**を変える（HUD=2/4、カード=6、モーダル=8） |
| グラデ過多 | 多方向/派手色 | **1方向/低コントラスト**、材質と整合 |
| 状態差が弱い | hoverとactiveの見分け不可 | **浮き/彩度/アウトライン**の**3点**で差分 |
| 無意味な動き | 常時ふわふわ | **目的**（応答/遷移/完了）に紐づく最小集合のみ |
| ジェネリックコピー | “Great! / Error!” | **世界観の語彙**で一貫（例:「会心！」「MP不足」） |

---

## 7. 人間化レバー（最低3つ選ぶ）
1. **非対称の意図配置**（1箇所だけ高さ/角度を変える）  
2. **階層別の影強度**（HUD弱/カード中/モーダル強）  
3. **内側1px線**で手作り感を足す  
4. **文字トラッキング**を文脈で微調整（-1%/0%/+2%）  
5. **色の制約**（3色ルール + ゴールドの節度）  
6. **モーションの4段階運用**（110/180/270/360ms）  
7. **世界観コピー**（トースト/ボタン/空状態の文体統一）  
8. **HUDの密度差**（重要セクションにだけ余白を+2〜4px）

---

## 8. テスト計画・計測
- **TTI操作時間**（ターン開始→カード選択）中央値を**1.2s以下**。  
- **誤操作率**（キャンセル含む）を**<2%**。  
- **可読率テスト**: 10人に**2秒**で「手番/出せるカード/残り枚数」を言わせる。正答率**>90%**。  
- **A/B**: ゴールド主ボタン vs ティール副ボタンで**完了率**/**所要時間**比較。

---

## 9. Definition of Done（14項目）
- [ ] 画面/要素の**意図3行**が記録されている  
- [ ] **3色ルール**を遵守  
- [ ] 主役要素の余白が**±2〜4px**で差別化  
- [ ] フォント役割が**H/Body/Meta/Mono**で分離  
- [ ] 影は**2層まで**、光源一貫  
- [ ] 内側1px線の適用（必要箇所）  
- [ ] `110/180/270/360ms`モーションのみ使用  
- [ ] **操作応答/遷移/完了**の3系統が実装  
- [ ] 出せないカードが**彩度-40%/透明度-10%**で区別  
- [ ] トーストは**2秒/1行/重ね無し**  
- [ ] モーダルは**ターン外**のみ、閉じ方制御済み  
- [ ] SR/キーボード/A11y要件を満たす  
- [ ] ログは**等幅/12–13px/2行**  
- [ ] “AI臭検知表”で**NG0件**

---

## 付録A: 画面テンプレ（骨格）
```tsx
// app/(game)/page.tsx
'use client';
import { Box, HStack, VStack, Button, Text } from '@chakra-ui/react';

export default function GameScreen() {
  return (
    <VStack spacing={0} align="stretch" minH="100dvh" bg="bg.canvas">
      {/* HUD */}
      <HStack px={22} py={14} justify="space-between" bg="brand.navy" borderBottom="1px solid" borderColor="stroke.dim">
        <Text textStyle="meta" color="bone">Turn: 3 / 10</Text>
        <HStack spacing={10}>
          <Button variant="ghost">ログ</Button>
          <Button>必殺</Button>
        </HStack>
      </HStack>

      {/* Board */}
      <Box flex="1" px={[10, 16, 22]} py={[12, 18, 22]}>
        <Box h="100%" bg="bg.surface" border="1px solid" borderColor="stroke.dim" boxShadow="elev.1" rounded="6px" />
      </Box>

      {/* Hand */}
      <HStack px={[10,16,22]} py={[10,12,14]} spacing={[12,16,20]} justify="center" borderTop="1px solid" borderColor="stroke.dim">
        {Array.from({ length: 5 }).map((_, i) => (
          <Box key={i} w={72} h={104} bg="bg.surface" rounded="6px" position="relative"
            _before={{ content: '""', position:'absolute', inset:0, boxShadow:'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.45)' }}
          />
        ))}
      </HStack>
    </VStack>
  );
}
```

---

## 付録B: 文体トーン（世界観）
- 成功: **「会心！」** / **「かいしんの一手！」**  
- 失敗: **「ミス！」** / **「MPが足りない…」**  
- 待機: **「ターンをためている…」**  
- レア: **「しあわせの数札を 手にいれた！」**

---

## 付録C: よくある落とし穴（FAQ）
**Q. なんとなく綺麗だけど“機械的”に見える。**  
A. **3色ルール/±2〜4pxズラし/4段階モーション**の3点を必ず適用。

**Q. 情報が多くゴチャつく。**  
A. **優先順位**を5レベルに分解し、**HUDの密度差**をつける。

**Q. レトロ感と可読性の両立が難しい。**  
A. 見出しだけレトロ、本文は可読。**完全白は避け骨色に**。

---

### 最後に
Claude、ここまでのルールを**意図 → トークン → レシピ → 人間化レバー → モーション → DoD**の順で適用してください。**盛りすぎず、節度ある“職人の一手”**で。

