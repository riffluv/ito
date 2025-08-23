# フルスクリーン型 UI コンポーネント実装ガイド（Agent向け）

本ガイドは、フルスクリーン・アプリシェル（`header/left/center/right/hand`）前提で、各コンポーネントの役割・API・実装要点・A11y・トークン利用・レスポンシブ方針を示します。

## 共通指針
- 配色/角丸/影/境界線はできるだけトークンで指定（`semanticTokens`/`tokens`）。
- ボタンは `colorPalette` を活用（意味で色を当てる）。
- レイアウトは `Grid`/`Stack`/`Box` を用い、`gap` 中心で余白を揃える。
- スクロールは `center` と `right` のみ。中間コンテナに `minH={0}` を付与。
- `role="region"` と `aria-label` を要所に付与。ライブ通知は `aria-live` を使う。

---

## TopBar（`header`）
- 目的: ルーム名・フェーズに応じた主要操作（お題変更/配布/開始/リセット）。
- 配置: グリッドの `header`（固定行）。横幅いっぱい、スクロールしない。
- API（例）:
  - `title: string` / `phase: 'waiting'|'clue'|'playing'|'finished'` / `isHost: boolean`
  - `onStart`, `onDeal`, `onStartPlaying`, `onReset`: () => void
- 視覚: 背景と境界線は `panelBg`/`borderDefault`、アクセント操作に `colorPalette='orange'` 等。
- A11y: ボタンには `aria-disabled`/`title` を適切に付与。

## HandBar（`hand`）
- 目的: 「自分の数字」「連想ワードの入力/更新」「（playing中）出す」など、プレイヤー操作集約。
- 配置: グリッドの最下段 `hand`（固定行）。横は全幅で、内部は `HStack`。
- 制御:
  - `phase==='clue'`: 連想の入力/更新のみ（更新＝ready化）。
  - `phase==='playing'`: `me.clue1` が空なら「出す」を無効化（ルール破綻防止）。
- A11y: `role="region" aria-label="自分の操作"`。入力には `placeholder`/Enter送信。
- トークン: `cardBg/cardBorder` で自分の数字パネル。影は `shadows.card` を控えめに。

## SharedBoard（`center`上部）
- 目的: お題/演出/進行ガイド。カテゴリ選択→ランダム抽出→配布の導線。
- 実体: 既存 `TopicDisplay` を再利用（カテゴリ選択・お題シャッフル・配布）。
- A11y: `role="region" aria-label="お題/進行"`。重要な状態は `aria-live`。
- レイアウト: `Panel` + 内部に上下2段（ヘッダ: バッジ群/操作、ボディ: お題/進行）。

## Table（`center`中部: PlayBoard / SortBoard）
- 目的: 場（出した順）表示、もしくは一括判定モードの並べ替えUI。
- PlayBoard:
  - ドロップゾーン風の背景（破線/繰り返しグラデ）。
  - カードは 74×104px程度、角丸・影・順序バッジ。失敗位置は強調（赤系ボーダー）。
  - カードの数字を「playing中は伏せて finishedで公開」に切替える場合は、仕様オプションで出し分け。
  - A11y: `role="region" aria-label="場（出した順）"`。視覚効果に依存せずテキストも併記。
- SortBoard:
  - `@dnd-kit` 利用。マウス/タッチに加え、キーボード操作（上下左右/Enter）を考慮。
  - フォーカスリングとドラッグ中の `DragOverlay` で視覚的手がかりを提供。
  - A11y: 並び要素にフォーカス可能属性、並び番号などのテキストを併記。

## ChatPanel（`right`）
- 目的: チャット/ログの表示・送信。
- 配置: グリッドの `right`。親の `overflowY: auto` に任せ、内部は `ScrollArea` でスクロール。
- 入力欄は下部固定（送信はクールダウンで連投抑制）。
- モバイル: 後続でボトムシート化（Drawer/BottomSheet）する方針。

## Left Column（`left`: Participants / Options）
- 目的: 参加者一覧（状態）、ルームオプション。
- 構造: `Stack` 内に `Panel` を縦積み。縦スクロール可。
- A11y: 見出し・人数などをテキストで明示。

## Panel（共通コンテナ）
- 最低限: `bg=panelBg` / `border=1px` / `borderColor=borderDefault` / `rounded='xl'` / `p` は一貫。
- ヘッダ: タイトル（`Heading size='sm'`）とアクション（右寄せ）。

---

## トークン利用（例）
- colors: `canvasBg`, `panelBg`, `panelSubBg`, `fgDefault`, `fgMuted`, `borderDefault`, `tableBg`, `tableSlot`, `cardBg`, `cardBorder`
- shadows: `card`, `cardHover`
- radii: `md`/`lg`/`xl`（カードやパネルに統一）
- motion（任意）: `fast/normal/slow` のアニメーション時間をトークン化

---

## アクセシビリティの要点
- 重要領域に `role="region"` と分かりやすい `aria-label`。
- 状態更新（開始/成功/失敗/お題変更）は `aria-live` で通達。
- キーボード操作の到達性（Tab順序/フォーカスリング/ショートカット）。
- コントラストは AA 準拠（4.5:1）を目安に色トークンを選定。

---

## レスポンシブ指針
- `md` 未満: 1カラム（`header → center → hand`）。
- `right` は後続PRでボトムシート化（現状は下段に積むだけでも可）。
- `center` は `auto 1fr auto` の内部グリッドで上中下を構成（お題/テーブル/補足）。

---

## 反パターン（避ける）
- 最上位に `Container maxW` など横幅制限ラッパー（center型の原因）。
- 子に過剰な `overflow: hidden`（スクロール切れ）。
- 固定ピクセルの多用（`md` 断面で破綻）。
- ビジュアルから先に寄せる（まず骨格→その後に装飾）。

---

## 作業順の推奨
- AppShell（グリッド）→ スロット挿入 → スクロール/余白検証 → トークン整備 → モック寄せ → モーション

---

## 参照
- `AGENT_FULLSCREEN_MIGRATION_FULL.md`
- Chakra UI Docs（v3）: Getting Started / Theming / Components / Layout / ScrollArea / Accessibility

