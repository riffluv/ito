# UIスケール方針（基準: 1920×1080 / Windows表示スケール 100%）

このドキュメントは、**序の紋章III（jomonsho）**の UI を「開発基準環境」と同じ“見え方”に寄せるための設装ルールです。  
次の Codex / Claude Code / 開発者に、**パーツ追加・修正を依頼するときは本mdを必ず渡してください**。

---

## 目的（なぜやるか）

- これは通常のWebページではなく、**盤面・カード・ドラッグ操作・文字可読性がUXの核**のゲーム。
- PC環境差（特に **Windows表示スケール 125% / 150%**）でカードやUIが大きく/小さくブレると、
  - 文字が改行する
  - 盤面の収まりが変わる
  - 操作ミスが増える
  - 世界観の統一感が崩れる
  などが起きやすい。

このため、**FHD(1920×1080) + 100%** を “唯一の真実” として設計し、125/150は補正で揃える。

---

## 用語（混乱しやすいので明示）

- **解像度**: 1920×1080 / 2560×1440 / 3840×2160…（物理ピクセル）
- **Windows表示スケール（DPI 100/125/150%）**: 1CSS px の物理サイズが変わる設定
- **CSS viewport 幅（`100vw` / `window.innerWidth`）**: OSスケールにより変動する（例: FHDでも150%で `100vw` が縮む）
- **`devicePixelRatio`**: OSスケールやブラウザ設定の影響を受ける指標（環境差あり）

重要: **「FHDなのにDPI150%でレイアウトが崩れる」のは、`100vw` が縮むため。**

---

## 実装の基本原則（ルール）

### 1) 参照解像度は 1920×1080（=1920基準）

「この幅ならこの見え方」という基準値を 1920 幅で決め、比率でスケールさせる。

基本形（CSS変数）:

- `--x-at-1920: <基準値>`（数値）
- `--x: clamp(min, calc(100vw * var(--x-at-1920) / 1920), max)`

**Breakpoints乱立で対応しない**（原則）。必要な時だけにする。

### 2) “Windows表示スケール” で崩れる原因は、だいたい `clamp()` の `min` 固定

典型的な失敗:

- `--card-w-md: clamp(120px, calc(100vw * 120 / 1920), 240px)`
- FHD + DPI150% のとき、本来 `100vw * 120 / 1920` が 80px に下がって相殺されるはずが、**min=120px** が壁になって下がらない  
→ 物理サイズが過大化して「巨大カード」になる。

対策: **minだけ分離してDPI条件で補正**する。

### 3) 固定pxの「引き算・余白」がDPIで肥大化して改行する

カード幅をDPIで揃えても、内側の

- `calc(100% - 6px)` のような固定減算
- `padding: 13px` のような固定padding

がDPI150%では物理的に重くなり、**“あと数px”足りなくて改行**することがある。

対策:

- 固定pxの減算・paddingも “同じスケール変数” で縮める
  - 例: `calc(100% - (6px * var(--card-text-scale)))`
  - 例: `padding: 0 calc(0.2rem * var(--card-text-scale))`

---

## 実装のソース・真実（このリポジトリでの置き場所）

### グローバルスケール/トークン

- `app/globals.css`
  - カード幅: `--card-w-md-at-1920`, `--card-w-md`, `--card-w-md-min-at-1920`
  - カード内側: `--card-pad-md`, `--card-text-scale`
  - UI幅: `--ui-sidebar-w`, `--ui-right-panel-w`, `--ui-header-pad-x`, `--ui-main-pad`, `--ui-menu-max-w` など
  - DPI補正: `@media (resolution >= 1.25dppx)` / `@media (resolution >= 1.5dppx)` で変数を上書き

### カードサイズを使う側

- `components/ui/cardSize.ts`（`--card-w-md` / `--card-h-md` を参照）
- `components/ui/GameCard.tsx`, `components/ui/CardFaces.tsx`, `components/ui/CardText.tsx`

### UIトークンを使う側（例）

