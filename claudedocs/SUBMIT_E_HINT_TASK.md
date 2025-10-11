# E出すアナウンス実装タスク

## 背景
- 現在の `MiniHandDock` には「SPACEキーで素早く入力！」のガイド (`SpaceKeyHint.tsx`) のみが存在。
- 以前試作した「E or ドラッグで出す！」ガイドは一旦リセット済み。現状コードには存在しない。
- ゲーム体験として、連想ワード決定後にショートカットでカードを提出できることを視覚的に案内したい。
- 勝利／敗北時の GSAP 演出（`GameResultOverlay.tsx`）や他 UI と干渉せず、残像が残らない実装が必須。

## 目的
連想ワード決定後に、青色チップ＋上向き矢印のアナウンスを一度だけ表示し、`E` キーで「出す」を実行できることを確実に伝える。演出の終了・フェーズ遷移・提出完了時にはアナウンスが即座に消えること。

## 実装要件
1. **ガイドコンポーネント**
   - `components/ui/SubmitEHint.tsx`（新規）を作成し、`SpaceKeyHint` と同等の演出品質で青／上向き矢印の GSAP アニメーションを実装する。
   - テキスト: `E or ドラッグ で出す！`。フォント・角付きボックス・粒子など既存ガイドと統一感を持たせつつ、色味は青系に調整する。
   - GSAP の `timeline` 参照を保持し、`shouldShow` が `false` になった時・アンマウント時に `kill()` + 後処理を忘れず実施（残像対策）。
   - `pointer-events: none;` を維持して他 UI の操作を邪魔しないこと。

2. **表示条件**
   - `MiniHandDock.tsx` 内で状態を管理する（例: `shouldShowSubmitHint`, `prevSubmitHintRef`）。
   - 表示する条件は以下すべて:
     - `roomStatus === "clue"`
     - `isRevealAnimating` が `false`
     - 「出す」ボタンが有効（`canClickProposalButton`）かつラベルが `"出す"` である
   - 上記条件を満たした瞬間に 1 度だけ表示。条件を満たさなくなったら即座に非表示。
   - `handleSubmit` 成功時やフェーズ遷移 (`roomStatus` 変化, `isRevealAnimating` true 等) でアナウンス状態をリセットする。

3. **ショートカット**
   - グローバルの `keydown` で `E` / `Shift+E` を拾い、
     - 入力欄・テキストエリア・contenteditable にフォーカス中は無視。
     - 前項の表示条件を満たす場合に `e.preventDefault()` の上で `handleSubmit()` を呼び出し。
   - `Space` キーの挙動（入力欄フォーカス）と競合させない。
   - 連想ワード決定直後に入力欄からフォーカスを外すかどうかは判断して良い（UX 優先）。フォーカスを外さない場合でも、`E` ショートカットが一度のクリックで使えるよう配慮すること。

4. **視覚位置**
   - 既存のスペースヒントが左寄りに表示されているため、E ヒントは右側に自然なバランスで表示する（レイアウトは任意。重なり禁止）。
   - テスト中に勝利演出 (`GameResultOverlay`) と重なる場合は位置・z-index を調整。

5. **リグレッション回避**
   - `SpaceKeyHint.tsx` と同様、`shouldShow` が false のときにタイムラインを `kill()` して後処理を入れる（既に実装済みなら再確認のみ）。
   - 既存のスペースヒントや `SeinoButton`, ホストボタン群のレイアウトを崩さない。
   - `MiniHandDock` の props や既存メソッドの削除・挙動変更は行わない。

6. **コードスタイル**
   - TypeScript/React 既存コードに合わせる。
   - 状態管理は `useState`, `useRef`, `useEffect` で実装。不要な再レンダリングを避ける。
   - 既存コメント/構造を尊重し、追記コメントは必要最小限に。

## テスト観点
1. 連想ワード入力 → 決定 → ヒントが 1度だけアニメ付きで表示され、`E` ショートカットでカード提出できる。
2. 一度カード提出するとヒントが即座に消え、`E` ショートカットも無効化される。
3. フェーズが `clue` 以外やリザルト演出 (`isRevealAnimating === true`) の最中にヒントが出ない。
4. `Space` → `Esc` → `Space` の操作で入力欄フォーカスが乱れず、ヒントに悪影響が出ない。
5. `npm run typecheck` が通る。
6. （可能なら）実機で勝利／敗北演出との干渉がないか確認。

## 参考
- 既存ガイド: `components/ui/SpaceKeyHint.tsx`
- せーのボタン: `components/ui/SeinoButton.tsx`
- 連想ワード提出ロジック: `MiniHandDock.tsx` 内 `handleSubmit`, `handleDecide`
- 勝利演出: `components/ui/GameResultOverlay.tsx`

## 納品物
- 実装済みコード（主に `MiniHandDock.tsx`, `SubmitEHint.tsx`）
- 動作確認結果（ショートカット／ヒントの表示条件／勝利演出時の挙動）
- 型チェック報告

