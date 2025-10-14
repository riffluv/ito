## プロジェクト概要

- タイトル: **序の紋章 III（オンライン版）**
- 目的: 「ito」ライクな連想ゲームを、Pixi.js/GSAP 演出と Firebase リアルタイム同期で実現。
- 状態: 本番コードベース。UI/UX の磨き込みと Pixi 背景統一を進めている。
- 優先事項:  
  1. **UX を壊さずに演出を強化**（Pixi HUD、GSAP）  
  2. **2 クリックでゲーム参加できる導線を保持**（メインメニューがロビーを兼ねる）  
  3. **収益化の基盤（Stripe）と勝敗演出をブラッシュアップ**  

## 技術スタックと主要ディレクトリ

- Next.js 14.2 + App Router（`app/`）  
- Firebase（Firestore + RTDB Presence + Auth）  
- Pixi.js 8（HUD/背景演出）、GSAP 3（アニメーション）  
- Chakra UI（DOM レイヤー）、TypeScript
- 重要ディレクトリ
  - `components/ui/` : 共通 UI、Pixi HUD 関連、モーダル類
  - `components/settings/` : 設定モーダル（Pixi 背景あり）
  - `lib/pixi/` : 背景や HUD のコントローラ
  - `lib/audio/` : サウンド設定と SoundManager
  - `lib/hooks/` : リアルタイム同期（useRoomState/useParticipants 等）

## デザイン・演出ガイドライン

- **世界観**: HD-2D × ファンタジー。Pixi の光・山景色などで統一。  
- **ボタン**: `AppButton` 使用。2025-10-14 時点で 3px 角丸と陰影あり。メインメニューでも同スタイルに寄せる。  
- **モーダル**: DOM で骨格、Pixi HUD で背面演出。`VictoryHighlightLayer` や `SettingsModal` を参照。  
- **ローディング/勝敗演出**: `DragonQuestLoading` や `GameResultOverlay` は DOM + GSAP 基本、PixiPlugin で光演出を追加中。  
- **背景設定**: デフォルトは `pixi-dq`（山の景色）。設定モーダルから CSS 背景などに切り替え可。  
- **サウンド**: `successMode` デフォルトは `epic`。`lib/audio/types.ts` の設定を参照。  
- **UX ポリシー**: 「ログイン → ルーム一覧 → 入室」で 2 クリック以内を維持。メニュー刷新時も導線は変えない。  

## 最近の取り組み（2025-10 時点）

- Pixi 背景を各モーダルへ展開するタスク進行中（`pixi-hud-instructions.md` 参照）。  
- 戦績モーダルと勝敗演出に PixiPlugin を適用済み。光の帯は `VictoryHighlightLayer` で描画。  
- メインメニューのボタン角丸調整、背景 Pixi 化検討中（UX を損なわない範囲で演出強化）。  

## 開発ルール

### コードスタイル
- 日本語コメントは最小限。命名はローマ字/英語。  
- GSAP の duration / easing などは「偶数・5刻み回避」の独自ポリシーに従う（`万能デザイン指示書.md` 参照）。  
- Pixi オブジェクト作成時は `destroy({ children: true })` を徹底しリークを防止。  
- `prefers-reduced-motion` を尊重（Pixi 演出もオフにする）。  

### Search / CLI ポリシー（重要）
- **回答は日本語限定。**  
- Web検索は Codex CLI 内蔵の **WebSearch** を必ず使用。`gemini -p` や `brave-search` は禁止。  
- 例外: ユーザーが明示的に外部 CLI を要求した場合のみ使用。  
- 参照元は回答内に明示（URL か WebSearch 結果）。  
- 外部 MCP: `serena`（http://127.0.0.1:24282）が利用可能。  

## 作業フロー

1. **仕様確認**: `万能デザイン指示書.md` → デザイン指針 / 数値規則が書かれている。  
2. **タスク参照**: 新規 Pixi HUD 対応は `pixi-hud-instructions.md` を確認。  
3. **実装**: Pixi レイヤー → DOM レイアウト同期 → GSAP/PixiPlugin で演出。  
4. **テスト**: `prefers-reduced-motion` / メモリリーク / `npm run build` を必ず確認。  

## 補足

- 主要な演出（Pixi 背景）は `usePixiHudLayer` + `usePixiLayerLayout` が基本パターン。  
- Stripe 決済や Presence まわりは本番仕様なので、テスト時は環境変数に注意。  
- メインメニュー刷新は UX 優先（操作回数を増やさずに見た目だけアップデート）。  

以上の方針を踏まえ、次のエージェントもすぐにプロジェクト全体を理解しスムーズに開発できるよう準備しています。困った場合は `pixi-hud-instructions.md` や `万能デザイン指示書.md` を参照のこと。  

