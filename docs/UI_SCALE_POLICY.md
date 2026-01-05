# UI Scale Policy（Windows DPI 100 を唯一の真実にする）

## 目的（基準）

- **開発基準**: `1920×1080 (FHD)` + **Windows 表示スケール 100%**（= `devicePixelRatio ≒ 1`）を「見え方の唯一の真実」とする。
- Windows 表示スケール **125% / 150%**（`devicePixelRatio ≒ 1.25 / 1.5`）でも、**DPI100 と同じサイズ感**に揃える。
- **禁止**: 画面全体を `zoom` / `transform: scale()` で縮める（文字が滲む・副作用が大きい）。
- **カード可読性は落とさない**: 縮小の目的は「DPI100 と同じ物理サイズに戻す」ことであり、DPI100より小さくすることではない。

## 非目的（やらないこと）

- Retina/スマホの `devicePixelRatio >= 2` を **Windows DPI と同一視して縮めない**（高密度表示の恩恵まで潰すため）。
- ブラウザズーム（Chrome の 90% / 110% など）を強引に打ち消さない。

## 何が起きているか（崩れの原因）

Windows の表示スケールを上げると、ブラウザの `devicePixelRatio` が増え、**1CSSpx の物理サイズが肥大化**する。
その結果、UI の `px` 固定値（高さ・幅・padding・font-size・shadow など）が **物理的に巨大化してレイアウトが破綻**する。

典型例:

- パーティ欄・ボタン・入力欄などが **DPI150 で巨大化**する
- 幅や文字はそこそこでも、ボタンだけ **縦長（高さだけ肥大）**になる  
  → Chakra UI の `Button/Input` は `size` によって内部で `h`（高さ）を自動設定するため、`px` 補正が効いていないと「高さだけ残る」ことがある

## 対策（設計ルール）

### 1) グローバル係数 `--dpi-scale` を唯一の補正点にする

- **真実の置き場所**: `app/globals.css` の `:root { --dpi-scale: ... }`
- `--dpi-scale` は **DPI100 では必ず `1`**。
- Windows 表示スケール相当のみ補正（Retina/スマホ 2x/3x を巻き込まないように上限を付ける）:
  - 125% 相当: `--dpi-scale = 0.8`（= `1/1.25`）
  - 150% 相当: `--dpi-scale = 0.667`（= `1/1.5`）

### 2) UI の固定 `px` を “dpi対応値” に置き換える

UI コンポーネント側は、固定 `px` を次の形に変換する:

- `calc(44px * var(--dpi-scale))`

Chakra の style props / `css` でも同様に `calc()` を文字列で渡す。
`box-shadow` / `text-shadow` / `border-width` などの「px のオフセット」も同様に係数を掛ける。

### 3) 実装補助（推奨）

`scaleForDpi("44px") -> "calc(44px * var(--dpi-scale))"` のようなヘルパー関数を用意し、UI 側はそれを使って `px` を変換する。
（**変換は UI の各値に対して行い、全体 scale はしない**）

- 実体: `components/ui/scaleForDpi.ts`

### 4) Chakra UI の落とし穴（重要）

`Button` / `Input` の `size="sm|md|lg"` などは、内部レシピで `h`（高さ）を入れることがある。
そのため「padding や fontSize を DPI 対応にしても、高さだけが残って縦長」になりうる。

対処:

- “見え方を基準に固定したい UI” は、`h` と `minH`（必要なら `minW` も）を `scaleForDpi(...)` で明示して、レシピの `h` に負けないようにする。
- クリック領域（タップ最小値）は `minH` 側で担保し、見た目の高さは `h` 側で揃える。

## 関連（カードスケール）

- カードのサイズ・テキストスケールは `app/globals.css` の `--card-*` / `--card-text-scale` が基準。
- UI の DPI 補正（`--dpi-scale`）と、カードの見え方（`--card-*`）は **役割が別**なので混同しない。

## デバッグの目安

- DevTools Console で `getComputedStyle(document.documentElement).getPropertyValue("--dpi-scale")` を確認し、想定通りかを見る。
  - 例: DPI100 → `1` / DPI125 → `0.8` / DPI150 → `0.667`
- 「縦長だけ残る」時は、対象ボタン/入力の computed `height` が Chakra の size 由来になっていないか確認し、`h/minH` を明示する。
