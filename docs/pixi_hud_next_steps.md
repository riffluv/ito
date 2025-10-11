## Pixi HUD化 指示書（共通版）

> この文書は次担当のエージェント向けの指示です。`claudedocs/pixi_hud_next_steps.md` と同内容を保持し、どちらを参照しても同じ情報になるよう管理してください。

### 現状
- `components/ui/pixi/PixiHudStage.tsx` を再追加済み。Pixi `Application` とレイヤー管理が使える状態。
- ルームページに `<PixiHudStage>` を差し込む作業はまだ実施していない（作業開始時に行う）。
- **お題表示 (`SimplePhaseDisplay.tsx`) とフェーズアナウンス (`PhaseAnnouncement.tsx`) は Pixi 化禁止。既存 DOM＋GSAP 実装のまま維持する。**
- UI のサイズ・フォント・余白などはデプロイ済みバージョンと同寸法であることが大前提。

### Pixi 化の優先順位
1. **パーティーパネル** (`components/ui/DragonQuestParty.tsx`)
2. **モーダル類** (`components/SettingsModal.tsx`, `components/ui/MvpLedger.tsx`, `components/RoomPasswordPrompt.tsx` など)
3. **ローディング／トランジション演出** (`components/ui/TransitionProvider.tsx` など)

### 実装ルール
- Pixi で描画するのは背景や装飾部分。フォームやクリック可能な要素は DOM を残す。
- レイヤー名の例：
  - `"party-panel"`（zIndex 30）
  - `"modal-shell"`（zIndex 80）
  - `"loading-overlay"`（zIndex 120）
- DOM の大きさは `getBoundingClientRect()` で取得し、`ResizeObserver` で Pixi コンテナに反映させる。
- GSAP を使う場合は PixiPlugin を登録し、`timeline.kill()` などの後始末を徹底する。
- Pixi 初期化に失敗しても従来表示が出るように、DOM をフォールバックとして保持する。

### テストチェックリスト
1. `<PixiHudStage>` を挿入 → DevTools で `<canvas>` が生成されるか確認。
2. `npm run build` / `npm run dev` を実行し、コンソールエラーが出ないこと。
3. 旧 DOM 版とのスクリーンショット比較。差異があれば修正。
4. モーダル開閉、パーティ操作、ロード演出など主要フローを手動確認。

### 禁止事項
- お題／フェーズの HUD は触らない（CSS 変更も含む）。
- UI のレイアウト寸法（幅・高さ・余白）を変更しない。
- サウンドやクリックイベントの流れを壊さない。

### 引き継ぎ方法
- 作業完了後、この文書と `claudedocs/pixi_hud_next_steps.md` を必ず更新する。
- 新しいテクスチャ・アセットを追加した場合は場所と読み込み手順を追記する。
- `npm run build` に通った状態で次の担当へ渡す。
