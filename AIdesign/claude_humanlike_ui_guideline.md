# Claudeエージェント用 人間味UI/UX実装ガイドライン
**プロジェクト**: ドラクエ風（HD-2D発展可能性あり）オンライン数字カードゲーム  
**技術**: Next.js + Chakra UI v3 + GSAP（ダークモード固定）  
**目的**: *AIっぽさ（均質・既定値依存・無意味な装飾）を排除し、一流ゲームUI/UXデザイナーが手で作り込んだような質感* をコードで再現すること。Claude（coding agent）は本ドキュメントを常時参照して実装すること。

---

## 0) 結論（要点サマリ）
- **既定値に依存しない**: 余白・角丸・影・配色はすべて *意図* を持ってトークン化し、ピクセル単位で微調整する。  
- **視線誘導と情報階層**: 重要要素＞準重要＞補助をレイアウトとコントラストで明確化。左右完全対称は避け、**軽い非対称**でリズムを作る。  
- **レトロ×現代**: ドット/ピクセル質感・輪郭の立つシャドウ・ノイズテクスチャでレトロ感、可読性・コントラスト・a11yで現代性。  
- **意味のある動き**: アニメは状態理解を助けるためだけに。GSAPで物理感・時間軸を制御、短く・中断可能に。  
- **アクセシブル**: コントラスト、フォーカス、aria-live、キーボード/タッチ操作は必須。  
- **一貫性**: すべてトークンとコンポーネント変種（variant）で再利用。直書き禁止。

---

## 1) Claudeエージェントへの「システム指示」テンプレート
> 以下を**毎タスクの最上位指示**として適用すること（貼り付け可）。

```
あなたは一流のゲームUI/UXデザイナー兼フロントエンド実装者です。
次の原則を厳守して、Next.js + Chakra UI v3 + GSAP で実装してください。

- 既定値禁止: spacing/size/radius/shadow/color はテーマの design tokens のみ使用。直値/px 直書きは禁止（必要時は tokens に追加）。
- レトロRPG×ダーク: 質感はピクセル/ドット風。シャドウはブラー最小、1–2pxオフセットの段積みで輪郭を立てる。背景に微ノイズ。
- 情報階層: 最重要 > 重要 > 補助をレイアウト・対比・サイズで即座に判別可能にする。完全対称を避け、軽い非対称で視線誘導。
- モーションは意味重視: 状態遷移（選択→確定、無効、ターン切替）にのみ短いアニメ。GSAP timeline を用い、速度は 120–240ms を中心。
- a11y: WCAG AA。フォーカス可視化、aria-live で状態告知、キーボード操作/タッチ目標 44px。
- コード品質: コンポーネント化、variant化、コメントで「意図」を明記。PR前にチェックリストを自己審査。
```

---

## 2) デザイン言語（Design Tokens）
**目的**: 「人が選んだ」ニュアンスを tokens に固定し、全体へ一貫適用。

### 2.1 推奨パレット（例）
- `obsidian.900 = #0E0F13` 背景（純黒ではなく青みの黒で眼精疲労軽減）
- `ink.800 = #141722` パネル/カード背景
- `slimeBlue.500 = #3AB0FF` アクセント（スライムの青）
- `heroGold.400 = #D9B44A` ハイライト（勇者の金）
- `berryRed.400 = #D96A6A` アラート/エラー
- `mist.300 = #AAB0C0` 低優先テキスト
- `pure.100 = #F2F5FB` 主要テキスト/アイコン（背景上で十分なコントラスト）

> ※ 値は例。実プロジェクトの目視で微調整し semanticTokens へ。

