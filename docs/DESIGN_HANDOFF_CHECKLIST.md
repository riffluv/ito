# デザインハンドオフ受け入れチェックリスト (AI / デザイナ向け)

本プロジェクトに新しいモック (画面 / コンポーネント) を投入する際の前提条件と制約。これを満たす形でモックを生成 / 提示すると実装差異が最小化されます。

## 1. レイアウト原則

- グリッドは既存 AppShell: `left | center | right` + 下部 `hand` 行。大幅変更が必要な場合は差分図を添付。
- 高さは `minH: 100dvh` を前提に内部スクロールのみ。新規全画面スクロール禁止。
- 新しい縦スクロール領域を追加したい場合は既存 `ScrollRegion` パターンを再利用。

## 2. トークン利用 (必須)

- 余白: `spacing` スケール (例: 2, 2.5, 3.5, 4, 6, 8 など)。px 直接指定禁止 (特殊ケース除く)。
- 角丸: `radii` (xs/sm/md/lg/xl)。独自半径は要理由。
- 色: `semanticTokens.colors` (`panelBg`, `fgDefault`, `accent` など) を優先。ブランド新色は `tokens.colors.brand` 拡張案を提示。
- 影: 既存 `shadows` (`xs`/`sm`/`md`/`glow`) を使用。新規は利用目的を明示。
- サイズ: 固定幅/高さが必要な場合は `sizes` (`sidebarLeft`, `sidebarRight`, `handRow`) を参照。カード寸法は `cardSm`, `cardMd`。

## 3. タイポグラフィ

- フォントサイズは `fontSizes` の fluid tokens (xs ~ 4xl)。カスタム clamp を直接書かない。
- 見出しレベルは意味よりも視覚スタイルで選択可 (h2/h3 の semantic 厳格性よりも統一感優先)。

## 4. コンポーネント構造

- パネル枠は `Panel` recipe を再利用 (header/title/actions/body/footer)。
- ボタン: recipe `button` の variant (`solid` | `subtle` | `soft` | `outline` | `ghost` | `link`) を指定。size (`sm|md|lg`)、必要なら density。
- カード: `gameCard` slotRecipe の variant/state 組合わせを活用。新規状態は `state: additionalX` など追記案を提示。

## 5. 状態管理とフェーズ

- 表示フェーズは HUD バッジ単一表示 (waiting / clue / playing / reveal / finished)。別段階タイムラインは不要。
- 新規フェーズ提案時: 目的 / 既存フェーズで代替できない理由 / 影響コンポーネントを明記。

## 6. アクセシビリティ / 用語

- 主要新領域は `aria-label` を提案 (例: "参加者フィルター")。
- 色のみでの状態差異は避け、アイコン / ラベル追加案を含める。

## 7. モーション

- 既存 easing (`standard` / `emphasized`) + durations (`fast`/`normal`/`slow`) から選択。
- 新しいアニメ: 名前 / 用途 / 目標時間 / easing 理由を記述。

## 8. DPI / レスポンシブ

- PC (≥ md) / モバイル (< md) の2段階を基本。追加ブレークポイント要求は実利 (崩れ防止, 意味ある再配置) を説明。
- 高 DPI での細線/境界強調が必要なら semanticTokens `borderDefault` の濃度調整案を提出。

## 9. 禁止 / 注意

| 項目                     | 理由                          | 代替                               |
| ------------------------ | ----------------------------- | ---------------------------------- |
| 任意の固定高さ (vh 以外) | オーバーフロー発生源          | `flex` + `minH=0` + 内部スクロール |
| `!important`             | トークン/レスポンシブ制御衝突 | レシピ / props で定義              |
| 無断新規カラーパレット   | ダーク/ライト一貫性崩壊       | `semanticTokens` 追加提案          |
| インライン clamp 乱立    | メンテ困難                    | 既存 `fontSizes` reuse             |

## 10. 提出フォーマット例 (AI プロンプト向け)

```
画面: ルーム参加者一覧拡張
目的: 参加者 > 30 人時の視認性向上 / ホスト操作簡略化
要素:
- 左サイド: フィルターバー (高さ自動, sticky top: 0)
- 中央: 参加者カードグリッド (2~4列, gap = spacing 4)
- 右: チャット (変更なし)
トークン指定:
- 外枠余白 p=6, 内部カード gap=4
- カード variant=flat / interactive=true
- フィルター操作ボタン: variant=subtle size=sm
レスポンシブ:
- < md: グリッド1列, フィルターバーは上部に折り畳み (Accordion)
アクセシビリティ:
- フィルターバー aria-label="参加者フィルター"
```

## 11. 受け入れチェック (実装前セルフレビュー)

- [ ] 余白/角丸/影/色はトークン参照のみ
- [ ] spacing ステップが scale 上に存在
- [ ] 無駄なグローバル CSS 追加なし
- [ ] 主要領域にラベル (必要な場合)
- [ ] HUD フェーズ表示と重複する UI なし
- [ ] 新規フェーズ定義がある場合は README or 設計メモ更新案付き

---

このチェックリストを満たしたモックのみを受け入れることで、実装との乖離・リファクタコストを最小化します。
