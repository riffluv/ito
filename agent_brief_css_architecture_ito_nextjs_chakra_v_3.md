# Agent Brief: **Holistic CSS Architecture & DPI-Resilient Layout Overhaul** for *ito* (Next.js + Chakra UI v3)

> **Goal**: ゲーム画面**全体**（AppShell/レイアウト/グローバルCSS/テーマ/各UI部品/ポータル/モーダル含む）を**総監査**し、相互干渉を解消。最終的に“カードボード（盤面）”が **Windows 表示スケール 125%** を含む全スケールで**確実に収まる**状態を作る。**2025年ベストプラクティス**で CSS 設計を整理・刷新し、デザイン作業に集中できる**堅牢な土台**を完成させる。

---

## 0) あなた（エージェント）に求める姿勢
- 受け身禁止。**自発的に全原因を洗い出し、仮説検証→修正→実機テスト**までやり切る。
- 必要な情報/ファイルが無ければ、**具体的なリスト**で即要求する（例: 対象コンポーネント、テーマ設定、GlobalStyle、.env、ブラウザ/OS、再現動画など）。
- **before/after の差分**と**判断根拠**を、PR とドキュメントで明確化。
- 2025 年現在の仕様と実装動向を**都度リサーチ**し、根拠を示す（MDN/WHATWG/W3C/公式ドキュメント優先）。

---

## 1) 対象と非対象
**対象（ゲーム画面全体の干渉源まで含める）**
- AppShell（ヘッダー/フッター/サイドバー/ツールバー）、メインコンテンツ領域、オーバーレイ/モーダル/ドロワー、トースト、ポータル(`#chakra-portal`)
- グローバル CSS（Reset/Normalize/GlobalStyle）、`html/body` の基底設定（フォント/`font-size`/`line-height`/`overflow`）
- Chakra UI v3 テーマ/トークン/スタイルプロップ、`SystemStyleObject`、`sx`/`css` の混在箇所
- レイアウト基盤（Grid/Flex/Container Queries）、スクロール挙動、スクロールバー処理
- 画像・フォント（可変フォント/`font-size-adjust`/`size-adjust`/`image-set`）
- **カードボード（盤面）**領域とその周辺要素（親コンテナや兄弟要素を含む）

**非対象**
- ゲームロジック/サーバ通信/国際化テキストの内容（ただしレイアウト影響は監査対象）

---

## 2) 事前に収集・確認すべき情報（不足時は要求すること）
- Next.js の構成（App Router/Pages Router、SSR/ISR、有効な `experimental`、Turbopack）
- Chakra UI v3 のテーマ全容（breakpoints/semantic tokens/sizes/space/typography/color mode）と `ColorModeScript` の挿入位置
- GlobalStyle/Reset の有無と内容（`@chakra-ui/anatomy` 系含む）
- 画面構造図：AppShell → Page → セクション → Board → Card ツリー、Portal/Modal のマウント位置
- 既存スタイルの所在：styled props / `sx` / `css`（emotion） / CSS Modules / global.css の混在マップ
- 画像/フォント資産（形式・解像度・可変軸・`font-display`・`size-adjust`）
- ブラウザ/OS/拡大率の再現条件（**Windows 100/125/150/175/200%**、Chrome/Edge/Firefox）
- 再現手順・動画・スクショ、DevTools の `Layers`, `Computed`, `Layout` パネルの記録
- ルート `meta viewport`、`scrollbar-gutter`、`box-sizing`、`overflow` のグローバル設定
---

## 3) 想定原因（仮説）
**ローカル要因（盤面内）**
- 固定 `px` と `gap` の端数累積により 125% で合計幅超過
- `calc()`/丸め誤差、`transform: scale()` によるぼやけ・ヒット領域ズレ
- `box-sizing` の不統一、`scrollbar` 出現での 1 列押し出し