### 2.2 余白・角丸・影・境界
- **space**: `2, 4, 6, 8, 12, 16, 20, 24`（わずかに**奇数**を混ぜリズム感）  
- **radii**: `xs=2, sm=4, md=6, lg=8`（レトロ感を壊す大きな丸角は避ける）  
- **shadows（ピクセル風）**  
  - `px1`: `0 1px 0 rgba(0,0,0,0.6)`  
  - `px2`: `1px 1px 0 rgba(0,0,0,0.7), 0 2px 0 rgba(0,0,0,0.5)`  
  - blur最小、段積みで厚みを出す  
- **borders**: 1px の濃淡を上下で変え、**上:明/下:暗**の疑似エンボス

### 2.3 タイポグラフィ
- 見出し: ファンタジー調 Display（日本語は可読ゴシック／角ゴ）  
- 数値/ログ: 等幅 or ピクセルフォント（letter-spacing を少し詰める）  
- 階層: `display-xl, h1, h2, h3, body, caption, mono` を textStyles で定義

---

## 3) Chakra テーマ雛形（抜粋）
```ts
// theme/index.ts
import { extendTheme } from '@chakra-ui/react';

export const theme = extendTheme({
  config: { initialColorMode: 'dark', useSystemColorMode: false },
  fonts: {
    heading: `'Zen Kaku Gothic New', system-ui, sans-serif`,
    body: `'Zen Kaku Gothic New', system-ui, sans-serif`,
    mono: `'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, monospace`,
  },
  colors: {
    obsidian: { 900: '#0E0F13' },
    ink: { 800: '#141722' },
    slimeBlue: { 500: '#3AB0FF' },
    heroGold: { 400: '#D9B44A' },
    berryRed: { 400: '#D96A6A' },
    mist: { 300: '#AAB0C0' },
    pure: { 100: '#F2F5FB' },
  },
  radii: { xs: '2px', sm: '4px', md: '6px', lg: '8px' },
  space: { 1: '2px', 2: '4px', 3: '6px', 4: '8px', 5: '12px', 6: '16px', 7: '20px', 8: '24px' },
  shadows: {
    px1: '0 1px 0 rgba(0,0,0,0.6)',
    px2: '1px 1px 0 rgba(0,0,0,0.7), 0 2px 0 rgba(0,0,0,0.5)',
  },
  semanticTokens: {
    colors: {
      bgCanvas: 'obsidian.900',
      bgPanel: 'ink.800',
      textPrimary: 'pure.100',
      textMuted: 'mist.300',
      accent: 'slimeBlue.500',
      highlight: 'heroGold.400',
      danger: 'berryRed.400',
    },
  },
  components: {
    Button: {
      baseStyle: {
        fontWeight: 700,
        _focusVisible: { boxShadow: '0 0 0 2px rgba(58,176,255,0.6)' },
      },
      variants: {
        dq: {
          bg: 'bgPanel',
          color: 'textPrimary',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: 'px2',
          px: 5, py: 3, // tokensのみ（= space 5→12px 等）
          _hover: { transform: 'translateY(-1px)', bg: 'rgba(20,23,34,0.94)' },
          _active: { transform: 'translateY(0)', boxShadow: 'px1' },
          _disabled: { opacity: 0.5, cursor: 'not-allowed' },
        },
      },
      defaultProps: { variant: 'dq', size: 'md' },
    },
    Card: {
      baseStyle: {
        bg: 'bgPanel',
        color: 'textPrimary',
        border: '1px solid rgba(255,255,255,0.10)',
        boxShadow: 'px1',
        rounded: 'sm',
      },
    },
    Tooltip: {
      baseStyle: { bg: 'ink.800', color: 'textPrimary', border: '1px solid rgba(255,255,255,0.1)' },
    },
  },
});
```

---

## 4) レイアウト原則（ゲーム特化）
- **視線誘導**: 盤面中央（場）＞自分の手札（下部）＞対戦相手の状態（上部）＞サブ情報（サイド）  
- **軽い非対称**: 右寄りにターンインジケータ、左にチャット要約など、微差のズレで動的バランス  
- **密度最適化**: 盤面は密度↑、HUDは密度↓。コンテナ毎に space を変え、均一密度を避ける  
- **モバイル**: 縦一列＋下部「手札カルーセル」。タップ目標 ≥ 44px。親指リーチで主要操作を下側へ  

---

## 5) インタラクション & モーション（意味中心）
### 5.1 時間とイージング（指標）
- **微フィードバック**: 120–180ms / `power2.out`  
- **状態遷移**: 180–240ms / `power3.inOut`  
- **結果演出**: 240–360ms（スキップ可）  
- **原則**: ユーザー操作をブロックしない。**Esc/タップ**で中断可能に。

### 5.2 代表アニメ（GSAP例）
**カードめくり（表裏）**
```tsx
import { gsap } from 'gsap';
import { useLayoutEffect, useRef } from 'react';

