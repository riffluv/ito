# GSAPアニメーションが動かないときの確認手順

## 症状
- 会社PCでのみロビー内のGSAPアニメーションが発火しない。
- プレーンなHTML/CSS/JSファイルでは問題なく動作する。

## 主な原因
1. OSで「動きの軽減 (prefers-reduced-motion)」がONになっている。
2. `localStorage.force-animations` が `"false"` になっており、プロジェクト側でアニメーション抑制モードに入っている。
3. 旧バージョンでは `?anim=on` が効かなかったが、現在は AnimationContext 側でクエリを拾うよう修正済み。

## 対処手順
1. **UIから強制ONに切り替える**
   - ロビー右上 → 設定 → Graphics → アニメーション → 「常に有効にする」を選択。
   - 送信後に `window.dispatchEvent(new CustomEvent("forceAnimationsChanged"))` が発火し、即座に反映される。
2. **URLクエリでの一時的な切り替え**
   - `?anim=on` を付けてアクセスすると、`localStorage.force-animations` を `"true"` に書き込み、自動的にクエリを除去する。
   - `?anim=off` を付けると逆にOFFへ切り替えられる。
3. **手動でlocalStorageを確認**
   - DevTools Console で `localStorage.getItem("force-animations")` を実行。
   - `"false"` になっている場合は `localStorage.setItem("force-animations", "true")` を実行し、必要であれば `window.dispatchEvent(new CustomEvent("forceAnimationsChanged"))` を送る。
4. **OS設定の確認**
   - Windows: 設定 → アクセシビリティ → 視覚効果 → アニメーション効果をONに。
   - macOS: システム設定 → アクセシビリティ → 表示 → 「動きを抑える」をOFFに。

## デバッグ Tips
- `console.log(useReducedMotionPreference())` で値を確認し、`false` になっているかをチェック。
- AnimationContext の `forceAnimations` が想定どおり更新されているかを `React DevTools` で確認。
- URLクエリで上書きした直後に `history.replaceState` でクエリが除去されるため、ブックマーク時は `?anim=on` を付けたURLを再度保存する。

## 補足
- AnimationContext は初回ロード時に `force-animations` が存在しない場合 `"true"` を保存するため、新規端末ではアニメーションが有効になる想定です。
- それでも動かない場合は、`matchMedia('(prefers-reduced-motion: reduce)')` が `true` になっていないか、企業ポリシーなどで OS 側が強制されていないかを確認してください。