**グローバル干渉要因**
- 祖先要素の `transform`/`filter`/`perspective` が新たなコンテキストや合成境界を生成
- AppShell の固定ヘッダー/サイドバーの `position: fixed` と `100vw` の誤用で**横はみ出し**
- `overflow: hidden` の乱用によりスクロール計算が歪む、またはレイアウト検査が困難
- Portal/Modal/Toast のスクロールロック実装が body 幅を変化 (`scrollbar-gutter` 未設定)
- `vw` 基準のサイズ指定がスクロールバー幅を無視して 100% を超過
- フォント切替（FOUT/FOIT）や `size-adjust` 未設定で初回描画後に reflow し列落ち
- 画像の実寸不足/非整数拡大でぼやけ→実寸に合わせた余白が変動

> これらを**全て計測**し、根拠（スクショ/数式/Computed 値）付きで報告。
---

## 4) 設計ポリシー（2025 ベストプラクティス）
1. **相対単位優先**: `rem`, `em`, `%`, `cqi/cqw`（コンテナクエリ単位）/`lv*`/`sv*` を適材適所。固定 `px` は最小限。
2. **コンテナクエリ駆動**: `container-type: inline-size;` を親に付与し、ボードは **@container** でブレーク。
3. **Grid + minmax/clamp**: カードの最小/理想/最大を `clamp()` で規定。`grid-auto-rows` と `aspect-ratio` で均整。
4. **端数に強い寸法**: 合計幅 = 列×カード幅 + (列-1)×gap が **常に 100% 以下**になる式を採用。
5. **箱の規範**: `box-sizing: border-box` を徹底。スクロールバーは `scrollbar-gutter: stable both-edges` を検討。
6. **テーマ一元化**: Chakra の **theme tokens** に寸法/間隔/角丸/影を集約。直値埋め込み禁止。
7. **視覚の一貫性**: `aspect-ratio` でカード比固定、ラスター画像は 2x/3x を用意 or SVG 化。
8. **アクセシビリティ**: OS スケール/ズーム/フォントサイズ変更での読字性担保。`prefers-reduced-motion` を尊重。
9. **論理プロパティ**: `margin-inline`, `padding-block` などで縦書き/RTL 耐性。
10. **副作用最小**: `transform` での拡大縮小によるぼやけ回避。レイアウトは**実寸**で解決。

---

## 5) 実装要件（Chakra v3 前提）
- **レイヤリング**: `theme.layers` / `zIndex` の衝突監査。必要なものだけを昇順に整理。
- **Board コンテナ**
  - `container-type: inline-size;` 付与
  - `display: grid; grid-template-columns: repeat(auto-fit, minmax(var(--card-min), var(--card-ideal))); gap: var(--card-gap);`
  - `max-inline-size: 100%;` `overflow: clip;`（または `hidden`）
  - `padding: var(--board-pad);` `scrollbar-gutter: stable both-edges;`
- **カード**
  - `aspect-ratio: var(--card-ratio, 63/88);`（トレカ比例例）
  - `min-inline-size: var(--card-min); inline-size: clamp(var(--card-min), var(--card-cqi), var(--card-max));`
  - `block-size: auto;` 画像は `object-fit: cover;`
- **サイズ変数（CSS 変数）**
  - `--card-gap: clamp(0.5rem, 1cqi, 1rem);`
  - `--card-min: clamp(6rem, 8cqi, 9rem);`
  - `--card-ideal: clamp(8rem, 14cqi, 12rem);`
  - `--card-max: 14rem;`
  - `--board-pad: clamp(0.5rem, 2cqi, 1.25rem);`
  - Chakra では `cssVar` / `semanticTokens` に統合。
- **Breakpoints は最小限**（できるだけ @container で対応）
- **Reset/Global**: `box-sizing: border-box;`、基底 `font-size: 100%` を維持（ズーム親和）。

> 実装は Chakra の **styled props** だけで無理に閉じない。必要に応じて `css`（`@emotion/react`）や `style props + sx` を併用。

---

