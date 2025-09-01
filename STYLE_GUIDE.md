# CSS / UI Style Guide 2025 (ITO Project)

本ガイドは Chakra UI v3 + System API を前提に、AI へデザイン生成を依頼しても整合性・再現性が高い UI を維持するためのルール集です。

## 1. コア原則

1. Single Source of Truth: レイアウト寸法は `theme/layout.ts` の定数のみを参照 (魔法数禁止)。
2. Tokens First: 色/余白/フォント/影/角丸は theme tokens or semantic tokens を最優先。直接 rgba/hex を埋め込む場合は差別化意図をコメント。
3. No !important: 競合/優先度問題は構造・props・レシピで解決。`!important` 使用禁止（例外: `@media (prefers-reduced-motion: reduce)` の全局オーバーライドのみ許容）。
4. Scoped Scroll: 外枠は `overflow:hidden`, 内部スクロール領域は明示的コンポーネント (`ScrollRegion`) に限定。
5. Intrinsic > Fixed: `auto` + min/max 組合せで固定高さを避け DPI / clamp 変動に追従。
6. Progressive Enhancement: `100dvh` を基本。古環境フォールバックが必要なら `@supports` ブロックで追加。
7. Accessibility: ロール/aria-label を構造レベルで付与し視覚効果は semantic tokens で切替。

## 2. レイアウト寸法

`theme/layout.ts`

```
HEADER_MIN_HEIGHT 56
SIDEBAR_WIDTH 280
RIGHT_PANEL_WIDTH 340
HAND_MIN_HEIGHT 140
HAND_TARGET_HEIGHT 160
BOARD_MIN_HEIGHT 220
```

- 変更時はコンポーネント内のマジックナンバーを探し `grep` で差分吸収。
- AI へ寸法指示する際は「これら定数を利用」と明記。
- GameCard の標準寸法は `tokens.sizes.cardW/cardH`（現在 140x180）と `UNIFIED_LAYOUT.CARD.MIN_*` に統一。

## 3. タイポグラフィ

- `fontSizes` はすべて clamp で流動。px 固定指定禁止。
- 大サイズ見出しを追加する際は theme tokens に追記し `npx chakra typegen` を回す。

## 4. 色と状態

- 原則: `panelBg`, `panelSubBg`, `fgDefault`, `fgMuted`, `accent`, `borderDefault`。
- 成功/警告/失敗は semantic tokens (`successSolid`, `dangerSolid`) or palette (`green.*`, `red.*`).
- 選択状態やアクセントは outline + shadow token を組み合わせ視認性確保。

## 5. スペーシング & ラディウス

- 基本 gap: base=2(8px相当), md=3(12px)。
- Panel padding: compact=4(16px), comfortable=6(24px)。
- 角丸: `{radii.md|lg|xl}` のいずれか。数値直書き禁止。

## 6. アニメーション

- motion-safe 指定: `@media (prefers-reduced-motion: no-preference)`。
- 名前規則: `fadeInUp`, `scaleIn`, `pulse` 等動詞+効果。
- 新規は tokens.animations に登録を検討。

## 7. コンポーネント設計パターン

| 用途         | 方針                                                              |
| ------------ | ----------------------------------------------------------------- |
| Card / Panel | slot recipe (panel, gameCard) を優先。variant 拡張で分岐。        |
| 一時的強調   | semantic color + shadow token (`glow`, `glowDanger`)              |
| DnD 領域     | 背景パターン + dashed border。色はアクセント or state。           |
| Sticky/HUD   | `position:sticky; top:0; zIndex:token` で外枠スクロール干渉回避。 |

## 8. Scroll 管理

- 一画面: `AppShell` が minH:100dvh + `overflow:hidden`。
- 縦スクロールは `ScrollRegion` 内でのみ許可。`height` 固定ではなく親の `minH:0` を活かして flex 子が縮むようにする。

## 9. DPI / ビューポート / ズーム耐性

