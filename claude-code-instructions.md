# PixiPlugin を用いた勝利／失敗演出強化タスク指示書

## ゴール
既存の勝利／失敗演出（`components/ui/GameResultOverlay.tsx`）に、PixiJS 背景のライト演出を同期させ、滑らかさと奥行きを強化する。既存の DOM/GSAP アニメーションの構成は維持しつつ、Pixi 側の光の尾・フラッシュ・色変化を追加すること。

## 前提
- 現行コードは Next.js + Chakra UI、GSAP を用いた DOM アニメーションで勝敗演出を実装済み。
- Pixi HUD レイヤーは `components/ui/pixi` 配下、および `lib/showtime` システムから利用可能。
- ShowTime シナリオ（`lib/showtime/actions.ts` / `lib/showtime/ShowtimeManager.ts`）で勝敗時の演出をトリガーしている。

## 実装タスク
1. **PixiPlugin のセットアップ**
   - `gsap.registerPlugin(PixiPlugin);` を Pixi HUD 初期化時（`components/ui/pixi/PixiHudStage.tsx` もしくは共通初期化ファイル）で一度だけ呼び出す。
   - ESM インポート: `import { PixiPlugin } from "gsap/PixiPlugin";`

2. **勝利／失敗専用の Pixi レイヤー追加**
   - `components/ui/pixi` に「VictoryHighlight」(仮称) を作成。半透明の光帯や粒子を描画できる PIXI.Container / PIXI.Graphics を用意する。
   - `GameResultOverlay` から `usePixiHudLayer("victory-highlight", { zIndex: … })` で該当レイヤーを取得し、勝敗時に必要なスプライト（光の帯・パーティクル）を生成・破棄する。

3. **GSAP タイムラインとの同期**
   - `GameResultOverlay.tsx` の `useEffect` 内で作成している `gsap.timeline()` に、Pixi レイヤーのトゥイーンを追加。
   - 例: `tl.to(lightBar, { pixi: { alpha: 0.9, x: ... }, duration: 0.6, ease: "power2.out" }, "<");`
   - 勝利／失敗で色や動きを分岐させる（勝利=ゴールド系、失敗=パープル系など）。

4. **ShowTime シナリオ更新**
   - 該当シナリオ（`showtime.play("round:reveal", …)` など）で Pixi レイヤーを表示／非表示にするアクションを追加。
   - 既存 DOM アニメーションのイージングに合わせて、Pixi 側も開始タイミング・継続時間を調整する。

5. **後始末**
   - 演出終了後に Pixi スプライトを破棄する（`destroy({ children: true })` を忘れない）。
   - `prefersReducedMotion` が `true` の場合は Pixi 演出も無効化する。

## 完了条件
- 勝利/失敗時、DOM テキストは以前と同じモーションで動き、背後でピカッと光が走る・尾を引くなどの Pixi 演出が同期して表示される。
- アニメ完了後、Pixi レイヤーが破棄されメモリリークがない。
- `prefersReducedMotion` を有効にすると従来どおり静的表示になる。
- `npm run build` と `npm run lint` が成功する。

## テスト
1. ゲームを勝利させる → テキストが左から滑り込み、同時に光のエフェクトが滑らかに走ること。
2. 失敗時 → パープル系の光が落下演出と同期して動作すること。
3. `prefers-reduced-motion` を OS 側でオン → アニメーションが抑制されること。
4. 演出が終了した後に Pixi レイヤーが残っていないこと（コンソールエラーが出ない）。

## 注意事項
- PixiPlugin のトゥイーンは GPU を使うが、スプライト数やフィルタを増やしすぎない。
- タイムライン同期にはラベルまたは `"<"` / `">"` を活用し、DOM と Pixi の動きをズレなくまとめる。
- 大画面／小画面でも違和感が出ないようにリサイズ時の位置調整も確認すること。