## 6) DPI/ズーム耐性チェックリスト
- Windows 表示スケール **100/125/150/175/200%** × Chrome/Edge/Firefox
- 盤面の最終列・最終行が**常に収まり**、余白が過不足なく一定
- `devicePixelRatio` 変更時の**再計算**でオーバーフローが発生しない
- スクロールバー有無で **横位置が不連続に変化しない**（`scrollbar-gutter: stable both-edges`）
- 祖先に `transform` が存在してもぼやけ/座標ずれが発生しない（存在時は除去/置換）
- フォントロード過程で列数が変化しない（可変フォント + `font-size-adjust`/`size-adjust`）
---

## 7) テスト & 自動化
- **Playwright** でビューポート/ズーム/OS スケール相当のスナップショット回帰テストを作成
  - ビューポート例: 1280×800, 1440×900, 1920×1080（DPR: 1.0/1.25/1.5）
  - カード枚数バリエーション（1, 2, 3, 4, 5, 7, 10, 13 …）
- **stylelint + postcss-reporter** で不要/衝突/高特異性の検知
- **eslint-plugin-chakra-ui**（類似ルール）でアンチパターン検出（利用可否を確認し代替提案）
- **Bundle アナライザ**で未使用 CSS/重複依存を削減

---

## 8) 具体的な改修タスク
1. **全体監査**
   - AppShell/ポータル/モーダル/トースト/サイドバー/固定ヘッダーの**干渉源マップ**を作成
   - `100vw`/`position: fixed`/負のマージン/`overflow: hidden`/`transform` の使用箇所を列挙
   - スタイルの**特異性ヒートマップ**（`!important`/ネスト深度）を作成
2. **設計更正**
   - ルートで `box-sizing: border-box`、`scrollbar-gutter: stable both-edges`、`font-size: 100%`
   - 親に `container-type: inline-size` を設定、@container で盤面を制御
   - Grid 設計（`repeat(auto-fit, minmax())`）+ `clamp()` + `aspect-ratio` へ置換
   - Chakra テーマへ寸法/余白/影/角丸/タイポを**完全集約**し直値削減
3. **実装**
   - AppShell/Board/Card を責務分離し、`sx`/`css`/styled props の混在を整理
   - 祖先の `transform`/`filter` を排除 or 代替（`will-change` 乱用禁止）
4. **QA**
   - Playwright による**DPR/スケール**スナップショット回帰 + 手動検証
   - CLS/INP/LCP のアラート監視（初回フォントロード時の列落ち検出）
---

## 9) 受け入れ基準（Acceptance Criteria）
- 盤面は **Windows 125%** を含む全スケールで**横/縦オーバーフロー無し**
- AppShell/モーダル/トースト/サイドバー等の有無に関わらず**列/行が安定**
- `transform` スケールに頼らず実寸で鮮明、端数丸めによる崩れ無し
- Chakra テーマへの集約完了、`!important`/高特異性/重複ルールの**撲滅**
- stylelint/eslint/型チェック/ビルド/Playwright が**全て成功**
- PR に **全体監査レポート**と**変更前後スクショ**、採否理由が含まれる
---

## 10) 依頼テンプレ（このまま使って OK）
**タイトル:**
> ito（Next.js + Chakra UI v3）**ゲーム画面全体を総監査**し、CSS 設計を 2025 ベストプラクティスで再設計。最終目標はカードボードが DPI125% でも必ず収まること。

**要望本文:**
> - プロジェクトをクローンしてローカル起動し、**ゲーム画面全体**で DPI125% 時に発生する盤面のはみ出し原因を「局所/グローバル」の両面から**仮説→検証→修正→回帰テスト**まで実施してください。
> - **AppShell/ポータル/モーダル/トースト/固定ヘッダー/サイドバー**等の干渉を含めて**総点検**し、必要に応じて設計を是正してください。
> - 2025 年 CSS ベストプラクティス（相対単位/コンテナクエリ/Grid + clamp/minmax/`aspect-ratio`/`scrollbar-gutter`）に刷新。**transform スケール禁止**方針。
> - Chakra テーマに寸法/余白/影/角丸/タイポを**集約**し、直値・!important・高特異性を削減。
> - Playwright による **DPR 1.0/1.25/1.5** × 解像度 1280/1440/1920 のスナップショット回帰と、Windows 100/125/150/175/200% の手動検証結果をドキュメント化。
> - 不足情報は**初回コメントで一覧**提示の上、速やかに要求してください。

