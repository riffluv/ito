# Online-ITO (Next.js + Chakra UI + Firebase)

このプロジェクトは、仕様書 `ito-spec.md` に基づくオンライン協力ゲーム「ito」風の最小実装です。ロビー → ルーム → ゲーム（ヒント → 並べ替え → 確認 → 答え合わせ）→ 結果の一連の流れをカバーします。

## セットアップ

1. Firebase プロジェクトを作成し、Authentication で匿名認証を有効化、Firestore を有効化します。
2. 下記の Web アプリ用設定から環境変数を `.env.local` に設定します（`.env.local.example` を参考）。
3. 依存インストールと起動:

```bash
npm install
npm run dev
```

## 主な機能

- 匿名ログイン（初回にプレイヤー名入力を促す）
- ロビーでの部屋一覧表示／部屋作成
- ルーム内の参加者一覧・チャット・オプション編集（ホストのみ）
- ゲーム開始（ホストのみ。プレイヤーへ 1〜100 の一意な数字を配布）
- ヒント入力（ヒント 1 必須、オプションでヒント 2）
- dnd-kit によるドラッグ＆ドロップ並べ替えと保存
- 全員の「確認」完了後に答え合わせ（framer-motion で公開アニメ）
- 成功/失敗の結果表示、もう一度（ホスト）、失敗時の継続（オプション）

## Firestore 構造

- `rooms/{roomId}`: { name, hostId, options, status, createdAt, result }
  - `players/{playerId}`: { name, avatar, number, clue1, clue2, ready, orderIndex }
  - `chat/{messageId}`: { sender, text, createdAt }

仕様書のスキーマをベースに実装しています（`result` は結果表示のために追加）。

## 補足

- 並べ替え保存は誰でも可能。全員が「確認」したら、ホストが「結果を確定」して終了画面に遷移します。
- 失敗後の「継続」は、数字・ヒント・並びを維持したまま、確認状態のみリセットして並べ替えを続行します。
- もう一度：ホストが状態を waiting に戻し、数値/ヒント/確認をリセットします（再度「ゲーム開始」で数字を再配布）。

## 既知の余地

### 2025-08 PhaseHeader 削除メモ

HUD 内バッジと役割が重複し視線移動が増加していたため、ヘッダー直下に存在した段階タイムライン (`PhaseHeader`) を撤去しました。フェーズ状態は HUD のみで一意表示されます。復活させる場合は過去コミットから `components/site/PhaseHeader.tsx` を復元し、`app/rooms/[roomId]/page.tsx` の `header` へインポート + JSX を追加してください (現行 HEAD にはファイルが存在しません)。

## アーキテクチャ（リファクタ後の構成要点）

- UI レイヤ
  - `components/ui/Panel.tsx`: セクション枠の共通コンポーネント（見出し・アクション）
  - 各機能 UI: `TopicDisplay`/`CluePanel`/`OrderBoard`/`RevealPanel`/`ChatPanel` は `Panel` を用いて統一スタイル
- テーマ
  - `theme/index.ts`: `semanticTokens`（色トークン）、`layerStyles`（`panel`/`panelSub`）、`textStyles.hint` を定義
- ゲームロジック
  - `lib/game/random.ts`: 決定的な数字配布
  - `lib/game/rules.ts`: 非減少判定・リビール順計算
  - `lib/game/room.ts`: ゲーム状態遷移（開始・確定・結果確定・継続）
- Firestore I/O ラッパ
  - `lib/firebase/players.ts`: 連想ワード更新、順序保存、ready、presence、プレイヤー初期化
  - `lib/firebase/chat.ts`: チャット送信
  - `lib/firebase/rooms.ts`: ルームオプション更新、最終アクティブ更新、ホスト移譲、退出処理

この分離により、UI 刷新（レイアウト変更やテーマ拡張）やルール拡張（判定方法の切替）を局所的な変更で実現できます。

## フルスクリーン AppShell リファクタ (2025)

従来の中央寄せ `Container` ベースレイアウトを、サイド領域を有効活用するフルスクリーン **AppShell グリッド** に刷新しました。