- 高さは `minH 100dvh` + auto rows。固定 px 行を避ける。
- 画像は `image-set()` (未実装箇所は後続) で 1x/2x ピクセル密度対応。
- 線幅: 1px 境界は retina で細く見えないよう半透明色 or 2px + 内側薄影を検討。

## 10. AI へのデザイン指示テンプレ (ショート)

```
Chakra v3 / tokens-first / no !important.
Grid: md≥48em => 280px / 1fr / 340px; mobile => single column.
Rows: header auto, center 1fr, hand minmax(140px,160px).
Use theme radii (lg/xl) & spacing tokens. Colors: panelBg, panelSubBg, accent.
No custom container queries; rely on Chakra breakpoints.
Avoid fixed heights; use min/max and flex.
```

## 11. Lint & 自動化 (提案)

- Stylelint 推奨設定 + 禁止ルール: `declaration-no-important`, `unit-no-unknown`, `property-no-vendor-prefix`。
- 追加プラグイン: `stylelint-order` で宣言順序 (Layout -> Box Model -> Typography -> Visual -> Misc)。
- CSS Nesting: ブラウザネイティブの CSS Nesting を採用（主要最新版に限定）。互換重視の場合は `postcss-nesting` を導入。

## 12. 変更フロー

1. まず layout.ts に寸法追加
2. 該当コンポーネント置換 (AppShell など)
3. 型/ビルド検証
4. Story / Screenshot (今後導入) で差分確認
5. ガイド更新

## 13. 既存改善 TODO (別フェーズ)

- Storybook + Chromatic ビジュアルリグレッション
- image-set() 導入 (avatar / 背景パターン)
- spacing scale tokens 追加 (1..12) & 自動比率 docs
- 色コントラスト監査 (axe + playwright)

## 14. よくある NG

| 問題                                       | 代替                                  |
| ------------------------------------------ | ------------------------------------- |
| 直接 `height: 56px` 固定                   | `auto` + 内側 padding                 |
| `.some-class { width: 280px !important; }` | Chakra prop `w="280px"` or layout定数 |
| `overflow:auto` を親複数階層に             | 最上位のみ hidden, 内側 ScrollRegion  |
| 任意 rgba 透過でブランド色再現             | semantic token / palette 利用         |

## 16. モックHTMLの扱い

- ルート直下の `ito-*.html` は参考用モック（実行時未使用）。設計の参照のみ可。
- 実装時は theme tokens / semantic tokens / `UNIFIED_LAYOUT` を必ず使用し、モックの `rgba()/linear-gradient()` はコピーしない。

## 15. チェックリスト (PR 用)

- [ ] レイアウト定数を再利用したか
- [ ] Magic number が残っていないか (grep)
- [ ] !important 不使用
- [ ] 新規固定高なし
- [ ] アクセシビリティ属性 (role/aria-label) 維持
- [ ] 内部スクロール領域は ScrollRegion のみ
- [ ] clamp フォント破綻なし (最小幅で検証)

---

## 16. GameCard v2 デザイン指針 (2025-08)

ゲーム内カード (gameCard slot recipe) の最新版仕様。AI / デザイナーが派生案を作る際はこの境界条件を守る。

### バリアント / ステート軸

1. displayVariant: `flip` | `flat`
2. state: `default` | `success` | `fail`

内部ロジックは `CentralCardBoard` が state を決定し、視覚は slotRecipe の compoundVariants で分岐。React 側で無理に className を増やさず token/variant で完結させる。

### 共通原則

- Text color: `fgDefault` か `fgMuted`。rgba 直書き禁止。
- 背景: デフォルトは `panelSubBg` ベース。成功/失敗は過度な彩度でなく輝度差 + 多層 shadow。
- 枠線: `borderDefault`。成功/失敗で色変更せず、光で示す (色覚多様性対応)。
- 半径: radii.lg 固定 (変えたい場合は recipe variant を新設)。
- 影レイヤ設計: 外側へ行くほど広く薄く。内側 (最初) は core glow。最大 3 レイヤ (success) / 2 レイヤ (fail) / 1 レイヤ (default)。

### success (強い光)

