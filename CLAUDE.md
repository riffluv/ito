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

- Pixi オブジェクトは必ず destroy でクリーンアップ。  
- GSAP の duration/ease は “偶数・5刻みを避ける” ルール（指示書参照）。  
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

1. 目的のファイル・方針を `AGENTS.md` / `pixi-hud-instructions.md` で確認。
2. 実装前に `prefers-reduced-motion` や Pixi 背景の負荷影響を考慮。
3. 実装後は `npm run lint` / `npm run build` を必ず通す。
4. 表示確認は内蔵ブラウザ機能（Playwright preview 等）で Pixi 背景が描画されるかチェック。

## 禁止事項／NG 例

- ライトモード復活・ `_light` トークン再導入。  
- Pixi 背景の削除（デフォルト設定を CSS に戻す）。  
- 追加CLI（gemini, brave-search 等）の使用。  
- Stripe Webhook の削除や未検証の API 変更。  
- 2クリック導線を崩すようなメインメニュー分割。  

## 最後に

このプロジェクトは Pixi と GSAP を駆使したリッチなオンラインカードゲームです。既存の世界観や UX を維持しつつ、演出と操作性を磨いていくことが主な役割になります。疑問点があれば `AGENTS.md` と関連ドキュメントを優先的に参照し、プロジェクト方針に沿った貢献をお願いします。よろしくお願いします！