- `components/ui/GameLayout.tsx`（`--ui-*` を参照してレイアウトを統一）
- `app/page.tsx`（メニューの `Container maxW` 等で `--ui-menu-max-w` / `--ui-main-pad` を参照）

---

## 実装レシピ（新しいパーツを追加/修正するとき）

### 手順

1. **FHD(1920)@100% で「基準の見え方」を決める**
2. `app/globals.css` に `--xxx-at-1920` と `--xxx` を追加（もしくは既存を再利用）
3. コンポーネント側は `var(--xxx)` を参照する（Chakraの props に文字列で渡してOK）
4. “内側の固定px” がある場合は、`--dpi-scale` / `--card-text-scale` 等で `calc()` してスケールさせる
5. **手動確認**: FHDで Windows表示スケール 100/125/150 を確認（同じ見え方になっているか）

### 「固定pxの引き算」チェックリスト（最重要）

次のような記述が見えたら、DPI150で詰まりやすい:

- `calc(100% - 6px)` / `calc(100% - 8px)`
- `padding: 13px` のような固定padding（特にカード内/ボタン内）

→ 原則: `* var(--card-text-scale)`（カード内）や `* var(--dpi-scale)`（一般UI）で補正する。

---

## DPI 125/150 を “基準と同じ見え方” に寄せるルール

### カード幅（例: 120px@FHD/DPI100 を揃える）

- DPI125%: `min = 120 / 1.25 = 96`
- DPI150%: `min = 120 / 1.5 = 80`

この「minだけ補正」を `--card-w-md-min-at-1920` で行う。

### カードの内側（padding / text）

カード幅だけ揃えても、内側の固定pxが残ると改行するため、最低限これを揃える:

- `--card-pad-md`（カードの内側padding）
- `--card-text-scale`（カード内テキストや固定減算に使う）

---

## 2K/3K/4K + 高DPI（200%など）はどうなる？

- 高解像度 + 高DPI 環境でも、`vw` 項（`100vw * ... / 1920`）が効くため、基本的に破綻しにくい。
- 今回の方針は主に「FHDなのにOSスケールでCSS幅が縮む」ケースの崩れを直す。
- もし将来「4K 200%だけ極端」などが出たら、DPIメディアクエリを **CSS幅条件（max-width）と組み合わせて**適用範囲を限定する（例：`and (max-width: 1500px)`）。

---

## 目視デバッグ用スニペット（貼って比較する）

ブラウザConsoleで実行:

```js
(() => {
  const root = document.documentElement;
  const style = getComputedStyle(root);
  const card =
    document.querySelector("[data-card-id]") ||
    document.querySelector("[aria-label$='のカード']");
  return {
    innerWidth: window.innerWidth,
    dpr: window.devicePixelRatio,
    cardW: style.getPropertyValue("--card-w-md").trim(),
    cardPad: style.getPropertyValue("--card-pad-md").trim(),
    cardTextScale: style.getPropertyValue("--card-text-scale").trim(),
    uiSidebar: style.getPropertyValue("--ui-sidebar-w").trim(),
    uiMainPad: style.getPropertyValue("--ui-main-pad").trim(),
    cardWidthPx: card?.getBoundingClientRect().width ?? null,
  };
})();
```

---

## 最低限の手動確認チェック（公開前）

同じ画面（例：waiting/clue）で、Windows表示スケールを切り替えて確認:

- FHD 1920×1080: 100% / 125% / 150%
  - カード幅と文字の改行が **100% と同じ見え方**か
  - 左パーティ/右パネル等が “巨大化” していないか

推奨（可能なら）:

- 2K/3K/4K + 高DPI（店頭確認でもOK）

---

## エージェントへの依頼文テンプレ（コピペ用）

```txt
UIは「1920×1080 / Windows表示スケール100%」を唯一の真実として実装してください。
既存のカードスケール設計（app/globals.css の --card-*）と同じ思想で、対象パーツもCSS変数化し、
125%/150%でも“見え方が基準と一致”するように、clampのmin分離 + 固定px引き算/内側余白のスケール補正を行ってください。
詳細は docs/UI_SCALE_POLICY.md を遵守してください。
```

