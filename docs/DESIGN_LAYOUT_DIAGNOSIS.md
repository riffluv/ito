# レイアウト崩れ原因診断と修正報告

## 症状

- ルーム画面で意図しない縦スクロールバーが中央パネル内に出現し、要素が上下に詰まり不格好。
- AI(デザイン指示)で想定したグリッド寸法と実際の表示が数px〜十数px ずれ、余白の統一感欠如。

## 根本原因 (Root Causes)

1. 固定行高 `gridTemplateRows: "56px 1fr 160px"` により、`fluid typography (clamp)` + Windows DPIスケーリング(125% / 150%) でヘッダー実高が 56px を超過 → グリッド合計高が `100dvh` を超え中央領域が圧迫され内部スクロール発生。
2. `globals.css` で `.room-grid` に対し container query で `grid-template-columns / areas` を `!important` 上書き。Chakra の `md` ブレークポイントと競合し **二重計算のタイミング差でリフロー + スクロール揺れ** を誘発。
3. ルートコンテナを `h:"100dvh"` で固定しピクセル丸め誤差 (Chrome / Windows スクロールバー幅 17px など) を吸収できず。余白が 1〜2px 欠損して内部領域が再度オーバーフロー。
4. コンテナクエリ指定のため `.room-grid { container-type: inline-size; }` を外枠グリッド自体に付与 → レイアウト再計算回数増 (不要)。

## 修正内容

- `AppShell.tsx`
  - `h="100dvh"` → `minH="100dvh"` に変更しブラウザ UI・DPI丸め超過を許容。
  - 固定値 `56px` 行を `auto` 行へ (`gridTemplateRows` を `auto 1fr auto` / `auto 1fr minmax(140px,160px)` )。
  - コメントで理由記載。
- `globals.css`
  - `.room-grid` の container query および `!important` 上書きを削除。レスポンシブ制御は Chakra の props に単一化。
- 副次効果: 垂直方向の隠しスクロールが消え、内部 `ScrollRegion` のみがスクロール責務を持つシンプルな階層に。

## 想定される改善

| 項目                         | Before                                 | After         |
| ---------------------------- | -------------------------------------- | ------------- |
| 初期描画時のレイアウトシフト | container query + Chakra 競合で 1〜2回 | 0〜1回 (最小) |
| 不要縦スクロール             | 発生                                   | 解消          |
| 余白一貫性                   | clamp後ズレ                            | 安定          |

## 今後 AI にデザイン指示する際の推奨テンプレ

```
デザイン要件:
- 3列グリッド (md>=48em): 左 280px / 中央 1fr / 右 340px
- モバイル: 単一カラム (header, center, hand)
- 行: header は高さ可変(auto), center 1fr, hand 最低 140px (内容増で拡張可)
- ルートは minH:100dvh, 外側 overflow:hidden, 内部スクロールは専用 ScrollRegion コンポーネント
- 余白: gap base=8px(md=12px 相当), パネル内 padding base=16px(md=24px)
- フォントは既存 theme tokens (fontSizes.* clamp) を厳守 (px 指定禁止)
- 追加の container query / !important 禁止。Chakra props と theme tokens のみ使用。
- 視覚的強調は semantic tokens (panelBg, panelSubBg, accent, borderDefault) を優先。生RGBA値は必要最小限。
```

## チェックリスト (継続運用用)

- [ ] 固定行高が fluid text + DPI で溢れていないか
- [ ] `!important` による Chakra レイアウト props 上書きが無いか
- [ ] 新たに 100vh / 100vw を追加していないか (動的ビューポートは 100dvh 推奨)
- [ ] グローバル CSS がコンポーネント単位レイアウトに干渉していないか
- [ ] スクロールすべき領域以外に `overflow: auto/scroll` が無いか
- [ ] clamp フォント利用時にコンテナ幅が極端に狭くなっていないか

## 追加改善候補 (未実施)

1. `prefers-reduced-motion` に応じてトランジション短縮 (パフォーマンス)。
2. `@supports (height: 100dvh)` フォールバック (一部古ブラウザ向け)。
3. テーマ tokens に spacing scale を追加し magic number 削減。

---

更新日: 2025-08-24
