## プロジェクト概要（2025-10 時点）

- タイトル: **序の紋章 III（オンライン連想ゲーム）**
- 状態: 本番運用中。Pixi.js/GSAP を活用した HD-2D 風演出が特徴。
- 目的: 次のエージェント（Claude Code）が素早く把握し、既存コンセプトを崩さず改善を続けられるようにする。

### 技術スタック
- Next.js 14 App Router（`app/`）
- Firebase: Firestore + RTDB Presence + Auth
- Pixi.js 8（HUD/背景）、GSAP 3（タイムライン）
- Chakra UI v3（DOM レイヤー）
- Stripe 決済基盤（Checkout + Webhook）

### 優先ポリシー
- **ダークモード固定**（ライトテーマは完全に撤廃済み）
- **2クリックでゲーム開始できる導線を維持**
- **Pixi 背景で世界観を統一**（ゲーム本編・モーダル・ローディング）
- **prefers-reduced-motion を尊重**（Pixi 演出も抑制）
- **回答／コメントはすべて日本語**（プロジェクト方針）
- **Web検索は Codex CLI 内蔵 WebSearch を利用（gemini/brave 禁止）**

## 参照ファイル

| 用途 | ファイル |
| --- | --- |
| 全体方針/ルール | `AGENTS.md`（必読） |
| Pixi HUD 展開タスク | `pixi-hud-instructions.md` |
| デザイン数値・スタイル規則 | `万能デザイン指示書.md` |
| ゲーム仕様 | `docs/GAME_LOGIC_OVERVIEW.md` |
| Stripe 設定 | `docs/stripe-integration-foundation.md` |
| パフォーマンス指針 | `docs/perf-metrics-dashboard.md`, `docs/performance-report.md` |

## 現在進行中のテーマ

1. **Pixi HUD の全モーダル／ローディングへの展開**  
   - すでに `SettingsModal`, `VictoryHighlightLayer` で実績あり。
   - 作業基準: `pixi-hud-instructions.md`

2. **メインメニューのビジュアル刷新（UX維持）**  
   - Pixi 背景（山の景色）をデフォルトに。  
   - ただし「ロビー＝同一画面で即プレイ可能」を崩さない。

3. **勝敗演出の PixiPlugin 強化**  
   - `GameResultOverlay.tsx` で光の帯を同期。  
   - ローディング画面 `DragonQuestLoading.tsx` も Pixi 背景を追加予定。

## コードスタイルと注意点

- **AI感排除を最優先**: `万能デザイン指示書.md` に従い、余白・フォント・アニメーションは非均一値を使用。
  - 余白: 4の倍数を避ける（例: `py="5.3rem"` ではなく `py={{ base: "5.3rem", md: "6.1rem" }}`）
  - フォントサイズ: 偶数刻みを避ける（例: `fontSize="1.17rem"` など）
  - duration: 偶数・5刻みを避ける（例: `0.83`, `0.87`, `1.17`）
  - easing: `cubic-bezier(.2,1,.3,1)` などカスタム値を使用
  - letterSpacing: 微差を入れる（例: `0.051em`, `0.083em`）
- **AppButton のスタイル**: `sx` ではなく `css` プロパティを使用。
- Pixi オブジェクトは必ず destroy でクリーンアップ。
- 新規演出は reduced-motion に対応。
- DOM で描くもの（テキスト、フォーム）と Pixi 背景を混同しない。
- 既存の Stripe / Firebase フローを破壊しない（本番仕様）。
- PR レンジ感：クラシックUI → Pixi への移行は段階的に。無闇にフルリプレイスしない。

## よくあるタスクのパターン

1. Pixi 背景を追加する場合:  
   - `usePixiHudLayer` でレイヤー作成 → `usePixiLayerLayout` で DOM と同期 → GSAP で演出。
2. ボタンや枠の調整:  
   - `components/ui/AppButton.tsx` や `theme/` 配下のレシピを編集。
3. プレイフロー改善:  
   - `app/page.tsx` （ロビー兼メインメニュー）と `components/ui/MiniHandDock.tsx` が中心。
4. ストライプ関連:  
   - `app/api/stripe/*` と `lib/stripe/*` を参照。sandbox でテストする際は環境変数に注意。

## 作業フロー（Claude Code 推奨）

1. 目的のファイル・方針を `AGENTS.md` / `万能デザイン指示書.md` で確認。
2. **デザイン変更時**: `/design-audit` スキルでAI感チェック（`.claude/skills/design-audit.md`）。
3. 実装前に `prefers-reduced-motion` や Pixi 背景の負荷影響を考慮。
4. 実装後は `npm run lint` / `npm run build` を必ず通す。
5. 表示確認は内蔵ブラウザ機能（Playwright preview 等）で Pixi 背景が描画されるかチェック。

## Skills（Claude Code専用）

- **`/design-audit`**: 万能デザイン指示書に基づいてAI臭さをチェック。
  - 場所: `.claude/skills/design-audit.md`
  - 使用タイミング: 新規コンポーネント作成後、デザイン変更後、本番デプロイ前
  - 指示書を更新すれば次回から自動的に新基準適用

## 禁止事項／NG 例

- ライトモード復活・ `_light` トークン再導入。  
- Pixi 背景の削除（デフォルト設定を CSS に戻す）。  
- 追加CLI（gemini, brave-search 等）の使用。  
- Stripe Webhook の削除や未検証の API 変更。  
- 2クリック導線を崩すようなメインメニュー分割。  

## 最近の更新（2025-10-19）

- **AI感排除の徹底**: メインメニュー・ルールページで余白・フォント・アニメーションを非均一化。
  - 4の倍数の余白 → rem単位の中途半端な値（`5.3rem`, `6.1rem`, `8.3rem`）
  - 偶数刻みのフォント → 小数点rem（`1.17rem`, `1.3rem`, `1.9rem`）
  - GSAP duration → 非整数（`0.83`, `0.87`）
  - transition easing → `cubic-bezier(.2,1,.3,1)`
- **デザイン監査スキル作成**: `/design-audit` で自動チェック可能に。

## 最後に

このプロジェクトは Pixi と GSAP を駆使したリッチなオンラインカードゲームです。既存の世界観や UX を維持しつつ、演出と操作性を磨いていくことが主な役割になります。**AI感を排除し、人の手で作られた温度のあるUIを目指しています。** 疑問点があれば `万能デザイン指示書.md` と関連ドキュメントを優先的に参照し、プロジェクト方針に沿った貢献をお願いします。よろしくお願いします！

## DPI スケーリング運用メモ

- scaleForDpi(value) は calc(value * var(--dpi-scale, 1)) に展開され、100% DPI は 1 倍、125%/150% は app/globals.css のメディアクエリで設定した縮尺が適用される。
- 高 DPI でも同じ見た目を維持したい余白・フォントだけに scaleForDpi() を使う。レイアウト幅で変化させたい要素は従来通り @container や Chakra のレスポンシブ props を利用する。
- デザインを更新するときは 100% DPI 基準で値を決め、必要な箇所だけ scaleForDpi() を適用する。トークン（UNIFIED_LAYOUT や CSS の --card-*）を更新すると関連コンポーネントへ一括で反映できる。