**受け渡し物:**
> 1) PR（詳細説明付） 2) `docs/holistic-css-architecture.md`（全体監査/設計/テスト手順） 3) Playwright テスト 4) stylelint 設定+レポート 5) **干渉源の修正一覧と再発防止策**

**補足:**
> - 盤面がゴールだが、**全体の健全性を優先**して根治的に修正してください。外観差は根拠説明の上で合意を取ること。
---

## 11) 実装サンプル（方向性の目安）
> 実プロジェクトではテーマ統合＆型付け。

```tsx
// Board.tsx（概略）
import { Box } from "@chakra-ui/react";

export function Board({ children }: { children: React.ReactNode }) {
  return (
    <Box
      as="section"
      __css={{
        containerType: "inline-size",
        display: "grid",
        gap: "var(--card-gap)",
        gridTemplateColumns: "repeat(auto-fit, minmax(var(--card-min), var(--card-ideal)))",
        maxInlineSize: "100%",
        padding: "var(--board-pad)",
        overflow: "clip",
        boxSizing: "border-box",
        scrollbarGutter: "stable both-edges",
      }}
    >
      {children}
    </Box>
  );
}
```

```tsx
// Card.tsx（概略）
import { Box } from "@chakra-ui/react";

export function Card({ children }: { children: React.ReactNode }) {
  return (
    <Box
      __css={{
        aspectRatio: "var(--card-ratio, 63 / 88)",
        minInlineSize: "var(--card-min)",
        inlineSize: "clamp(var(--card-min), var(--card-cqi), var(--card-max))",
        blockSize: "auto",
        overflow: "hidden",
        borderRadius: "var(--card-radius, var(--radii.md))",
        boxShadow: "var(--card-shadow, var(--shadows.md))",
      }}
    >
      {children}
    </Box>
  );
}
```

```ts
// theme/semantic-tokens.ts（概略）
export const semanticTokens = {
  sizes: {
    "card.min": { default: "clamp(6rem, 8cqi, 9rem)" },
    "card.ideal": { default: "clamp(8rem, 14cqi, 12rem)" },
    "card.max": { default: "14rem" },
  },
  space: {
    "card.gap": { default: "clamp(0.5rem, 1cqi, 1rem)" },
    "board.pad": { default: "clamp(0.5rem, 2cqi, 1.25rem)" },
  },
};
```

```css
/* globals.css（概略） */
:root {
  --card-gap: clamp(0.5rem, 1cqi, 1rem);
  --card-min: clamp(6rem, 8cqi, 9rem);
  --card-ideal: clamp(8rem, 14cqi, 12rem);
  --card-max: 14rem;
  --board-pad: clamp(0.5rem, 2cqi, 1.25rem);
}

* { box-sizing: border-box; }
```

---

## 12) 禁止事項とリスク/フォールバック
**禁止事項**
- `transform: scale` による見せかけのフィット
- `100vw` の無批判な使用（スクロールバー幅を無視）
- `overflow: hidden` の乱用（デバッグ不能/副作用）
- `!important`/過剰ネスト/高特異性の上書き合戦

**リスク/フォールバック**
- `cqi/cqw` 非対応 → `@supports (width: 1cqi)` でフォールバック
- `scrollbar-gutter` 非対応 → パディング/レイアウトで吸収
- コンテナクエリ非対応の旧環境 → @media + CSS 変数で近似
---

## 13) 最後に
この依頼は「**CSS 設計の土台を完璧にする**」ことが目的です。**徹底的な監査→理論に基づく再設計→実機での確証**まで行い、ドキュメントとテストで未来の変更にも強い基盤を残してください。

