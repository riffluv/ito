## Pixi HUD化 指示書（次担当向け）

### 1. 現状整理
- `components/ui/pixi/PixiHudStage.tsx` を復旧済み。Pixi `Application` を単一 Canvas で管理し、`usePixiHudLayer` でレイヤーを登録できる状態。
- ルームページ (`app/rooms/[roomId]/page.tsx`) には再度 `<PixiHudStage>` を噛ませる必要がある。（現在は DOM 版表示のまま。作業開始時に差し込んでください）
- **お題表示 (`SimplePhaseDisplay.tsx`) とフェーズアナウンス (`PhaseAnnouncement.tsx`) は Pixi 化対象外。既存 DOM＋GSAP 実装を絶対に崩さない。**
- 既存表示の寸法（幅・高さ・余白・フォントサイズ）は厳守。スクリーンショット比較で差異が出ないこと。

### 2. Pixi HUD化の優先順位
1. **パーティーパネル (`components/ui/DragonQuestParty.tsx`)**
   - `usePixiHudLayer("party-panel", { zIndex: 30 })` を想定。  
   - リストの背景枠・キャラアイコン枠・ステータスゲージを Pixi で描画。  
   - クリック領域・ツールチップ・音トリガーは DOM を残す。DOM の位置に合わせて Pixi コンテナを整列させる。
2. **モーダル類**
   - 対象: `components/SettingsModal.tsx`, `components/ui/MvpLedger.tsx`, `components/RoomPasswordPrompt.tsx` など。  
   - レイヤー名は `"settings-modal"` や `"battle-records-board"` のように `<機能>-<役割>` 形式に統一し、zIndex は 90〜110 を使用。  
   - 入力フォームやボタンは DOM 維持。モーダルのサイズ・スクロール挙動は絶対に変更しない。
3. **ローディング／トランジション演出**
   - `components/ui/TransitionProvider.tsx` やローディング用のオーバーレイに Pixi レイヤー（例: `"loading-overlay"`）を差し込む。  
   - ノイズ・光・粒子などの演出のみ Pixi で描画。テキストやボタンは DOM 維持。

### 3. 実装ガイドライン
- **寸法厳守**: DOM の `getBoundingClientRect()` を参照し、Pixi コンテナの座標／サイズを同値に設定する。`ResizeObserver` と `requestAnimationFrame` の組み合わせで常時同期する。
- **レイヤー命名**: `<機能名>-<役割>` 形式で統一し、`PixiHudStage` の `pointerEvents: "none"` 前提で 40〜130 の zIndex 範囲を使う。例: `"party-panel"`, `"settings-modal"`, `"battle-records-board"`, `"loading-overlay"`。
- **ターゲットDOM**: Pixi から位置・サイズを参照する DOM 要素には `data-pixi-target="..."` などの属性を付与する。`usePixiLayerLayout` ではその要素を `ref` で直接参照する。
- **背景描画ユーティリティ**: 背景デザインは `lib/pixi/panels` 配下の共通関数を経由し、再利用性を高める。既存の `drawSettingsModalBackground` / `drawBattleRecordsBoard` もここから呼び出す。
- **イベント**: Pixi で pointer を扱う場合は `container.eventMode = "static"` 等を設定。DOM 側で処理する要素には `pointerEvents: auto` を維持する。
- **アニメーション**: Pixi でトゥイーンする場合は `gsap/PixiPlugin` を登録し、タイムラインと Graphics を確実に `kill()` / `destroy()` する。
- **フォールバック**: Pixi 初期化エラー時も DOM 版が表示されるように、Pixi ブロックのマウント有無でクラス付け替えや可視性制御を行う。
- **Pixi v8 注意事項**: `PIXI.Text` の `dropShadow` は `TextDropShadow` オブジェクト指定、`destroy()` は `PIXI.DestroyOptions` 型を使用する。旧 API (`boolean` の `dropShadow` や `IDestroyOptions`) を使わない。
- **ログ管理**: Pixi レイヤー内の `console.log` はデバッグ後に削除し、`npm run typecheck` を常にパスさせる。

### 4. テスト & 検証
1. `<PixiHudStage>` を挿入後、Canvas が生成されているかブラウザの DevTools で確認（`<canvas>` が追加される）。
2. `npm run build` / `npm run dev` を実行し、コンソールにエラーが出ないか確認。
3. 旧来 DOM 表示とのスクリーンショット比較を必ず実施。違いが出た場合は修正する。
4. 主要操作（モーダル開閉、パーティ操作、ロード画面遷移）を手動テストし、DOM イベントが機能しているか確かめる。
5. `npm run typecheck` を実行し、Pixi v8 周りの型エラーが無いことを確認する。

### 5. 引き継ぎの仕方
- 作業完了後、ここにレイヤー名や注意点を追記する。
- 新しいテクスチャ等を追加した場合は `public/pixi-assets/` などにまとめ、読み込みコードと一緒に記載する。
- 作業差分は `npm run build` だけでなく `npm run typecheck` も通した状態で引き継ぐ。

> 注意: お題エリア／フェーズアナウンスに関しては「Pixi 化しない」とユーザーから指示済み。触れた場合は即戻すこと。