export const FlipCard = ({ children, isFaceUp }: { children: React.ReactNode; isFaceUp: boolean }) => {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const tl = gsap.timeline({ defaults: { duration: 0.18, ease: 'power2.out' } });
    tl.to(el, { rotateY: 90 })
      .set(el, { attr: { 'data-face': isFaceUp ? 'up' : 'down' } })
      .to(el, { rotateY: 0 });
    return () => tl.kill();
  }, [isFaceUp]);
  return (
    <div ref={ref} style={{ transformStyle: 'preserve-3d', perspective: 800 }}>
      {children}
    </div>
  );
};
```

**無効操作のシェイク**
```ts
gsap.fromTo(target, { x: -2 }, { x: 2, repeat: 3, yoyo: true, duration: 0.06, ease: 'power1.inOut' });
```

**自ターンの強調（HUDの淡い明滅）**
```ts
gsap.to(hudEl, { opacity: 0.85, repeat: -1, yoyo: true, duration: 0.8, ease: 'sine.inOut' });
```

> すべて **短い/抑制的** に。見た目以上に「状態の理解」を助けること。

---

## 6) 状態表現 & フィードバック
- Hover: 浮き上がり（-1px, shadow強化）＋ツールチップ（遅延200ms）  
- Focus: フォーカスリング（accent 2px）＋キー操作可能表示  
- Active: 押し込み（shadow弱化/translateY(0)）  
- Disabled: 彩度↓・反応無し・ツールチップで理由提示（任意）  
- トースト: 成功（heroGold）、警告（berryRed）、情報（slimeBlue）で **文脈的** メッセージ

---

## 7) アクセシビリティ & レスポンシブ
- コントラスト: 文字と背景で 4.5:1 以上。低優先情報は彩度/不透明度で抑制  
- フォーカス可視化: _focusVisible を必ず実装（キーボード利用前提）  
- aria-live: ターン開始/終了、勝敗確定は `aria-live="polite"` で告知  
- キーボード: Tab順序論理化。手札は ←→ で移動、Enterで出す（可能なら）  
- モバイル: 親指リーチ優先。主要操作を画面下に。ドラッグハンドルを視覚表示。

---

## 8) コンポーネント実装ガイド（例）
### 8.1 カード
- 枠: 上1px明・下1px暗で疑似エンボス  
- 背景: `bgPanel` + 微ノイズ（CSS filter / 背景画像）  
- 数字: `mono`、textShadow で2.5D縁取り（blur≒0, offset 1–2px）

### 8.2 ボタン（variant: `dq`）
- 角丸: `sm` 固定（過度な丸角は避ける）  
- ホバー: -1px 浮き、影強化  
- アクティブ: 押し込み（shadow弱化）、音は任意

### 8.3 HUD（Player/Turn）
- 重要数値を大きく（display/h1）。ラベルは `textMuted`  
- 自ターン時に淡く脈動。相手ターンで自分の手札UIを 0.85 に減光

---

## 9) ページ/構成の基本
> **全ページの提出は不要**。本ガイドで全体に適用可能。必要に応じて各ページ（例: /lobby, /room/[id], /play, /result）に特化ルールを追記する。

- `/_app.tsx`: ChakraProvider + テーマ適用 + 全局スタイル  
- `/components`: `CardItem`, `PlayerHUD`, `TurnIndicator`, `DQButton`, `Panel`, `Toast`  
- `/pages`: `index`, `lobby`, `room/[id]`, `play`, `result`（推奨例）  
- レイアウト: 共通 `GameLayout`（背景、枠、装飾）で統一

---

## 10) 「AIっぽさ」検出・除去チェックリスト
- [ ] spacing が Chakra 既定値のまま（均一）になっていないか  
- [ ] 角丸が大き過ぎ/全要素同一になっていないか  
- [ ] シャドウが汎用 drop-shadow/blur 過多になっていないか  
- [ ] 配色が高彩度・高明度で安易に調和し過ぎていないか  
- [ ] 完全左右対称の機械的レイアウトになっていないか  
- [ ] テキスト階層が平板（全部同じサイズ/ウェイト）になっていないか  
- [ ] 無意味なアニメ・長過ぎる遷移がないか  
- [ ] トークン未使用の直書きスタイルが混入していないか

---

## 11) Claude用タスク実行テンプレート
**実装タスク（例: 手札UIの刷新）**
1. 要件要約 → 重要/補助情報の優先度を箇条書き。  
2. デザイントークン参照 → 必要なら tokens を追加・更新（PRに含める）。  
3. UIスケッチ → コンポーネント分割、軽い非対称、密度設計を文面で記述。  
4. 実装 → Chakra components + variant。既定値禁止。  
5. モーション → GSAP timeline（120–240ms）、Esc/タップで中断可。  
6. a11y → フォーカス、aria、キーボード/タッチ。  
7. 自己レビュー → §10 チェックリストで確認。  
8. 出力 → 変更点サマリ、意図コメント、今後の改善メモ。

**PR説明テンプレ**
```
### 目的
（ユーザーの状態理解を速くするため等）