```
（md 以上）
┌─────────────┬───────────────┬──────────────┐
│    header (56px 高)                           │
├─────────────┼───────────────┼──────────────┤
│ left (280px) │  center (flex/scroll) │ right (340px) │
├─────────────┴───────────────┴──────────────┤
│ hand 操作列 (160px)                          │
└──────────────────────────────────────────────┘
```

スマホ (`base`) では `header → center → hand` の縦積み、チャット(right) は折り畳み（今後モバイル専用ボトムシート化予定）。

主なポイント:

- `gridTemplateAreas` による明示的エリア割当でコンポーネント位置の可読性向上。
- 水平方向は 3 カラム化し、スクロールは `left/center/right` の縦方向に限定 (`overflowY:auto`, 親は `overflow:hidden`)。
- 子要素に `minH={0}` を徹底し、Grid/Flex 高さ計算でのコンテンツ溢れを防止。
- 下部 `hand` 行はプレイヤー固有操作（ヒント入力ショート版等）をまとめ、上段との視線移動距離を最小化。
- グローバルヘッダーは `/rooms/*` では非表示（集中モード）。

### アクセシビリティ

- 主要リージョン: `role="region" aria-label="参加者とオプション"` など明示ラベルを付与しランドマーク的移動を支援。
- 状態変化の頻繁な領域（ボード/チャット）は将来的に `aria-live="polite"` / フォーカスマネジメントを追加予定。
- ボタンに `title` / `aria-disabled`（条件付）を付与しスクリーンリーダーへ状態ヒント提供。

### 2025 CSS ベストプラクティス適用

- Fluid Typography: `clamp()` ベースで 8 ステップの `fontSizes` を定義し、極端なズームや小画面時の情報密度確保。
- ビューポート高さ: `100dvh` を使用しモバイルブラウザ UI 変動によるジャンプを回避。
- 高 DPI: `image-set()` / `min-resolution: 2dppx` コメント指針をテーマに明記、今後カードイラスト等に適用予定。
- 将来対応予定: Container Query による right カラム折り畳み閾値の動的制御、`view-transition` API を用いたフェーズ遷移アニメ。

### パフォーマンス / スクロール最適化

- 1 画面内 scroll コンテナ数を必要最小 (3) に限定しレイアウトスラッシングを軽減。
- 不使用領域の再描画を避けるためチャットパネルは md+ のみ初期描画（`display: none` でなく条件出力検討余地あり）。
- presence ハートビートは `presenceSupported()` 未対応環境のみ 30s 間隔で冗長負荷を抑制。

### 今後のロードマップ

| カテゴリ         | 項目                             | 概要                                             |
| ---------------- | -------------------------------- | ------------------------------------------------ |
| レイアウト       | モバイルチャット Bottom Sheet    | hand 行と排他で表示し親 grid 再計算を最少化      |
| アクセシビリティ | `aria-live` / フォーカスサイクル | フェーズ変更時の自動アナウンス                   |
| テーマ           | Motion / Easing Tokens           | 成功/失敗/注意を semantic easing で統一          |
| パフォーマンス   | Incremental Component Streaming  | ルーム初期ロード時 board/side 分割ストリーミング |
| パフォーマンス   | Virtualized Lists                | 参加者 >50 / チャット大量時の最適化              |
| UX               | View Transitions API             | フェーズ遷移アニメ(Chrome/Edge 対応)             |
| 国際化           | i18n 基盤                        | `next-intl` or `@lingui` を想定                  |

### 開発メモ (運用ルール抜粋)

- 新規スクロール領域を追加する場合は、AppShell 直下でなく既存領域内に統合するか `minH=0` を付与し overflow 競合を避ける。
- レイアウト改変は `gridTemplateAreas` のみを変更し、各エリアコンテナの内部構造変更は最小に保つ（回帰リスク低減）。
- 色追加はまず `tokens.colors`、アプリ文脈色は `semanticTokens.colors` にラップしダークモード差分を一元管理。
- 動作が頻繁な Firestore 書込みは try/catch + silent fail (`.catch(() => void 0)`) 方針を継承するが、将来的に中央化ロガーへ集約予定。

---

この README 追記は 2025 フルスクリーン化リファクタに対応する設計メモです。追加質問や次フェーズ要望（モバイル最適化/アニメーション強化等）があれば Issue 化してください。

