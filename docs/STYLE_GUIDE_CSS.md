# CSS/スケール基盤ガイド（UI/UX設計用の土台）

- レイヤ構成: `@layer reset, tokens, base, utilities` を `app/globals.css` で採用。
- トークン: CSSカスタムプロパティは `:root` に集約（間隔、幅、カード寸法など）。色やフォントは Chakra の `theme/*` に寄せる。
- DPI/ズーム: `@media (resolution >= 1.25dppx)` などで `--adaptive-scale` とカード寸法を微調整。OSの拡大率でも破綻しにくい値に。
- 単位: レイアウトは `rem`/`cqi` を基本。ピクセル固定は最小限。
- 画像: 背景は `image-set()`、 `<img>` は `srcSet`/`sizes` を推奨（UI実装時に適用）。
- 可読幅: `.content-*` ユーティリティで読み幅を管理。主要レイアウトは Chakra コンポーネントに委譲。
- アクセシビリティ: `.skip-link` と `.sr-only` を用意。`prefers-reduced-motion` を尊重。
- スクロールバー: 視認性を損なわない最小限のスタイルのみ。

今後の適用時は、構造的サイズ・レスポンシブ・配色は Chakra テーマに追加し、ここには横断の最小限スタイルのみを保つこと。