### 変更点
- tokens: space 追加、accent 調整
- components: CardItem, DQButton 追加/更新
- motion: Flip/Invalid/Turn の timeline 実装

### デザイン意図
（非対称配置で視線誘導／ピクセル風影でレトロ質感 等）

### a11y
コントラスト比, フォーカスリング, キーボード操作, aria-live

### 既知の課題 / 次の一手
（モバイルの親指リーチ補強 等）
```

---

## 12) Definition of Done（完成条件）
- 既定値依存ゼロ。**すべて tokens or variants 経由**でスタイル適用  
- 情報階層が 2–3秒で判別可能（第三者レビューで確認）  
- 主要操作のタップ目標 ≥ 44px、キーボード操作可、コントラスト AA  
- アニメは短く意味がある。中断可能。  
- UI密度が場/手札/HUDで適切に差別化  
- 主要画面（ロビー/対戦/結果）でテーマ一貫

---

## 13) 追補: 実装ヒント
- 影は **段積み**（例: `1px 1px 0`, `0 2px 0`）でピクセル感。blurは最小。  
- 線/影の**上下で明暗差**を付けてエンボス。  
- 背景に `linear-gradient` の**微差**やノイズテクスチャを重ね、フラット回避。  
- 余白スケールは**等比**にせず、意図的に崩す（例: 4→6→8→12…）。  
- *最初に tokens を整える* → そこから UI を組み立てる。直書きは後で必ず負債化。

---

### 付録: 開発フロー（推奨）
1. Tokens微調整（目視確認） → 2. 主要コンポーネントの variant 実装 →  
3. 盤面/手札/HUD の密度配分 → 4. 重要動線のGSAP → 5. a11y仕上げ → 6. QA

> 本ガイドは**全ページに共通で適用**できます。ページ固有の規約が必要になった場合は、ルート名と用途だけ追加指定すれば拡張可能です。