## ドキュメント相互参照

| ドキュメント                 | 目的                          | 概要                                                                         |
| ---------------------------- | ----------------------------- | ---------------------------------------------------------------------------- |
| `STYLE_GUIDE.md`             | デザイン & CSS 運用基準       | 2025 年版 Chakra + Fluid + DPI 指針、コンポーネント/命名/トークン/アニメ方針 |
| `DESIGN_LAYOUT_DIAGNOSIS.md` | レイアウト不具合 根本原因記録 | 初期スクロール/オーバーフロー問題の調査ログと再発防止策                      |
| `theme/layout.ts`            | レイアウト寸法ソース          | グリッド列/行/ミニマム高さなどの単一ソース定数                               |

更新時ルール:

1. レイアウト寸法変更 → `theme/layout.ts` 更新し差分理由を PR に記載。
2. 大域スタイル追加が必要か検討: 原則 `globals.css` は極小に保ち Chakra Theme 拡張を優先。
3. 規約変更 (命名/タイポグラフィ/アニメ基準) は `STYLE_GUIDE.md` → 実装の順。

設計影響の大きい変更 (列幅再配分・ブレークポイント追加等) は PR テンプレ: Before/After スクリーンショット + Lighthouse 指標差分 を添付。# Online-ITO (Next.js + Chakra UI + Firebase)

このプロジェクトは、仕様書 `ito-spec.md` に基づくオンライン協力ゲーム「ito」風の最小実装です。ロビー → ルーム → ゲーム（ヒント → 並べ替え → 確認 → 答え合わせ）→ 結果の一連の流れをカバーします。

## セットアップ

1. Firebase プロジェクトを作成し、Authentication で匿名認証を有効化、Firestore を有効化します。
2. 下記の Web アプリ用設定から環境変数を `.env.local` に設定します（`.env.local.example` を参考）。
3. 依存インストールと起動:

```bash
npm install
npm run dev
```

## 主な機能

- 匿名ログイン（初回にプレイヤー名入力を促す）
- ロビーでの部屋一覧表示／部屋作成
- ルーム内の参加者一覧・チャット・オプション編集（ホストのみ）
- ゲーム開始（ホストのみ。プレイヤーへ 1〜100 の一意な数字を配布）
- ヒント入力（ヒント 1 必須、オプションでヒント 2）
- dnd-kit によるドラッグ＆ドロップ並べ替えと保存
- 全員の「確認」完了後に答え合わせ（framer-motion で公開アニメ）
- 成功/失敗の結果表示、もう一度（ホスト）、失敗時の継続（オプション）

## Firestore 構造

- `rooms/{roomId}`: { name, hostId, options, status, createdAt, result }
  - `players/{playerId}`: { name, avatar, number, clue1, clue2, ready, orderIndex }
  - `chat/{messageId}`: { sender, text, createdAt }

仕様書のスキーマをベースに実装しています（`result` は結果表示のために追加）。

## 補足

- 並べ替え保存は誰でも可能。全員が「確認」したら、ホストが「結果を確定」して終了画面に遷移します。
- 失敗後の「継続」は、数字・ヒント・並びを維持したまま、確認状態のみリセットして並べ替えを続行します。
- もう一度：ホストが状態を waiting に戻し、数値/ヒント/確認をリセットします（再度「ゲーム開始」で数字を再配布）。

## 既知の余地

- 参加者数表示（ロビー）は簡略化しています。
- セキュリティルールは含まれません（本番運用時は Firestore ルールの設定が必須）。

## Storybook / Mock HTML の位置づけ

デザイン検証にはこれまで `artifact-*.html` 的な静的 Mock を利用していましたが、**Storybook** を導入したことで以下の利点があります。

| 項目               | Mock HTML       | Storybook                                     |
| ------------------ | --------------- | --------------------------------------------- |
| 相互作用           | ほぼ不可 (静的) | Props/Controls で即時反映                     |
| 回帰検知           | 手動目視        | Chromatic / Screenshot Diff 拡張可能          |
| ドキュメント化     | 別ファイル      | Component Docs 自動生成                       |
| 状態バリエーション | 手作業複製      | Story 単位 (順次/一括・waiting/finished など) |
| チーム共有         | ファイル配布    | ホスト URL (CI 生成)                          |