- 目的: 瞬時に成功集合を視認。
- シャドウ構成例 (外側へ):
  1.  0 0 0 1px 色: `teal.400` (コアエッジ) or semantic success ring
  2.  0 0 8px 2px `teal.500` (soft core)
  3.  0 0 24px 6px `teal.300` (ambient spread)
- 背景: デフォルト背景 + subtle ティールグラデ。過度な純色塗りつぶし禁止。

### fail (暗く + 簡素)

- 目的: 情報は伝えつつノイズを下げる (成功を主役化)。
- シャドウ: 2 レイヤまで。
  1.  0 0 0 1px `red.600` (edge)
  2.  0 0 12px 4px `red.700 / 40%` (soft glow) — 透明度で強度調整。
- 背景: 一段暗い neutral グラデ + ごく薄い赤系ティント。テキストコントラスト比 >= 4.5:1 を維持。

### default

- 背景: `panelSubBg`。
- シャドウ: 0〜1 レイヤ (sm)。インタラクションホバー時のみ +1 layer を検討 (未実装)。

### flip vs flat

| 差分           | flip                               | flat                      |
| -------------- | ---------------------------------- | ------------------------- |
| 背面存在       | 有 (裏面は muted)                  | 無 (単面表示)             |
| デフォルト影   | より控えめ (動き + 読みやすさ優先) | やや強め (静的パネル性)   |
| success 光強度 | 中 (動作中眩しすぎ防止)            | 強 (最も視認させたい場面) |
| fail 暗さ      | flip は少し明るめ (可読性)         | flat は一段暗く背景退行   |

### 禁止事項 / アンチパターン

- success/fail を背景純色全面ベタ塗り。=> コントラスト低下と状態過剰強調。
- success/fail で文字色を白/黒強制。=> token 逸脱。token が十分な readable 配色を提供。
- 影 4+ レイヤ。=> パフォーマンス低下 / 視覚ノイズ。
- inline style で色調整。=> recipe へ還元。

### 拡張のしかた

新たな状態 (例: `highlight`, `locked`) が必要なら `state` variant に追加し、compoundVariants を最小追加。既存 success/fail のシャドウ数より多くしない。必要な tokens が無ければ semanticTokens に追加し typegen を実行。

### アクセシビリティ

- success/fail は彩度でなく光/暗さ差を主手段とし、色相変化は補助。
- focus-visible: outline と shadow を併用 (現時点未実装 TODO)。

### 今後の TODO

- Hover / Focus レイヤ差分設計
- Reduced motion 時の flip アニメ最適化
- Visual regression (Storybook + Chromatic) 差分スナップ

---

## 2025-09 Premium Purge 概要

旧アーティファクト風 (紫+金グラデ/多層シャドウ/ガラスブラー) スタイルを撤廃し Rich Black + Orange Aesthetic へ統一。

| コンポーネント            | 主な変更                            | 置換指針                                                       |
| ------------------------- | ----------------------------------- | -------------------------------------------------------------- |
| GameCard                  | 金縁/紫グラデ compoundVariants 削除 | `surfaceRaised` + state 枠 (`successBorder`/`dangerBorder`)    |
| MiniHandDock              | MYSTICAL_PANEL/ARTIFACT_BUTTON 削除 | `surfaceOverlay` パネル + `accent` ボタン                      |
| CentralCardBoard / Slots  | 金/木質調グラデ除去                 | `surfaceRaised` + dashed `borderSubtle` / hover `borderAccent` |
| Room Inputs / Chat Header | 白/灰直値                           | `surfaceRaised` / `fgDefault` / `borderSubtle`                 |
| premiumGameStyles.ts      | 新規参照禁止                        | 段階的削除予定 (必要分は tokens 化)                            |

目的: 視覚的一貫性 / パフォーマンス (レイヤ影削減) / 可読性 (高コントラスト) / メンテ性 (token 依存)。

今後: focus-visible 統一リング, Storybook 回帰テスト, premium ファイル完全除去。

最終更新: 2025-09-01 (Premium Purge 追加)
