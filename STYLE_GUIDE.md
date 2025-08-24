# CSS / UI Style Guide 2025 (ITO Project)

本ガイドは Chakra UI v3 + System API を前提に、AI へデザイン生成を依頼しても整合性・再現性が高い UI を維持するためのルール集です。

## 1. コア原則

1. Single Source of Truth: レイアウト寸法は `theme/layout.ts` の定数のみを参照 (魔法数禁止)。
2. Tokens First: 色/余白/フォント/影/角丸は theme tokens or semantic tokens を最優先。直接 rgba/hex を埋め込む場合は差別化意図をコメント。
3. No !important: 競合/優先度問題は構造・props・レシピで解決。`!important` 使用禁止。
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

## 15. チェックリスト (PR 用)

- [ ] レイアウト定数を再利用したか
- [ ] Magic number が残っていないか (grep)
- [ ] !important 不使用
- [ ] 新規固定高なし
- [ ] アクセシビリティ属性 (role/aria-label) 維持
- [ ] 内部スクロール領域は ScrollRegion のみ
- [ ] clamp フォント破綻なし (最小幅で検証)

---

最終更新: 2025-08-24