既存の Mock HTML は「初期デザイン意図のスナップショット」として残しつつ、新規 UI 実験は Storybook 上で行う方針です。

起動:

```bash
npm run storybook
```

## resolveMode ユーティリティ抽象化

`sequential` / `sort-submit` のモード分岐が散在していたため、`lib/game/resolveMode.ts` に以下を集約しました:

- `normalizeResolveMode(mode)` 不正値 → `sequential` へフォールバック
- `isSortSubmit(mode)` / `isSequential(mode)` 型ガード
- `computeAllSubmitted({ mode, eligibleIds, proposal })` 一括提出完了判定
- `canSubmitCard({ mode, canDecide, ready, placed, cluesReady })` UI ボタン制御

これにより MiniHandDock / ドラッグドロップハンドラ / ルームロジックの重複 if 文を削減し、将来的に第三の解決方式を追加する場合もファイル 1 箇所で拡張が可能です。

## スタイル方針 (MiniHandDock 抽象化)

高頻度で視覚調整が入りそうな手札操作バーを対象に、視覚パターンを `theme/itoStyles.ts` にオブジェクト形式で切り出しました。 Chakra の `css` prop へ直接渡せる構造に統一し、**非デザイントークン (magic number)** をこのファイルへ集約: number バッジ、並び確定ボタン状態（有効/無効/共有スタイル）、ホスト分離線、バッジ色など。

リファクタ成果:

- JSX 側は語彙レベル (semantic) のみ保持し視覚差分 PR を最小化
- Evaluate ボタンの有効/無効 複合スタイルを 3 パターン統合 (`evaluateShared` + state 別)
- メトリクス (submit/decide/play) 開発用カウンタを globalThis に追加し将来の本格 telemetry 差し替えを容易化

## ESLint 強化

`.eslintrc.cjs` を新設し以下ルールを有効化:
`eqeqeq`, `no-duplicate-imports`, `prefer-const`, `consistent-return`, `no-console (warn)`。既存の開発用デバッグ `console.log` は環境条件付きで残し warning 管理。

## 今後の拡張指針 (抜粋)

- resolveMode 第3案 (例: ターン制 reveal) は `resolveMode.ts` に列挙追加し predicate を拡張
- Storybook へ Visual Regression (Chromatic) 統合 => PR 毎 snapshot
- Telemetry: dev カウンタ置換として Firebase Analytics もしくは PostHog を feature flag 下で導入

## アーキテクチャ（リファクタ後の構成要点）

- UI レイヤ
  - `components/ui/Panel.tsx`: セクション枠の共通コンポーネント（見出し・アクション）
  - 各機能 UI: `TopicDisplay`/`CluePanel`/`OrderBoard`/`RevealPanel`/`ChatPanel` は `Panel` を用いて統一スタイル
- テーマ
  - `theme/index.ts`: `semanticTokens`（色トークン）、`layerStyles`（`panel`/`panelSub`）、`textStyles.hint` を定義
- ゲームロジック
  - `lib/game/random.ts`: 決定的な数字配布
  - `lib/game/rules.ts`: 非減少判定・リビール順計算
  - `lib/game/room.ts`: ゲーム状態遷移（開始・確定・結果確定・継続）
- Firestore I/O ラッパ
  - `lib/firebase/players.ts`: 連想ワード更新、順序保存、ready、presence、プレイヤー初期化
  - `lib/firebase/chat.ts`: チャット送信
  - `lib/firebase/rooms.ts`: ルームオプション更新、最終アクティブ更新、ホスト移譲、退出処理

この分離により、UI 刷新（レイアウト変更やテーマ拡張）やルール拡張（判定方法の切替）を局所的な変更で実現できます。

## フルスクリーン AppShell リファクタ (2025)

従来の中央寄せ `Container` ベースレイアウトを、サイド領域を有効活用するフルスクリーン **AppShell グリッド** に刷新しました。

```
（md 以上）
┌─────────────┬───────────────┬──────────────┐
│    header (56px 高)                           │
├─────────────┼───────────────┼──────────────┤
│ left (280px) │  center (flex/scroll) │ right (340px) │
├─────────────┴───────────────┴──────────────┤
│ hand 操作列 (160px)                          │
└──────────────────────────────────────────────┘
```

スマホ (`base`) では `header → center → hand` の縦積み、チャット(right) は折り畳み（今後モバイル専用ボトムシート化予定）。

主なポイント:

- `gridTemplateAreas` による明示的エリア割当でコンポーネント位置の可読性向上。
- 水平方向は 3 カラム化し、スクロールは `left/center/right` の縦方向に限定 (`overflowY:auto`, 親は `overflow:hidden`)。
- 子要素に `minH={0}` を徹底し、Grid/Flex 高さ計算でのコンテンツ溢れを防止。
- 下部 `hand` 行はプレイヤー固有操作（ヒント入力ショート版等）をまとめ、上段との視線移動距離を最小化。
- グローバルヘッダーは `/rooms/*` では非表示（集中モード）。

### アクセシビリティ

- 主要リージョン: `role="region" aria-label="参加者とオプション"` など明示ラベルを付与しランドマーク的移動を支援。
- 状態変化の頻繁な領域（ボード/チャット）は将来的に `aria-live="polite"` / フォーカスマネジメントを追加予定。
- ボタンに `title` / `aria-disabled`（条件付）を付与しスクリーンリーダーへ状態ヒント提供。

### 2025 CSS ベストプラクティス適用

- Fluid Typography: `clamp()` ベースで 8 ステップの `fontSizes` を定義し、極端なズームや小画面時の情報密度確保。
- ビューポート高さ: `100dvh` を使用しモバイルブラウザ UI 変動によるジャンプを回避。
- 高 DPI: `image-set()` / `min-resolution: 2dppx` コメント指針をテーマに明記、今後カードイラスト等に適用予定。
- 将来対応予定: Container Query による right カラム折り畳み閾値の動的制御、`view-transition` API を用いたフェーズ遷移アニメ。

### パフォーマンス / スクロール最適化

- 1 画面内 scroll コンテナ数を必要最小 (3) に限定しレイアウトスラッシングを軽減。
- 不使用領域の再描画を避けるためチャットパネルは md+ のみ初期描画（`display: none` でなく条件出力検討余地あり）。
- presence ハートビートは `presenceSupported()` 未対応環境のみ 30s 間隔で冗長負荷を抑制。

### 今後のロードマップ

| カテゴリ         | 項目                             | 概要                                             |
| ---------------- | -------------------------------- | ------------------------------------------------ |
| レイアウト       | モバイルチャット Bottom Sheet    | hand 行と排他で表示し親 grid 再計算を最少化      |
| アクセシビリティ | `aria-live` / フォーカスサイクル | フェーズ変更時の自動アナウンス                   |
| テーマ           | Motion / Easing Tokens           | 成功/失敗/注意を semantic easing で統一          |
| パフォーマンス   | Incremental Component Streaming  | ルーム初期ロード時 board/side 分割ストリーミング |
| パフォーマンス   | Virtualized Lists                | 参加者 >50 / チャット大量時の最適化              |
| UX               | View Transitions API             | フェーズ遷移アニメ(Chrome/Edge 対応)             |
| 国際化           | i18n 基盤                        | `next-intl` or `@lingui` を想定                  |

### 開発メモ (運用ルール抜粋)

- 新規スクロール領域を追加する場合は、AppShell 直下でなく既存領域内に統合するか `minH=0` を付与し overflow 競合を避ける。
- レイアウト改変は `gridTemplateAreas` のみを変更し、各エリアコンテナの内部構造変更は最小に保つ（回帰リスク低減）。
- 色追加はまず `tokens.colors`、アプリ文脈色は `semanticTokens.colors` にラップしダークモード差分を一元管理。
- 動作が頻繁な Firestore 書込みは try/catch + silent fail (`.catch(() => void 0)`) 方針を継承するが、将来的に中央化ロガーへ集約予定。

---

この README 追記は 2025 フルスクリーン化リファクタに対応する設計メモです。追加質問や次フェーズ要望（モバイル最適化/アニメーション強化等）があれば Issue 化してください。
